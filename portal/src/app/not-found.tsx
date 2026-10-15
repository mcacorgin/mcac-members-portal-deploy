import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui";
import {
  PublicFooter,
  PublicHeader,
  publicShell,
} from "@/components/landing/public-chrome";

export const metadata: Metadata = {
  title: "Page not found - MCAC Members Portal",
};

const textLink =
  "inline-flex min-h-tap items-center font-medium text-navy-text underline decoration-border-strong underline-offset-4 transition-colors duration-150 ease-out-strong hover:decoration-navy-text";

/**
 * The 404 page, for any unknown address and for notFound() anywhere in the
 * app. It renders outside every shell and reads nothing about the viewer, so
 * the same ways out work signed in or signed out: "/" sends a signed-in
 * viewer on to their own home screen.
 */
export default function NotFound() {
  return (
    <>
      <PublicHeader lockupHref="/" />

      <main id="main" className="flex-1">
        <section
          aria-labelledby="not-found-title"
          className={`${publicShell} pt-14 pb-16 lg:pt-20 lg:pb-24`}
        >
          <p className="text-sm font-medium text-ink-muted">Error 404</p>
          <h1
            id="not-found-title"
            className="mt-3 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.03em] text-ink text-balance"
          >
            We could not find that page
          </h1>
          <p className="mt-5 max-w-[34rem] text-[1.0625rem] leading-relaxed text-ink-secondary">
            The link may be old, or the address may have a typo. Try one of
            these instead.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button href="/" size="lg">
              Go to the home page
            </Button>
            <Link href="/sign-in" className={textLink}>
              Sign in
            </Link>
            <Link href="/register" className={textLink}>
              Apply for membership
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
