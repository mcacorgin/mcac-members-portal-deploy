import type { Metadata } from "next";
import { getCurrentNotice } from "@/lib/account/registration";
import { ADMIN_EMAIL } from "@/lib/contact";
import { Card, ErrorState } from "@/components/ui";
import {
  PublicFooter,
  PublicHeader,
  PublicNav,
  publicShell,
} from "@/components/landing/public-chrome";
import {
  NoticeBody,
  NoticeStageBadge,
} from "@/components/privacy/notice-body";

export const metadata: Metadata = {
  title: "Privacy notice - MCAC Members Portal",
  description:
    "How MCAC collects, uses and protects the details you give when you apply and while you are a member.",
  alternates: { canonical: "/privacy" },
};

// Read the notice on every request: a newly published version must show here
// at once, not after the next deploy.
export const dynamic = "force-dynamic";

/**
 * The current privacy notice, open to anyone. /register/privacy shows the
 * same text, but only to a signed-in applicant who has not yet accepted it;
 * this page lets someone read it before they apply.
 */
export default async function PublicPrivacyPage() {
  const notice = await getCurrentNotice();

  return (
    <>
      <PublicHeader lockupHref="/">
        <PublicNav />
      </PublicHeader>

      <main id="main" className="flex-1">
        <div className={`${publicShell} py-12 lg:py-16`}>
          <div className="mx-auto grid max-w-3xl gap-6">
            <div>
              <h1 className="text-[clamp(1.75rem,3.4vw,2.25rem)] leading-tight font-semibold tracking-[-0.025em] text-ink">
                Privacy notice
              </h1>
              <p className="mt-3 max-w-[38rem] leading-relaxed text-ink-secondary">
                How MCAC handles the details you give when you apply and while
                you are a member. You accept this notice as part of your
                application.
              </p>
            </div>

            {!notice ? (
              <ErrorState
                title="Privacy notice unavailable"
                body={`MCAC is finalizing its privacy notice. Contact ${ADMIN_EMAIL} for more information.`}
              />
            ) : (
              <Card className="grid gap-5 p-5 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-6 items-center rounded-full bg-navy-tint px-2.5 py-0.5 text-xs font-semibold text-navy-text">
                    Privacy notice v{notice.version}
                  </span>
                  <NoticeStageBadge body={notice.body} />
                </div>
                <NoticeBody body={notice.body} />
              </Card>
            )}
          </div>
        </div>
      </main>

      <PublicFooter />
    </>
  );
}
