import { cx } from "./cx";

export type SkeletonProps = {
  /** Size/shape the block to match the content it stands in for. */
  className?: string;
};

/** Shimmering placeholder block. Size it with className (w-*, h-*, rounded-*). */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "skeleton-shimmer min-h-3.5 rounded bg-surface-sunken",
        className,
      )}
    />
  );
}
