import type { ReactNode } from "react";
import { cx } from "./cx";

export type EmptyStateProps = {
  title: string;
  body: ReactNode;
  /** Optional call to action (usually a Button). */
  action?: ReactNode;
  /** Optional icon shown in a small tile (no emoji). */
  glyph?: ReactNode;
  className?: string;
};

/** Centered empty container: title + body + optional action. */
export function EmptyState({
  title,
  body,
  action,
  glyph,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        "grid min-h-60 place-content-center justify-items-center rounded-container border border-border bg-surface px-4 py-7 text-center",
        className,
      )}
    >
      {glyph ? (
        <span
          aria-hidden="true"
          className="mb-3.5 grid size-12 place-items-center rounded-avatar bg-surface-subtle text-[1.375rem] text-ink-secondary"
        >
          {glyph}
        </span>
      ) : null}
      <h2 className="mb-1.5 text-base font-semibold text-ink">{title}</h2>
      <p className="max-w-[44ch] text-pretty text-ink-secondary">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
