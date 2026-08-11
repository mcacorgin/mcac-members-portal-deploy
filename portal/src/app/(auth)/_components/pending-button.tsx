"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui";

export type PendingButtonProps = {
  children: ReactNode;
  /** Label swapped in while the surrounding form is submitting. */
  pendingLabel: string;
  variant?: ButtonVariant;
  className?: string;
};

/**
 * Submit button that disables itself and shows progress copy while the
 * nearest form's server action is in flight. Must render INSIDE a <form>.
 */
export function PendingButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
}: PendingButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
