"use client";

import { useActionState, useState } from "react";
import { ConsentCheckbox } from "@/components/consent-checkbox";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/contracts/result";
import { saveOptionalConsentsAction } from "@/app/consent-actions";

// Editor for the privacy notice's optional communications consent, shared by /me/edit
// and the pending/status screens. Section 10 of the notice promises a
// withdrawal mechanism comparable to the one that took the consent, so the
// wording matches the registration checkboxes and unchecking either is a
// single click. The mandatory processing consent is not editable here - it is
// what membership itself rests on.

export function OptionalConsentsForm({
  choices,
}: {
  choices: { communications: boolean };
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(saveOptionalConsentsAction, null);
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

      <ConsentCheckbox
        name="communications"
        checked={communications}
        onChange={(event) => setCommunications(event.target.checked)}
        label="Send me MCAC community updates"
        onDescription="you may receive information about events, initiatives, opportunities, and community activities."
        offDescription="you will not receive these optional updates."
        footer="This never affects your application or membership."
      />

      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving choices..." : "Save consent choices"}
        </Button>
      </div>
    </form>
  );
}
