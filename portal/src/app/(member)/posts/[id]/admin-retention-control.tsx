"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { setPostRetentionExemptAction } from "../actions";

export function AdminRetentionControl({
  postId,
  exempt,
}: {
  postId: string;
  exempt: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="grid gap-2">
      <div>
        <p className="text-sm font-semibold text-ink">Attachment retention</p>
        <p className="text-sm text-ink-muted">
          {exempt
            ? "Attachments on this post are exempt from the 60-day cleanup."
            : "Attachments are eligible for cleanup 60 days after upload."}
        </p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await setPostRetentionExemptAction(postId, !exempt);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              router.refresh();
            })
          }
        >
          {pending
            ? "Saving..."
            : exempt
              ? "Return to 60-day retention"
              : "Keep attachments beyond 60 days"}
        </Button>
      </div>
    </Card>
  );
}
