import type { ReactNode } from "react";
import { cx } from "./cx";

export type ErrorStateProps = {
  title: string;
  body: ReactNode;
  /** Optional recovery action (usually a retry Button). */
  action?: ReactNode;
  className?: string;
};

/** Centered error container: title + body + optional recovery action. */
export function ErrorState({ title, body, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cx(
        "grid min-h-60 place-content-center justify-items-center rounded-container border border-border bg-surface px-4 py-7 text-center",
        className,
      )}
    >
      <h3 className="mb-1.5 text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-[44ch] text-ink-secondary">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
