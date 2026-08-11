"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  if (state.sent) {
    return (
      <div className="grid gap-3" role="status">
        <h3 className="text-base font-semibold text-ink">Check your email</h3>
        <p className="text-sm text-ink-secondary">
          If this address belongs to an account, a time-limited reset link has
          been sent. This message does not disclose whether an account exists.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex min-h-tap items-center text-sm font-medium text-navy-text"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <FormField
        label="Email address"
        htmlFor="email"
        error={state.error}
        hint="We will send a time-limited reset link."
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "email-error" : undefined}
        />
      </FormField>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending reset link..." : "Send reset link"}
      </Button>
    </form>
  );
}
