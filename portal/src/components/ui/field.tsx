import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";
import { Label } from "./label";

export type FieldErrorProps = ComponentPropsWithRef<"p">;

export function FieldError({ className, children, ...props }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p
      {...props}
      className={cx("text-[13px] font-medium text-danger", className)}
    >
      {children}
    </p>
  );
}

export type FormFieldProps = {
  /** Visible field label. */
  label: ReactNode;
  /** id of the control inside; wires label and error to it. */
  htmlFor?: string;
  /** Optional helper line under the control. */
  hint?: ReactNode;
  /** Validation error; rendered below the control. */
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Label + control + hint/error stack. Pass `htmlFor` matching the control id.
 * When showing an error, also set aria-invalid and aria-describedby
 * ({id}-error) on the control.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cx("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? (
        <small className="text-xs text-ink-muted">{hint}</small>
      ) : null}
      <FieldError id={htmlFor ? `${htmlFor}-error` : undefined}>
        {error}
      </FieldError>
    </div>
  );
}
