import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

export type TagProps = ComponentPropsWithRef<"span"> & {
  /** Highlight with the navy tint (e.g. a selected expertise tag). */
  selected?: boolean;
};

/** Pill tag for expertise areas and similar short labels. */
export function Tag({ selected = false, className, ...props }: TagProps) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        selected
          ? "bg-navy-tint text-navy-text"
          : "bg-surface-subtle text-ink-secondary",
        className,
      )}
    />
  );
}
