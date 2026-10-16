"use client";

import { useEffect, useRef, useState } from "react";
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

/** 10px-radius avatar with initials on navy underneath and the photo on top.
 * The photo never carries alt text, so a failed image cannot show a broken
 * icon or wrapped text. Failures that happen before hydration are caught by
 * checking the element after mount. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
  decorative = false,
}: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src || !img.complete) return;
    if (img.naturalWidth === 0) setFailedSrc(src);
    else setLoadedSrc(src);
  }, [src]);

  const showPhoto = Boolean(src) && src !== failedSrc;

  return (
    <span
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": name })}
      className={cx(
        "relative grid flex-none place-items-center overflow-hidden rounded-avatar bg-navy font-semibold tracking-[0.02em] text-white",
        sizeClasses[size],
        className,
      )}
    >
      {initialsOf(name)}
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar sources are user-supplied URLs; next/image needs domain allowlisting
        <img
          ref={imgRef}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedSrc(src ?? null)}
          onError={() => setFailedSrc(src ?? null)}
          className={cx(
            "absolute inset-0 size-full object-cover",
            loadedSrc === src ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </span>
  );
}
