"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FieldError, Label, Textarea } from "@/components/ui";
import { removePostAction } from "../actions";

export type AdminRemoveControlProps = {
  postId: string;
};

/**
 * Admin-only post removal (HOME-02). Two-step: reveal a required-reason form,
 * then confirm. No browser confirm dialogs.
 */
export function AdminRemoveControl({ postId }: AdminRemoveControlProps) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Remove post (admin)
      </Button>
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A removal reason is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await removePostAction(postId, trimmed);
      if (!result.ok) {
        setError(
          result.fieldErrors?.reason?.[0] ?? result.message,
        );
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="border-danger/35">
      <form onSubmit={onSubmit} className="grid gap-2" noValidate>
        <Label htmlFor={id}>Removal reason (required, recorded)</Label>
        <Textarea
          id={id}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Why is this post being removed?"
          disabled={pending}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          autoFocus
        />
        <FieldError id={`${id}-error`}>{error}</FieldError>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "Removing..." : "Confirm removal"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
