import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
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
    return err("forbidden", "Administrators cannot change their own account status.");

  // Suspending then unsuspending must never skip the fee: only an account
  // whose paid year is still running goes straight back to approved.
  const to: Viewer["status"] =
    input.to === "approved" &&
    subject.status === "suspended" &&
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
    const { hasCurrentConsent, getEvidenceStatus } = await import(
      "@/lib/account/registration"
    );
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
  await db.transaction(async (tx) => {
    await tx
      .update(tables.users)
      .set({
        status: to,
        statusReason: REASON_REQUIRED.includes(to) ? reason : null,
        statusChangedAt: now,
        ...(paidNow
          ? { membershipPaidAt: now, membershipValidUntil: validUntil }
          : {}),
      })
      .where(eq(tables.users.id, subject.id));

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
        detail: { from: subject.status, ...(reason ? { reason } : {}) },
      },
      tx,
    );
  });

  scheduleDelivery?.(eventIds);

  return ok({ status: to });
}
