"use client";

import { useActionState, useState } from "react";
import { Button, Checkbox } from "@/components/ui";
import type { ActionResult } from "@/lib/contracts/result";
import { saveOptionalConsentsAction } from "@/app/consent-actions";

// Editor for the privacy notice's two optional consents, shared by /me/edit
// and the pending/status screens. Section 10 of the notice promises a
// withdrawal mechanism comparable to the one that took the consent, so the
// wording matches the registration checkboxes and unchecking either is a
// single click. The mandatory processing consent is not editable here - it is
// what membership itself rests on.

export function OptionalConsentsForm({
  choices,
}: {
  choices: { communications: boolean; directory: boolean };
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(saveOptionalConsentsAction, null);
  const [directory, setDirectory] = useState(choices.directory);
  const [communications, setCommunications] = useState(choices.communications);

  return (
    <form action={formAction} className="grid gap-3">
      {state?.ok ? (
        <p
          role="status"
          className="rounded-control border border-success/25 bg-success-bg px-3.5 py-2.5 font-medium text-success"
        >
          Consent choices saved.
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

      <Checkbox
        name="directory"
        checked={directory}
        onChange={(event) => setDirectory(event.target.checked)}
        label="I agree that my name, professional designation, organisation, areas of expertise and LinkedIn profile may be visible to other MCAC members for professional networking and collaboration."
        description="Unselecting this removes you from the member directory and its search, and removes you from posts you were tagged in. Anything you published yourself still carries your name and photo."
      />
      <Checkbox
        name="communications"
        checked={communications}
        onChange={(event) => setCommunications(event.target.checked)}
        label="I would like to receive information about MCAC events, initiatives, opportunities and community activities."
        description="Unselecting this withdraws your consent for these messages; it does not affect your membership."
      />

      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving choices..." : "Save consent choices"}
        </Button>
      </div>
    </form>
  );
}
