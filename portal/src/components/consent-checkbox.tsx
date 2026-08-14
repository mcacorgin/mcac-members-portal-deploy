"use client";

import type { ReactNode } from "react";
import { Checkbox, cx, type CheckboxProps } from "@/components/ui";

type ConsentCheckboxProps = Omit<
  CheckboxProps,
  "label" | "description" | "className" | "inputClassName"
> & {
  label: ReactNode;
  checked: boolean;
  onDescription: ReactNode;
  offDescription: ReactNode;
  footer?: ReactNode;
  requiredChoice?: boolean;
};

/**
 * Consent choice with a redundant text + colour state. Optional choices use
 * green only after the member affirmatively selects them.
 */
export function ConsentCheckbox({
  label,
  checked,
  onDescription,
  offDescription,
  footer,
  requiredChoice = false,
  ...props
}: ConsentCheckboxProps) {
  const activeTone = requiredChoice
    ? "border-navy/35 bg-navy-tint"
    : "border-success/35 bg-success-bg";

  return (
    <Checkbox
      {...props}
      checked={checked}
      inputClassName={requiredChoice ? "accent-navy" : "accent-success"}
      className={cx(
        "rounded-container border px-3.5 py-3.5 transition-[background-color,border-color] duration-150 ease-out-strong",
        checked ? activeTone : "border-border bg-surface",
      )}
      label={label}
      description={
        <span className="mt-1.5 grid gap-1.5">
          <span
            className={cx(
              "font-semibold",
              checked
                ? requiredChoice
                  ? "text-navy-text"
                  : "text-success"
                : "text-ink-secondary",
            )}
          >
            {checked ? "On: " : "Off: "}
            {checked ? onDescription : offDescription}
          </span>
          {footer ? <span className="text-ink-muted">{footer}</span> : null}
        </span>
      }
    />
  );
}
