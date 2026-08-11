import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type ButtonAsButton = BaseProps &
  ComponentPropsWithRef<"button"> & { href?: undefined };

type ButtonAsLink = BaseProps &
  ComponentPropsWithRef<"a"> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-navy bg-navy text-white hover:border-navy-hover hover:bg-navy-hover disabled:border-surface-sunken disabled:bg-surface-sunken disabled:text-ink-muted aria-disabled:border-surface-sunken aria-disabled:bg-surface-sunken aria-disabled:text-ink-muted",
  secondary:
    "border border-border-strong bg-surface text-ink hover:bg-surface-subtle disabled:border-surface-sunken disabled:bg-surface-sunken disabled:text-ink-muted aria-disabled:border-surface-sunken aria-disabled:bg-surface-sunken aria-disabled:text-ink-muted",
  ghost:
    "border border-transparent bg-transparent text-navy-text hover:bg-surface-subtle disabled:text-ink-muted aria-disabled:text-ink-muted",
  destructive:
    "border border-danger/35 bg-surface text-danger hover:bg-danger-bg disabled:border-surface-sunken disabled:bg-surface-sunken disabled:text-ink-muted aria-disabled:border-surface-sunken aria-disabled:bg-surface-sunken aria-disabled:text-ink-muted",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-tap px-3 text-sm",
  md: "min-h-tap px-4",
  lg: "min-h-12 px-5 text-base",
};

const baseClasses =
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-control font-medium no-underline transition-[color,background-color,border-color,scale] duration-150 ease-out-strong active:scale-[0.97] disabled:cursor-not-allowed aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed";

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, ...rest } = props;
  const classes = cx(
    baseClasses,
    "ui-button",
    `ui-button-${variant}`,
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (rest.href !== undefined) {
    return <a {...(rest as ComponentPropsWithRef<"a">)} className={classes} />;
  }

  const { type = "button", ...buttonRest } =
    rest as ComponentPropsWithRef<"button">;
  return <button {...buttonRest} type={type} className={classes} />;
}
