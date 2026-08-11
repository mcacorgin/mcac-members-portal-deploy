import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

export type InputProps = ComponentPropsWithRef<"input">;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={cx(
        "w-full min-h-tap rounded-control border border-border-strong bg-surface px-3 py-2 text-ink aria-invalid:border-danger",
        className,
      )}
    />
  );
}
