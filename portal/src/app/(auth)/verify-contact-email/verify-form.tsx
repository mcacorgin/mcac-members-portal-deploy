"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { verifyPreferredContactEmailAction } from "@/app/contact-email-actions";
import type { ActionResult } from "@/lib/contracts/result";

export function VerifyContactEmailForm({ token }: { token: string }) {
  const returnTo = `/verify-contact-email?token=${encodeURIComponent(token)}`;
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(verifyPreferredContactEmailAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <div className="grid gap-3">
          <p
            role="alert"
            className="rounded-control border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
          >
            {state.message}
          </p>
          {state.code === "unauthorized" ? (
            <Button
              href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
              variant="secondary"
            >
              Sign in to verify
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" disabled={pending || !token} aria-busy={pending}>
        {pending ? "Verifying..." : "Confirm communication email"}
      </Button>
    </form>
  );
}
