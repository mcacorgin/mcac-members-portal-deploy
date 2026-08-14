"use client";

import { useActionState, useState } from "react";
import { ConsentCheckbox } from "@/components/consent-checkbox";
import { Button, FieldError } from "@/components/ui";
import { acceptNoticeAction, type AcceptNoticeState } from "./actions";

const initialState: AcceptNoticeState = {};

/**
 * Affirmative acceptance control. The checkbox ALWAYS starts unselected and
 * the submit stays disabled until it is selected (frozen consent contract).
 */
export function AcceptForm({
  version,
  choices,
}: {
  version: number;
  choices: {
    communications: boolean;
    directory: boolean;
    directoryDecided: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(
    acceptNoticeAction,
    initialState,
  );
  const [checked, setChecked] = useState(false);
  // Seeded from the stored answers, NOT from false: re-accepting a new notice
  // version must not silently revoke an optional consent the member gave
  // earlier. Starting unchecked is how consent is granted affirmatively; it is
  // not how consent gets withdrawn.
  const [communications, setCommunications] = useState(choices.communications);
  // An inherited listing is not an answer: a member who was never asked sees
  // this unticked, so accepting cannot manufacture a consent they never gave.
  const directorySeed = choices.directoryDecided ? choices.directory : false;
  const [directory, setDirectory] = useState(directorySeed);

  // If the notice version changed mid-read, the fresh notice re-renders and
  // the decision starts over: uncheck so acceptance is affirmative again
  // (state adjustment during render, per React guidance). The optional
  // communications choice resets with it - it was made against wording the
  // applicant is no longer reading.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.conflict && checked) setChecked(false);
    if (state.conflict && communications !== choices.communications)
      setCommunications(choices.communications);
    if (state.conflict && directory !== directorySeed)
      setDirectory(directorySeed);
  }

  return (
    <form action={formAction} className="grid gap-3.5">
      <input type="hidden" name="version" value={version} />
      {state.conflict ? (
        <p
          role="alert"
          className="rounded-control bg-warning-bg px-3 py-2.5 text-sm font-medium text-warning"
        >
          The privacy notice changed while you were reading. The current
          version is shown above; review it before accepting.
        </p>
      ) : null}
      <FieldError>{state.error}</FieldError>
      <ConsentCheckbox
        name="accept"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        requiredChoice
        label="I agree to MCAC processing my information to evaluate and manage my membership."
        onDescription="your membership application can continue."
        offDescription="your application cannot continue."
        footer="Required. This always starts off when a new notice version needs your agreement."
      />
      <ConsentCheckbox
        name="directory"
        checked={directory}
        onChange={(event) => setDirectory(event.target.checked)}
        label="List me in the MCAC member directory"
        onDescription="approved members can find you in People and search, and tag you in posts."
        offDescription="you stay out of People, member search, and post tagging."
        footer="Optional. Posts you publish still show your name and photo. Change this later in Me → Edit profile."
      />
      <ConsentCheckbox
        name="communications"
        checked={communications}
        onChange={(event) => setCommunications(event.target.checked)}
        label="Send me MCAC community updates"
        onDescription="you may receive information about events, initiatives, opportunities, and community activities."
        offDescription="you will not receive these optional updates."
        footer="Optional. This never affects your application or membership. Change it later in Me → Edit profile."
      />
      <Button
        type="submit"
        disabled={!checked || pending}
        aria-busy={pending}
      >
        {pending ? "Recording acceptance..." : "Accept and continue"}
      </Button>
    </form>
  );
}
