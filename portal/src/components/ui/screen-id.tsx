import { cx } from "./cx";

export type ScreenIdProps = {
  /** Stable screen identifier, e.g. "AUTH-01". */
  id: string;
  className?: string;
};

/** Small muted mono label. Every screen renders its stable ID with this. */
export function ScreenId({ id, className }: ScreenIdProps) {
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
