import Link from "next/link";
import { useId } from "react";
import { cx } from "./cx";
import mark from "../../../public/brand/mcac-mark.png";

export type BrandLockupProps = {
  /** Hide the two-line wordmark and show only the logo mark. */
  markOnly?: boolean;
  /** Optional application landing route. Use "/" so lifecycle routing stays authoritative. */
  href?: string;
  className?: string;
};

export function BrandMark({ className }: { className?: string }) {
  const filterId = useId();
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 216 312"
    >
      <filter
        id={filterId}
        colorInterpolationFilters="sRGB"
      >
        <feColorMatrix
          in="SourceGraphic"
          result="inverse-luminance"
          type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  -0.2126 -0.7152 -0.0722 0 1"
        />
        <feComponentTransfer in="inverse-luminance" result="mark-mask">
          <feFuncA type="linear" slope="12" intercept="-1.2" />
        </feComponentTransfer>
        <feComposite in="SourceGraphic" in2="mark-mask" operator="in" />
      </filter>
      <image
        filter={`url(#${filterId})`}
        height="312"
        href={mark.src}
        width="216"
      />
    </svg>
  );
}

/**
 * MCAC brand lockup using the client-supplied mark (received 2026-07-23).
 * The raster is provisional until the vector source arrives; the mark is the
 * only place the brand's gold/ochre appears in the UI.
 */
export function BrandLockup({
  markOnly = false,
  href,
  className,
}: BrandLockupProps) {
  const content = (
    <>
      <BrandMark className="h-9 w-auto flex-none" />
      {!markOnly ? (
        <span className="min-w-0">
          <strong className="block truncate text-[14.5px] font-semibold text-ink">
            MCAC
          </strong>
          <span className="block text-[11.5px] leading-tight text-ink-muted">
            Marathi Corporate Advisory Collective
          </span>
        </span>
      ) : null}
    </>
  );

  const rootClassName = cx(
    "ui-brand-lockup flex min-w-0 items-center gap-2.5 rounded-control",
    href &&
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
    className,
  );

  return href ? (
    <Link href={href} aria-label="MCAC home" className={rootClassName}>
      {content}
    </Link>
  ) : (
    <span className={rootClassName}>{content}</span>
  );
}
