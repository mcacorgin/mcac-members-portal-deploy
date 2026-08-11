"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, FieldError, FormField, Input } from "@/components/ui";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );
  const duplicate = state.code === "conflict";

  return (
    <form action={formAction} className="grid gap-4">
      {state.message && !state.fieldErrors && !duplicate ? (
        <p
          role="alert"
          className="rounded-control bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
        >
          {state.message}
        </p>
      ) : null}
      <FormField
        label="Full name"
        htmlFor="name"
        error={state.fieldErrors?.name?.[0]}
      >
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          defaultValue={state.values?.name}
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
        />
      </FormField>
      <FormField label="Email address" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={state.fieldErrors?.email || duplicate ? true : undefined}
          aria-describedby={
            state.fieldErrors?.email || duplicate ? "email-error" : undefined
          }
        />
        {duplicate ? (
          <p id="email-error" className="text-[13px] font-medium text-danger">
            An account already exists for this email.{" "}
            <Link
              href="/sign-in"
              className="font-medium text-navy-text underline"
            >
              Sign in instead
            </Link>
            .
          </p>
        ) : (
          <FieldError id="email-error">
            {state.fieldErrors?.email?.[0]}
          </FieldError>
        )}
      </FormField>
      <FormField
        label="Password"
        htmlFor="password"
        hint="At least 10 characters."
        error={state.fieldErrors?.password?.[0]}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-invalid={state.fieldErrors?.password ? true : undefined}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
        />
      </FormField>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Creating your account..." : "Create account and continue"}
      </Button>
    </form>
  );
}
