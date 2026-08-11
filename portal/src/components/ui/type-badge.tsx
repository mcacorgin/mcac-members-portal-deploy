import type { ComponentPropsWithRef } from "react";
import type { PostTypeName } from "@/lib/posts/types";
import { TYPE_LABELS } from "@/app/(member)/posts/display";
import { cx } from "./cx";

// Portal-wide post-type visual system (UX cohesion round, Task 4).
// One accent per type, always paired with an icon and the TYPE_LABELS
// text so type is never conveyed by color alone. See globals.css for
// the OKLCH derivation and contrast notes on the --type-* tokens.

type IconProps = { className?: string };

/** opportunity: a four-point spark/sparkle. */
function SparkIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 2c.5 2.3 1.1 3.6 2.1 4.6C11.1 7.6 12.3 8 14 8c-1.7 0-2.9.4-3.9 1.4C9.1 10.4 8.5 11.7 8 14c-.5-2.3-1.1-3.6-2.1-4.6C4.9 8.4 3.7 8 2 8c1.7 0 2.9-.4 3.9-1.4C6.9 5.6 7.5 4.3 8 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** job: a briefcase. */
function BriefcaseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="2"
        y="5.5"
        width="12"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6 5.5V4a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 10 4v1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M2 9.5h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** knowledge: an open book. */
function BookIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 3.5C3 2.7 3.7 2 4.5 2H8v11.5H4.5C3.7 13.5 3 12.8 3 12V3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M13 3.5C13 2.7 12.3 2 11.5 2H8v11.5h3.5c.8 0 1.5-.7 1.5-1.5V3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** event: a calendar. */
function CalendarIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="2"
        y="3"
        width="12"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M2 6.5h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5.5 1.5v3M10.5 1.5v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="9.7" r="0.9" fill="currentColor" />
    </svg>
  );
}

const TYPE_ICON_COMPONENTS: Record<
  PostTypeName,
  (props: IconProps) => React.JSX.Element
> = {
  opportunity: SparkIcon,
  job: BriefcaseIcon,
  knowledge: BookIcon,
  event: CalendarIcon,
};

/** Standalone 16px type icon, for surfaces that render their own pill
 * chrome (e.g. the composer's type picker) and only need the glyph. */
export function TypeIcon({
  type,
  className,
}: {
  type: PostTypeName;
  className?: string;
}) {
  const Icon = TYPE_ICON_COMPONENTS[type];
  return <Icon className={cx("size-4 flex-none", className)} />;
}

/** Tinted pill: icon + label, one accent color per type. */
const TYPE_TINT_CLASSES: Record<PostTypeName, string> = {
  opportunity:
    "bg-[var(--type-opportunity-bg)] text-[var(--type-opportunity)]",
  job: "bg-[var(--type-job-bg)] text-[var(--type-job)]",
  knowledge: "bg-[var(--type-knowledge-bg)] text-[var(--type-knowledge)]",
  event: "bg-[var(--type-event-bg)] text-[var(--type-event)]",
};

/** Solid fill: white text/icon on the type's ink color. Used for the
 * composer picker's selected state instead of the old uniform navy. */
export const TYPE_ACCENT_FILL_CLASSES: Record<PostTypeName, string> = {
  opportunity: "border-[var(--type-opportunity)] bg-[var(--type-opportunity)]",
  job: "border-[var(--type-job)] bg-[var(--type-job)]",
  knowledge: "border-[var(--type-knowledge)] bg-[var(--type-knowledge)]",
  event: "border-[var(--type-event)] bg-[var(--type-event)]",
};

export type TypeBadgeSize = "sm" | "md";

export type TypeBadgeProps = ComponentPropsWithRef<"span"> & {
  type: PostTypeName;
  size?: TypeBadgeSize;
};

/** Icon + label pill identifying a post's type (opportunity / job /
 * knowledge / event). Replaces the old plain neutral `Tag` type label
 * in feed cards and post detail. AA contrast on its own tint (see
 * globals.css); label always renders so type is never color-only. */
export function TypeBadge({
  type,
  size = "sm",
  className,
  ...props
}: TypeBadgeProps) {
  return (
    <span
      {...props}
      data-testid="type-badge"
      aria-label={TYPE_LABELS[type]}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "md"
          ? "min-h-7 px-3 py-1 text-[13px]"
          : "min-h-6 px-2.5 py-0.5 text-xs",
        TYPE_TINT_CLASSES[type],
        className,
      )}
    >
      <TypeIcon type={type} />
      {TYPE_LABELS[type]}
    </span>
  );
}
