"use client";

import { useActionState } from "react";
import { Button, FormField, Select } from "@/components/ui";
import type { ActionResult } from "@/lib/contracts/result";
import { saveVisibility } from "./actions";

// HOME-04 contact-visibility editor: three separate per-field choices,
// never bundled, submitted through updateContactVisibility.

export type VisibilityChoice = "visible" | "hidden" | "admin_only";

const OPTIONS: { value: VisibilityChoice; label: string }[] = [
  { value: "visible", label: "Visible to approved members" },
  { value: "hidden", label: "Hidden" },
  { value: "admin_only", label: "Admin-only" },
];

function VisibilitySelect({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: VisibilityChoice;
}) {
  return (
    <Select id={id} name={name} defaultValue={defaultValue}>
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function VisibilityForm({
  defaults,
}: {
  defaults: {
    phone: VisibilityChoice;
    email: VisibilityChoice;
    linkedin: VisibilityChoice; // gitleaks:allow -- type-only field, not a credential
  };
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(saveVisibility, null);

  return (
    <form action={formAction} className="grid gap-4">
      {state?.ok ? (
        <p
          role="status"
          className="rounded-control border border-success/25 bg-success-bg px-3.5 py-2.5 font-medium text-success"
        >
          Visibility choices saved.
        </p>
      ) : null}
      {state && !state.ok ? (
        <p
          role="alert"
          className="rounded-control border border-danger/25 bg-danger-bg px-3.5 py-2.5 font-medium text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Phone" htmlFor="vis-phone">
          <VisibilitySelect
            id="vis-phone"
            name="phone"
            defaultValue={defaults.phone}
          />
        </FormField>
        <FormField label="Email" htmlFor="vis-email">
          <VisibilitySelect
            id="vis-email"
            name="email"
            defaultValue={defaults.email}
          />
        </FormField>
        <FormField label="LinkedIn" htmlFor="vis-linkedin">
          <VisibilitySelect
            id="vis-linkedin"
            name="linkedin"
            defaultValue={defaults.linkedin}
          />
        </FormField>
      </div>

      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving choices..." : "Save visibility choices"}
        </Button>
      </div>
    </form>
  );
}
