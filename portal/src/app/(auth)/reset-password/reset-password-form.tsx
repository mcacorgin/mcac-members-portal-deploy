"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  if (state.done) {
    return (
      <div className="grid gap-3" role="status">
        <h3 className="text-base font-semibold text-ink">Password updated</h3>
        <p className="text-sm text-ink-secondary">
          Your new password is saved. Sign in with it to continue.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex min-h-tap items-center text-sm font-medium text-navy-text"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  const passwordError = state.fieldErrors?.password?.[0];

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      {state.error && !passwordError ? (
        <p
          role="alert"
          className="rounded-control bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
        >
          {state.error}{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-navy-text underline"
          >
            Request a new link
          </Link>
        </p>
      ) : null}
      <FormField
        label="New password"
        htmlFor="password"
        hint="At least 10 characters."
        error={passwordError}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
        />
      </FormField>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving new password..." : "Set new password"}
      </Button>
    </form>
  );
}
