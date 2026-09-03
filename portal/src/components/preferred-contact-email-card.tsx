"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Card, FormField, Input, Tag } from "@/components/ui";
import {
  clearPreferredContactEmailAction,
  requestPreferredContactEmailAction,
} from "@/app/contact-email-actions";
import type { ActionResult } from "@/lib/contracts/result";
import type { PreferredContactEmailState } from "@/lib/account/preferred-contact-email";

export function PreferredContactEmailCard({
  state: initial,
}: {
  state: PreferredContactEmailState;
}) {
  const [requestState, requestAction, requesting] = useActionState<
    ActionResult<{ pendingEmail: string }> | null,
    FormData
  >(requestPreferredContactEmailAction, null);
  const [clearState, clearAction, clearing] = useActionState<
    ActionResult | null,
    FormData
  >(clearPreferredContactEmailAction, null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestError = requestState && !requestState.ok ? requestState : null;
  const pendingEmail = clearState?.ok
    ? null
    : requestState?.ok
      ? requestState.data.pendingEmail
      : initial.pendingEmail;
  const statusMessage = clearState?.ok
    ? "MCAC updates will now go to your sign-in email."
    : pendingEmail
      ? `Verification sent to ${pendingEmail}. Until you verify it, MCAC will keep using ${initial.effectiveEmail}.`
      : "";

  useEffect(() => {
    if (requestError?.fieldErrors?.email) inputRef.current?.focus();
  }, [requestError]);

  return (
    <Card className="grid gap-3">
      <div>
        <h3 className="text-base font-semibold text-ink">
          Email for MCAC updates
        </h3>
        <p className="mt-0.5 text-[13px] text-ink-secondary">
          MCAC sends portal notifications to this address. Changing this does
          not change your sign-in email or LinkedIn connection.
        </p>
      </div>

      <div className="rounded-control bg-surface-subtle px-3 py-2.5 text-sm text-ink">
        <div className="flex flex-wrap items-center gap-2">
          <strong>{initial.effectiveEmail}</strong>
          <Tag selected={Boolean(initial.preferredEmail)}>
            {initial.preferredEmail ? "Verified" : "Sign-in email"}
          </Tag>
        </div>
        {initial.preferredEmail ? (
          <p className="mt-1 text-xs text-ink-secondary">
            Your sign-in email remains {initial.identityEmail}.
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-secondary">
            Updates currently go to your sign-in email.
          </p>
        )}
      </div>

      <div aria-live="polite" role="status">
        {statusMessage ? (
          <p
            className={`rounded-control border px-3 py-2.5 text-sm ${
              clearState?.ok
                ? "border-success/25 bg-success-bg font-medium text-success"
                : "border-warning/25 bg-warning-bg text-warning"
            }`}
          >
            {statusMessage}
          </p>
        ) : null}
      </div>
      {clearState && !clearState.ok ? (
        <p
          role="alert"
          className="rounded-control border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
        >
          {clearState.message}
        </p>
      ) : null}

      <form action={requestAction} className="grid gap-3" noValidate>
        <FormField
          label="Email for MCAC updates"
          htmlFor="preferred-contact-email"
          error={requestError?.fieldErrors?.email?.[0]}
        >
          <Input
            ref={inputRef}
            id="preferred-contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={pendingEmail ?? ""}
            aria-invalid={requestError?.fieldErrors?.email ? true : undefined}
            aria-describedby={
              requestError?.fieldErrors?.email
                ? "preferred-contact-email-hint preferred-contact-email-error"
                : "preferred-contact-email-hint"
            }
          />
          <small id="preferred-contact-email-hint" className="text-xs text-ink-muted">
            Enter another address. MCAC will use it only after you verify it.
          </small>
        </FormField>
        {requestError && !requestError.fieldErrors?.email ? (
          <p
            role="alert"
            className="rounded-control border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
          >
            {requestError.message}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="secondary" disabled={requesting} aria-busy={requesting}>
            {requesting ? "Sending verification email..." : "Send verification email"}
          </Button>
        </div>
      </form>

      {initial.preferredEmail || pendingEmail ? (
        <form action={clearAction} className="border-t border-border pt-3">
          <Button type="submit" variant="ghost" disabled={clearing} aria-busy={clearing}>
            {clearing
              ? initial.preferredEmail
                ? "Restoring sign-in email..."
                : "Cancelling email change..."
              : initial.preferredEmail
                ? "Use sign-in email instead"
                : "Cancel email change"}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
