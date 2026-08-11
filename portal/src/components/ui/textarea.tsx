import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

export type TextareaProps = ComponentPropsWithRef<"textarea">;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full min-h-[104px] resize-y rounded-control border border-border-strong bg-surface px-3 py-2 text-ink aria-invalid:border-danger",
        className,
      )}
    />
  );
}
