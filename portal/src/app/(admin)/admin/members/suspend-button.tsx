"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Input } from "@/components/ui";
import { decideAction } from "../applications/[id]/actions";

/** ADMIN-04 quick action: suspend an approved member with a required reason. */
export function SuspendButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await decideAction(userId, "suspended", reason);
      if (!result.ok) {
        setError(result.fieldErrors?.reason?.[0] ?? result.message);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
        aria-label={`Suspend ${name}`}
      >
        Suspend
      </Button>
    );
  }

  return (
    <form onSubmit={confirm} className="grid min-w-52 gap-1.5">
      <Input
        aria-label={`Reason for suspending ${name}`}
        placeholder="Reason (shown to the member)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        autoFocus
        className="text-sm"
      />
      <FieldError>{error}</FieldError>
      <div className="flex gap-1.5">
        <Button size="sm" variant="destructive" type="submit" disabled={pending}>
          {pending ? "Suspending..." : "Confirm"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
