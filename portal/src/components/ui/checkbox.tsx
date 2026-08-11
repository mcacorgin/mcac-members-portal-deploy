import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";

export type CheckboxProps = Omit<
  ComponentPropsWithRef<"input">,
  "type" | "children"
> & {
  /** Main label text shown next to the box. */
  label: ReactNode;
  /** Optional secondary line under the label. */
  description?: ReactNode;
};

/**
 * Labeled checkbox. The whole label is the touch target (min 44px),
 * matching the wireframe "choice" pattern.
 */
export function Checkbox({
  label,
  description,
  className,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cx(
        "grid min-h-tap cursor-pointer grid-cols-[22px_1fr] items-start gap-x-2.5 py-2.5",
        className,
      )}
    >
      <input
        {...props}
        type="checkbox"
        className="mt-0.5 size-5 accent-navy"
      />
      <span className="font-medium text-ink">
        {label}
        {description ? (
          <small className="mt-0.5 block text-sm font-normal text-ink-secondary">
            {description}
          </small>
        ) : null}
      </span>
    </label>
  );
}
