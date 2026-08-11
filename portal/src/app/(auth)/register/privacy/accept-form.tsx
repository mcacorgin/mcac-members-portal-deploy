"use client";

import { useActionState, useState } from "react";
import { Button, Checkbox, FieldError } from "@/components/ui";
import { acceptNoticeAction, type AcceptNoticeState } from "./actions";

const initialState: AcceptNoticeState = {};

/**
 * Affirmative acceptance control. The checkbox ALWAYS starts unselected and
 * the submit stays disabled until it is selected (frozen consent contract).
 */
export function AcceptForm({ version }: { version: number }) {
  const [state, formAction, pending] = useActionState(
    acceptNoticeAction,
    initialState,
  );
  const [checked, setChecked] = useState(false);

  // If the notice version changed mid-read, the fresh notice re-renders and
  // the decision starts over: uncheck so acceptance is affirmative again
  // (state adjustment during render, per React guidance).
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.conflict && checked) setChecked(false);
  }

  return (
    <form action={formAction} className="grid gap-3">
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
      <Checkbox
        name="accept"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        label="I have read and accept this privacy notice."
        description="This checkbox starts unselected every time the decision is required."
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
