import { db, tables } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  adminAccessError,
  canTransitionAccount,
  enabledSections,
  type Viewer,
} from "@/lib/authz";
import {
  emitEvent,
  type OutboxDeliveryScheduler,
  type OutboxEventName,
} from "@/lib/outbox";
import { recordAudit } from "@/lib/audit";
import { assignMemberNumber } from "@/lib/account/member-number";
import { ok, err, type ActionResult } from "@/lib/contracts/result";

// Account lifecycle transitions (docs/build/state-machines.md). The ONLY
// code path allowed to change users.status. Used by the admin review surface
// (ADMIN-01/02) and by re-application flows.

const REASON_REQUIRED: Viewer["status"][] = [
  "rejected",
  "needs_changes",
  "suspended",
];

const EVENT_FOR: Partial<Record<Viewer["status"], OutboxEventName>> = {
  awaiting_payment: "account.payment_due",
  approved: "account.approved",
  needs_changes: "account.needs_changes",
  rejected: "account.rejected",
};

export async function transitionAccount(
  actor: Viewer | null,
  input: {
    userId: string;
    to: Viewer["status"];
    reason?: string;
    /** Status the admin saw when they clicked. A mismatch means the page was stale. */
    from?: Viewer["status"];
    /** statusChangedAt (ISO, or "" if none) the admin saw. Catches A-B-A changes the status alone misses. */
    seenChangedAt?: string;
  },
  scheduleDelivery?: OutboxDeliveryScheduler,
): Promise<ActionResult<{ status: Viewer["status"] }>> {
  const denied = adminAccessError(actor);
  if (denied) return err(denied, "Administrator access is required.");

  const subject = await db.query.users.findFirst({
    where: eq(tables.users.id, input.userId),
  });
  if (!subject) return err("not_found", "Account not found.");
  if (subject.id === actor!.id)
    return err(
      "forbidden",
      "Administrators cannot change their own account status.",
    );

  if (
    (input.from !== undefined && input.from !== subject.status) ||
    (input.seenChangedAt !== undefined &&
      input.seenChangedAt !== (subject.statusChangedAt?.toISOString() ?? ""))
  )
    return err(
      "conflict",
      "This account changed since you opened it. Reload the page and try again.",
    );

  // Suspending then unsuspending must never skip the fee: only a member
  // whose paid year is still running goes straight back to approved.
  // Admins and superadmins pay no fee, so they return to approved.
  const to: Viewer["status"] =
    input.to === "approved" &&
    subject.status === "suspended" &&
    subject.role === "member" &&
    !(subject.membershipValidUntil && subject.membershipValidUntil > new Date())
      ? "awaiting_payment"
      : input.to;

  if (!canTransitionAccount(subject.status, to))
    return err(
      "conflict",
      `Cannot move an account from ${subject.status} to ${to}.`,
    );

  // ADMIN-02: approval is disabled until the privacy audit is complete -
  // the applicant must have accepted the current notice version.
  if (to === "approved" || to === "awaiting_payment") {
    const { hasCurrentConsent, getEvidenceStatus } =
      await import("@/lib/account/registration");
    if (!(await hasCurrentConsent(subject.id)))
      return err(
        "conflict",
        "Privacy audit incomplete: the applicant has not accepted the current privacy notice.",
      );

    // Evidence completeness only gates the application approval
    // (pending/needs_changes -> awaiting_payment; docs/build/state-machines.md
    // "Approval preconditions"). It must NOT block confirming payment or
    // suspended -> approved (unsuspend): a member's evidence can go stale
    // after the fact (e.g. an admin edit) without that locking them out.
    if (
      to === "awaiting_payment" &&
      (subject.status === "pending" || subject.status === "needs_changes")
    ) {
      const evidence = await getEvidenceStatus(subject.id);
      if (!evidence.complete)
        return err(
          "conflict",
          `Application evidence incomplete: missing ${evidence.missing.join(", ")}.`,
        );
    }
  }

  const reason = input.reason?.trim() ?? "";
  if (REASON_REQUIRED.includes(to) && !reason)
    return err("validation", "A reason is required for this decision.", {
      reason: ["Provide a short reason the applicant will see."],
    });

  // Confirming payment starts the membership year.
  const paidNow = to === "approved" && subject.status === "awaiting_payment";
  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setUTCFullYear(validUntil.getUTCFullYear() + 1);

  const eventIds: number[] = [];
  const STALE = Symbol("stale");
  try {
    await db.transaction(async (tx) => {
      // Compare-and-set: the update only applies if nobody changed the status
      // since it was read, so a stale click cannot record a payment.
      const updated = await tx
        .update(tables.users)
        .set({
          status: to,
          statusReason: REASON_REQUIRED.includes(to) ? reason : null,
          statusChangedAt: now,
          ...(paidNow
            ? { membershipPaidAt: now, membershipValidUntil: validUntil }
            : {}),
        })
        .where(
          and(
            eq(tables.users.id, subject.id),
            eq(tables.users.status, subject.status),
            // The destination was computed from this role (fee-exempt admins).
            eq(tables.users.role, subject.role),
          ),
        )
        .returning({ id: tables.users.id });
      if (updated.length === 0) throw STALE;

      // Tracker row 56: every member gets a number on first approval. A
      // re-approved (unsuspended) member keeps the number they had.
      if (to === "approved") await assignMemberNumber(tx, subject.id);

      const enabled =
        to === "approved" ? await enabledSections(subject.id, tx) : undefined;

      const eventName = EVENT_FOR[to];
      if (eventName) {
        // The bell is a member feature: an account awaiting payment cannot open
        // it, so that stage is told by email and the payment screen only.
        if (to !== "awaiting_payment")
          await tx.insert(tables.notifications).values({
            userId: subject.id,
            type: "account_status",
            payload: {
              status: to,
              reason: reason && !paidNow ? reason : undefined,
              ...(paidNow ? { paid: true } : {}),
              ...(enabled ? { enabledSections: enabled } : {}),
            },
          });
        eventIds.push(
          await emitEvent(tx, eventName, {
            userId: subject.id,
            ...(reason && !paidNow ? { reason } : {}),
            ...(paidNow ? { paid: true } : {}),
            ...(enabled ? { enabledSections: enabled } : {}),
          }),
        );
      }

      await recordAudit(
        {
          actorId: actor!.id,
          action: `account.${to}`,
          subjectType: "user",
          subjectId: subject.id,
          detail: {
            from: subject.status,
            ...(paidNow && subject.memberNumber == null ? { firstPaidActivation: true } : {}),
            ...(reason ? { reason } : {}),
          },
        },
        tx,
      );
    });
  } catch (e) {
    if (e !== STALE) throw e;
    return err(
      "conflict",
      "This account changed since you opened it. Reload the page and try again.",
    );
  }

  scheduleDelivery?.(eventIds);

  return ok({ status: to });
}
