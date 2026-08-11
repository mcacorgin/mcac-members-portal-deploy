import { cx } from "./cx";

export type AvatarSize = "md" | "lg";

export type AvatarProps = {
  /** Full name; used for initials and the accessible label. */
  name: string;
  /** Optional image URL; falls back to initials when absent. */
  src?: string;
  size?: AvatarSize;
  className?: string;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const sizeClasses: Record<AvatarSize, string> = {
  md: "size-[38px] text-[12.5px]",
  lg: "size-[54px] text-base",
};

/** 10px-radius avatar with initials fallback on navy. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar sources are user-supplied URLs; next/image needs domain allowlisting
      <img
        src={src}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cx(
          "flex-none rounded-avatar object-cover",
          sizeClasses[size],
          className,
        )}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cx(
        "grid flex-none place-items-center rounded-avatar bg-navy font-semibold tracking-[0.02em] text-white",
        sizeClasses[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
