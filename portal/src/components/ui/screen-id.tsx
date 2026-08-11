import { cx } from "./cx";

export type ScreenIdProps = {
  /** Stable screen identifier, e.g. "AUTH-01". */
  id: string;
  className?: string;
};

/**
 * Small implementation label for local review builds. Screen IDs are useful
 * while matching routes to the specification, but are never customer-facing.
 */
export function ScreenId({ id, className }: ScreenIdProps) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <span
      className={cx(
        "ui-screen-id inline-flex items-center font-mono text-[10.5px] font-medium tracking-[0.04em] text-ink-muted",
        className,
      )}
    >
      {id}
    </span>
  );
}
