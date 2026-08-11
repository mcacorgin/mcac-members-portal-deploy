import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

export type LabelProps = ComponentPropsWithRef<"label">;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      {...props}
      className={cx("block text-[13px] font-medium text-ink", className)}
    />
  );
}
