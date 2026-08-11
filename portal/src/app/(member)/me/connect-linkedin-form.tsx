"use client";

import { useActionState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import type { ActionResult } from "@/lib/contracts/result";
import { connectLinkedIn } from "./actions";

/**
 * Password re-entry guards linking: a borrowed session must not be enough to
 * attach a second way into the account.
 */
export function ConnectLinkedInForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(connectLinkedIn, null);
  const fieldError = state && !state.ok ? state.fieldErrors?.password?.[0] : undefined;

  return (
    <form action={formAction} className="grid gap-3">
      {state && !state.ok && !fieldError ? (
        <p
          role="alert"
          className="rounded-control border border-danger/25 bg-danger-bg px-3.5 py-2.5 font-medium text-danger"
        >
          {state.message}
        </p>
      ) : null}
      <FormField
        label="Your password"
        htmlFor="link-password"
        hint="Confirm it is you before we connect another way to sign in."
        error={fieldError}
      >
        <Input
          id="link-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "link-password-error" : undefined}
        />
      </FormField>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Connecting..." : "Connect LinkedIn"}
        </Button>
      </div>
    </form>
  );
}
