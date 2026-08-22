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

  if (!canTransitionAccount(subject.status, input.to))
    return err(
      "conflict",
      `Cannot move an account from ${subject.status} to ${input.to}.`,
    );

  // ADMIN-02: approval is disabled until the privacy audit is complete -
  // the applicant must have accepted the current notice version.
  if (input.to === "approved") {
    const { hasCurrentConsent, getEvidenceStatus } = await import(
      "@/lib/account/registration"
    );
    if (!(await hasCurrentConsent(subject.id)))
      return err(
        "conflict",
        "Privacy audit incomplete: the applicant has not accepted the current privacy notice.",
      );

    // Evidence completeness only gates the pending/needs_changes -> approved
    // path (docs/build/state-machines.md "Approval preconditions"). It must
    // NOT block suspended -> approved (unsuspend): an already-approved
    // member's evidence can go stale after the fact (e.g. an admin edit)
    // without that locking them out of their own account.
    if (
      subject.status === "pending" ||
      subject.status === "needs_changes"
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
  if (REASON_REQUIRED.includes(input.to) && !reason)
    return err("validation", "A reason is required for this decision.", {
      reason: ["Provide a short reason the applicant will see."],
    });

  const eventIds: number[] = [];
  await db.transaction(async (tx) => {
    await tx
      .update(tables.users)
      .set({
        status: input.to,
        statusReason: REASON_REQUIRED.includes(input.to) ? reason : null,
        statusChangedAt: new Date(),
      })
      .where(eq(tables.users.id, subject.id));

    const enabled =
      input.to === "approved" ? await enabledSections(subject.id, tx) : undefined;

    const eventName = EVENT_FOR[input.to];
    if (eventName) {
      await tx.insert(tables.notifications).values({
        userId: subject.id,
        type: "account_status",
        payload: {
          status: input.to,
          reason: reason || undefined,
          ...(enabled ? { enabledSections: enabled } : {}),
        },
      });
      eventIds.push(
        await emitEvent(tx, eventName, {
          userId: subject.id,
          ...(reason ? { reason } : {}),
          ...(enabled ? { enabledSections: enabled } : {}),
        }),
      );
    }

    await recordAudit(
      {
        actorId: actor!.id,
        action: `account.${input.to}`,
        subjectType: "user",
        subjectId: subject.id,
        detail: { from: subject.status, ...(reason ? { reason } : {}) },
      },
      tx,
    );
  });

  scheduleDelivery?.(eventIds);

  return ok({ status: input.to });
}
