import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

export type CardProps = ComponentPropsWithRef<"div">;

/** Surface container: 12px radius, single hairline border, white surface. */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cx(
        "ui-card rounded-container border border-border bg-surface p-4 shadow-card",
        className,
      )}
    />
  );
}
