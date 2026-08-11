"use client";

import { useActionState } from "react";
import { Button, FieldError, Input } from "@/components/ui";
import { removePostAction, type RemovePostState } from "./moderation-actions";

const initialState: RemovePostState = { status: "idle" };

export function RemovePostForm({ postId }: { postId: string }) {
  const [state, formAction, pending] = useActionState(
    removePostAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="postId" value={postId} />
      <div className="min-w-56 flex-1">
        <Input
          name="reason"
          placeholder="Reason shown in the audit log (required)"
          aria-label="Removal reason"
          required
        />
        {state.status === "error" ? (
          <FieldError>{state.message}</FieldError>
        ) : null}
      </div>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Removing..." : "Remove post"}
      </Button>
    </form>
  );
}
