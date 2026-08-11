import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

export type SelectProps = ComponentPropsWithRef<"select">;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={cx(
        "w-full min-h-tap cursor-pointer rounded-control border border-border-strong bg-surface px-3 text-ink aria-invalid:border-danger",
        className,
      )}
    >
      {children}
    </select>
  );
}
