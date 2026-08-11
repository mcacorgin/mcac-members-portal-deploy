"use client";

import { useActionState } from "react";
import { Button, FormField, Select } from "@/components/ui";
import { saveVisibilityAction, type VisibilityState } from "./actions";

const initialState: VisibilityState = {};

const FIELDS = [
  {
    name: "phone",
    label: "Phone",
    defaultValue: "hidden",
    hint: "Who can see your phone number in the member directory.",
  },
  {
    name: "email",
    label: "Email",
    defaultValue: "admin_only",
    hint: "Who can see your email address in the member directory.",
  },
  {
    name: "linkedin",
    label: "LinkedIn",
    defaultValue: "visible",
    hint: "Who can see your LinkedIn profile link in the member directory.",
  },
] as const;

export function VisibilityForm() {
  const [state, formAction, pending] = useActionState(
    saveVisibilityAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-control bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
        >
          {state.error} Your choices are still shown below; review and retry.
        </p>
      ) : null}
      {FIELDS.map((field) => (
        <FormField
          key={field.name}
          label={field.label}
          htmlFor={field.name}
          hint={field.hint}
        >
          <Select
            id={field.name}
            name={field.name}
            defaultValue={state.values?.[field.name] ?? field.defaultValue}
          >
            <option value="visible">Visible to approved members</option>
            <option value="hidden">Hidden</option>
            <option value="admin_only">Admin-only</option>
          </Select>
        </FormField>
      ))}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving choices..." : "Save choices and continue"}
      </Button>
    </form>
  );
}
