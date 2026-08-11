"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError } from "@/components/ui";
import { unlinkLinkedInAction } from "./link-actions";

export function UnlinkLinkedInButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        aria-label={`Disconnect LinkedIn for ${name}`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await unlinkLinkedInAction(userId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Disconnecting..." : "Disconnect LinkedIn"}
      </Button>
      <FieldError>{error}</FieldError>
    </div>
  );
}
