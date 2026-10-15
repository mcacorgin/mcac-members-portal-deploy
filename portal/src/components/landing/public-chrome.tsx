import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup, Button } from "@/components/ui";
import { AdminContactLine } from "@/components/admin-contact-line";

/**
 * Header and footer for the pages anyone can open without signing in: the
 * landing page, the public privacy notice and the 404 page.
 */

export const publicShell = "mx-auto w-full max-w-6xl px-5 sm:px-8";

const footerLink =
  "inline-flex min-h-tap items-center font-medium text-navy-text";

/**
 * The lockup takes an 8rem basis so the header wraps only when the two
 * actions truly cannot share its row (320px at large text sizes). At normal
 * sizes, down to 320px, lockup and actions stay on one line.
 */
export function PublicHeader({
  lockupHref,
  children,
}: {
  /** Link the lockup home. Leave unset on the landing page itself. */
  lockupHref?: string;
  /** Header actions, usually <PublicNav />. */
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div
        className={`${publicShell} flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5 sm:gap-x-4`}
      >
        <div className="min-w-0 grow basis-32">
          <BrandLockup href={lockupHref} className="w-fit max-w-full" />
        </div>
        {children}
      </div>
    </header>
  );
}

/**
 * Apply and Sign in, at every width. Phones get the short "Apply" label;
 * the hidden words drop out of the accessible name with it, so the name
 * always starts with the visible text. The two may stack only when even
 * their own row is too narrow for both (320px at 200% text).
 */
export function PublicNav() {
  return (
    <nav
      aria-label="Primary"
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-6"
    >
      <Link
        href="/register"
        className="inline-flex min-h-tap items-center text-sm font-medium whitespace-nowrap text-navy-text underline decoration-border-strong underline-offset-4 transition-colors duration-150 ease-out-strong hover:decoration-navy-text"
      >
        {/* One flex item, so the space before the long label survives. */}
        <span>
          Apply<span className="hidden sm:inline"> for membership</span>
        </span>
      </Link>
      <Button href="/sign-in" size="sm" className="whitespace-nowrap">
        Sign in
      </Button>
    </nav>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div
        className={`${publicShell} flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between`}
      >
        <BrandLockup />
        <div className="grid gap-1 text-sm sm:justify-items-end">
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6"
          >
            <Link href="/sign-in" className={footerLink}>
              Sign in
            </Link>
            <Link href="/register" className={footerLink}>
              Apply for membership
            </Link>
            <Link href="/privacy" className={footerLink}>
              Privacy notice
            </Link>
          </nav>
          <AdminContactLine />
        </div>
      </div>
    </footer>
  );
}
