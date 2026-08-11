import Link from "next/link";
import { BrandLockup, BrandMark, Button } from "@/components/ui";

/**
 * Public landing page (signed-out view of "/").
 *
 * Design read: an application-only professional network. Prospective members
 * need to read legitimacy and privacy in the first screen, so the page is
 * editorial rather than promotional: system type at scale, hairline rules
 * instead of floating cards, one navy accent, gold only inside the real mark.
 * No photography, no numbers, no claims beyond what the portal actually does.
 *
 * Light theme only, matching the rest of the product (globals.css has no dark
 * tokens). Motion is limited to CSS hover and active states, which the global
 * prefers-reduced-motion block already neutralises.
 */

const directory = {
  title: "Member directory",
  body: "Search members by company, role, city or expertise. Every member decides which contact details are visible, one field at a time.",
};

const inside = [
  {
    title: "Opportunities",
    body: "Post work you need help with. Reply to the ones you can take on.",
  },
  {
    title: "Jobs",
    body: "Open roles at member companies, posted by members.",
  },
  {
    title: "Knowledge sharing",
    body: "Ask a question, or post what you have already worked out.",
  },
  {
    title: "Events",
    body: "Meetups and sessions run by members, with the details in one place.",
  },
];

const steps = [
  {
    title: "Apply",
    body: "Start an application with your professional details and your contact choices.",
  },
  {
    title: "Review",
    body: "An administrator reads every application and decides who joins.",
  },
  {
    title: "Access",
    body: "Once approved, you get member access.",
  },
];

const shell = "mx-auto w-full max-w-6xl px-5 sm:px-8";
// gap-px over a border-coloured grid draws every rule exactly once, so the
// plate never doubles a line at a row or column join.
const cell = "px-6 py-7";

export function LandingPage() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className={`${shell} flex h-16 items-center justify-between gap-4`}>
          <BrandLockup />
          <nav aria-label="Primary" className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/register"
              className="hidden text-sm font-medium text-navy-text underline decoration-border-strong underline-offset-4 transition-colors duration-150 ease-out-strong hover:decoration-navy-text sm:inline"
            >
              Apply for membership
            </Link>
            <Button href="/sign-in" size="sm">
              Sign in
            </Button>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero. Typography carries it; the only visual is the real mark. */}
        <section
          aria-labelledby="hero-title"
          className="relative overflow-hidden border-b border-border"
        >
          <BrandMark
            className="pointer-events-none absolute top-1/2 right-12 hidden w-[16rem] max-w-none -translate-y-1/2 lg:block"
          />
          <div
            className={`${shell} relative pt-14 pb-16 lg:grid lg:grid-cols-12 lg:pt-20 lg:pb-24`}
          >
            <div className="lg:col-span-7">
              <h1
                id="hero-title"
                className="text-[clamp(2rem,5.2vw,4rem)] leading-[1.06] font-semibold tracking-[-0.035em] text-ink text-balance"
              >
                Find the right person.
                <br />
                Reach them directly.
              </h1>
              <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-secondary">
                A private network of Marathi corporate professionals. Approved
                members find each other and make contact directly.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Button href="/sign-in" size="lg">
                  Sign in
                </Button>
                <Link
                  href="/register"
                  className="inline-flex min-h-tap items-center font-medium text-navy-text underline decoration-border-strong underline-offset-4 transition-colors duration-150 ease-out-strong hover:decoration-navy-text"
                >
                  Apply for membership
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* What members get. One bordered plate divided by rules, with the
            directory as the dominant field. */}
        <section aria-labelledby="inside-title" className={`${shell} py-16 lg:py-24`}>
          <h2
            id="inside-title"
            className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight font-semibold tracking-[-0.02em] text-ink"
          >
            What members get
          </h2>
          <p className="mt-3 max-w-[38rem] text-[16px] leading-relaxed text-ink-secondary">
            All of it sits behind sign-in, visible only to approved members.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden rounded-container border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            <div className={`${cell} bg-navy-tint sm:col-span-2`}>
              <h3 className="text-lg font-semibold text-ink">
                {directory.title}
              </h3>
              <p className="mt-2 max-w-[36rem] text-[15px] leading-relaxed text-ink-secondary">
                {directory.body}
              </p>
            </div>
            {inside.map((item) => (
              <div key={item.title} className={`${cell} bg-surface`}>
                <h3 className="text-base font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-secondary">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How membership works. Offset right on desktop so the page changes
            its alignment rather than repeating the grid. */}
        <section
          aria-labelledby="membership-title"
          className="border-t border-border bg-surface"
        >
          <div
            className={`${shell} py-16 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-24`}
          >
            <h2
              id="membership-title"
              className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight font-semibold tracking-[-0.02em] text-ink lg:col-span-4"
            >
              How membership works
            </h2>
            <ol className="mt-9 grid gap-8 border-l border-border pl-6 lg:col-span-7 lg:col-start-6 lg:mt-0">
              {steps.map((step) => (
                <li key={step.title}>
                  <h3 className="text-base font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 max-w-[34rem] text-[15px] leading-relaxed text-ink-secondary">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy line and closing action. The single navy block on the page. */}
        <section aria-labelledby="privacy-title" className="bg-navy text-white">
          <div
            className={`${shell} grid gap-10 py-16 lg:grid-cols-12 lg:items-end lg:py-20`}
          >
            <div className="lg:col-span-7">
              <h2
                id="privacy-title"
                className="text-[clamp(1.35rem,2.4vw,1.875rem)] leading-snug font-semibold tracking-[-0.02em] text-balance"
              >
                Every application is reviewed, and contact details stay under
                each member&apos;s control.
              </h2>
              <p className="mt-4 max-w-[32rem] text-[16px] leading-relaxed text-white/75">
                The network is not public. You choose what other members can
                see.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4 lg:col-span-5 lg:justify-end">
              <Button href="/register" size="lg" variant="secondary">
                Apply for membership
              </Button>
              <Link
                href="/sign-in"
                className="inline-flex min-h-tap items-center font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors duration-150 ease-out-strong hover:decoration-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div
          className={`${shell} flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between`}
        >
          <BrandLockup />
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
          >
            <Link href="/sign-in" className="font-medium text-navy-text">
              Sign in
            </Link>
            <Link href="/register" className="font-medium text-navy-text">
              Apply for membership
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
