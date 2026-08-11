"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  FieldError,
  FormField,
  Textarea,
} from "@/components/ui";
import type { Viewer } from "@/lib/authz";
import { decideAction } from "./actions";

type Status = Viewer["status"];

// Decisions that require a written reason open an inline confirmation form.
type ReasonDecision = {
  to: Status;
  label: string;
  confirmLabel: string;
  hint: string;
};

const REASON_DECISIONS: Record<string, ReasonDecision> = {
  needs_changes: {
    to: "needs_changes",
    label: "Request changes",
    confirmLabel: "Confirm request for changes",
    hint: "The applicant sees this reason and can amend and resubmit.",
  },
  rejected: {
    to: "rejected",
    label: "Reject",
    confirmLabel: "Confirm rejection",
    hint: "The applicant sees this reason. Rejected accounts get no member access.",
  },
  suspended: {
    to: "suspended",
    label: "Suspend",
    confirmLabel: "Confirm suspension",
    hint: "The member loses access immediately and sees this reason.",
  },
};

export function DecisionPanel({
  userId,
  status,
  acceptedCurrent,
  evidence,
}: {
  userId: string;
  status: Status;
  acceptedCurrent: boolean;
  evidence: { complete: boolean; missing: string[] };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<keyof typeof REASON_DECISIONS | null>(null);
  const [confirming, setConfirming] = useState<"approved" | "rejected" | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  // Evidence completeness only gates pending/needs_changes -> approved
  // (lib/account/lifecycle.ts, docs/build/state-machines.md). Unsuspend
  // (suspended -> approved) keeps the consent-only gate it had before this
  // branch - it must not be blocked by stale evidence on an already-approved
  // member.
  const consentBlocked = !acceptedCurrent;
  const evidenceBlocked = !evidence.complete;
  const approveBlocked = consentBlocked || evidenceBlocked;
  const unsuspendBlocked = consentBlocked;

  useEffect(() => {
    if (confirming) confirmationRef.current?.focus();
  }, [confirming]);

  function run(to: Status, withReason?: string, doneMessage?: string) {
    setError(null);
    setReasonError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await decideAction(userId, to, withReason);
      if (!result.ok) {
        const nextReasonError = result.fieldErrors?.reason?.[0] ?? null;
        setReasonError(nextReasonError);
        setError(nextReasonError ? null : result.message);
        if (nextReasonError && to === "rejected") setConfirming(null);
        return;
      }
      setMode(null);
      setConfirming(null);
      setReason("");
      setSuccess(doneMessage ?? "Decision recorded.");
      router.refresh();
    });
  }

  const openReasonForm = (key: keyof typeof REASON_DECISIONS) => {
    setMode(key);
    setConfirming(null);
    setError(null);
    setReasonError(null);
    setSuccess(null);
  };

  const canApprove =
    status === "pending" || status === "needs_changes";

  return (
    <Card data-testid="decision-panel">
      <h3 className="mb-1 text-base font-semibold text-ink">Decision</h3>
      <p className="mb-3 text-sm text-ink-secondary">
        Every decision is recorded in the audit log with your name.
      </p>

      {(consentBlocked || (canApprove && evidenceBlocked)) &&
      (canApprove || status === "suspended") ? (
        <div
          className="mb-3 grid gap-2 rounded-container bg-warning-bg p-3"
          data-testid="consent-warning"
        >
          {consentBlocked ? (
            <p className="text-sm font-medium text-warning">
              Privacy audit incomplete - approval is disabled until the
              applicant accepts the current privacy notice.
            </p>
          ) : null}
          {canApprove && evidenceBlocked ? (
            <p className="text-sm font-medium text-warning">
              Application evidence incomplete - approval is disabled until the
              applicant provides: {evidence.missing.join(", ")}.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2">
        {canApprove ? (
          <Button
            onClick={() => {
              setMode(null);
              setConfirming("approved");
              setError(null);
              setReasonError(null);
              setSuccess(null);
            }}
            disabled={approveBlocked || pending}
            data-testid="approve-button"
          >
            Approve
          </Button>
        ) : null}

        {canApprove ? (
          <Button
            variant="secondary"
            onClick={() => openReasonForm("needs_changes")}
            disabled={pending}
            data-testid="needs-changes-button"
          >
            Request changes
          </Button>
        ) : null}

        {canApprove ? (
          <Button
            variant="destructive"
            onClick={() => openReasonForm("rejected")}
            disabled={pending}
            data-testid="reject-button"
          >
            Reject
          </Button>
        ) : null}

        {status === "approved" ? (
          <Button
            variant="destructive"
            onClick={() => openReasonForm("suspended")}
            disabled={pending}
            data-testid="suspend-button"
          >
            Suspend
          </Button>
        ) : null}

        {status === "suspended" ? (
          <Button
            onClick={() => run("approved", undefined, "Account unsuspended.")}
            disabled={unsuspendBlocked || pending}
            data-testid="unsuspend-button"
          >
            {pending ? "Working..." : "Unsuspend"}
          </Button>
        ) : null}

        {status === "rejected" ? (
          <Button
            variant="secondary"
            onClick={() =>
              run("pending", undefined, "Application moved back to pending.")
            }
            disabled={pending}
            data-testid="readmit-button"
          >
            Move back to pending
          </Button>
        ) : null}
      </div>

      {confirming ? (
        <div
          ref={confirmationRef}
          className={`mt-3 rounded-container border p-3 ${
            confirming === "rejected"
              ? "border-danger/35 bg-danger-bg"
              : "border-border bg-surface-subtle"
          }`}
          role="group"
          aria-labelledby="decision-confirm-title"
          tabIndex={-1}
          data-testid="decision-confirmation"
        >
          <h4
            className="text-sm font-semibold text-ink"
            id="decision-confirm-title"
          >
            {confirming === "approved"
              ? "Approve this application?"
              : "Reject this application?"}
          </h4>
          <p className="mt-1 text-sm text-ink-secondary">
            {confirming === "approved"
              ? "The applicant will get member access immediately. The audit log will record your decision."
              : "The applicant will not get member access. They will see the reason below."}
          </p>
          {confirming === "rejected" ? (
            <p className="mt-2 rounded-control bg-surface px-3 py-2 text-sm text-ink">
              {reason.trim()}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={confirming === "rejected" ? "destructive" : "primary"}
              disabled={pending}
              data-testid={
                confirming === "approved"
                  ? "confirm-approve"
                  : "confirm-reject"
              }
              onClick={() =>
                run(
                  confirming,
                  confirming === "rejected" ? reason.trim() : undefined,
                  confirming === "approved"
                    ? "Application approved."
                    : "Decision recorded and the applicant was notified.",
                )
              }
            >
              {pending
                ? "Saving..."
                : confirming === "approved"
                  ? "Approve application"
                  : "Reject application"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(null)}
              disabled={pending}
            >
              {confirming === "rejected" ? "Back" : "Cancel"}
            </Button>
          </div>
        </div>
      ) : null}

      {mode && confirming !== "rejected" ? (
        <form
          className="mt-3 grid gap-2 border-t border-border pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const decision = REASON_DECISIONS[mode];
            if (mode === "rejected") {
              if (!reason.trim()) {
                setReasonError(
                  "Provide a short reason the applicant will see.",
                );
                return;
              }
              setReasonError(null);
              setConfirming("rejected");
              return;
            }
            run(
              decision.to,
              reason,
              decision.label === "Suspend"
                ? "Account suspended."
                : "Decision recorded and the applicant was notified.",
            );
          }}
        >
          <FormField
            label={`Reason for "${REASON_DECISIONS[mode].label}"`}
            htmlFor="decision-reason"
            hint={REASON_DECISIONS[mode].hint}
            error={reasonError}
          >
            <Textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              aria-invalid={reasonError ? "true" : undefined}
              aria-describedby={reasonError ? "decision-reason-error" : undefined}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending} data-testid="confirm-decision">
              {pending
                ? "Saving..."
                : mode === "rejected"
                  ? "Review rejection"
                  : REASON_DECISIONS[mode].confirmLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMode(null);
                setConfirming(null);
                setReasonError(null);
                setReason("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <FieldError className="mt-3" role="alert">
          {error}
        </FieldError>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm font-medium text-success" role="status">
          {success}
        </p>
      ) : null}
    </Card>
  );
}
