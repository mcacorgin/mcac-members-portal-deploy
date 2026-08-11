"use client";

import { useActionState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import { signInWithEmail, type SignInState } from "./actions";

const initialState: SignInState = {};

export function SignInForm() {
  const [state, formAction, pending] = useActionState(
    signInWithEmail,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-control bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
        >
          {state.error}
        </p>
      ) : null}
      <FormField label="Email address" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
        />
      </FormField>
      <FormField label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
        />
      </FormField>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in..." : "Continue with email"}
      </Button>
    </form>
  );
}
