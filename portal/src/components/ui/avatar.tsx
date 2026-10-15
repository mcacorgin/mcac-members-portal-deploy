"use client";

import { useState } from "react";
import { initialsOf } from "@/lib/initials";
import { cx } from "./cx";

export type AvatarSize = "md" | "lg";

export type AvatarProps = {
  /** Full name; used for initials and the accessible label. */
  name: string;
  /** Optional image URL; falls back to initials when absent. */
  src?: string;
  size?: AvatarSize;
  className?: string;
  /** True when the name is already written next to the avatar (a list row,
   * a profile heading), so a screen reader does not read it twice. */
  decorative?: boolean;
};

const sizeClasses: Record<AvatarSize, string> = {
  md: "size-[38px] text-[0.78125rem]",
  lg: "size-[54px] text-base",
};

/** 10px-radius avatar with initials fallback on navy. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
  decorative = false,
}: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar sources are user-supplied URLs; next/image needs domain allowlisting
      <img
        src={src}
        alt={decorative ? "" : name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
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
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": name })}
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
