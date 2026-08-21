import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  getCurrentNotice,
  getOptionalConsents,
  hasCurrentConsent,
} from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";
import { Card, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Privacy notice - MCAC Members Portal" };

function NoticeBody({ body }: { body: string }) {
  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="grid gap-4 text-[15px] leading-relaxed text-ink-secondary">
      {blocks.map((block, index) => {
        if (index === 0) {
          return (
            <h2 key={block} className="text-lg font-semibold text-ink">
              {block}
            </h2>
          );
        }
        if (/^(Effective Date|Last Updated):/m.test(block)) {
          return (
            <div
              key={block}
              className="grid gap-1 rounded-control bg-surface-subtle px-3.5 py-3 text-sm text-ink-secondary sm:grid-cols-2"
            >
              {block.split("\n").map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          );
        }
        if (/^\d+\.\s|^Consent and Acceptance$/i.test(block)) {
          return (
            <h3
              key={block}
              className="border-t border-border pt-4 text-base font-semibold text-ink first:border-0 first:pt-0"
            >
              {block}
            </h3>
          );
        }
        return <p key={`${index}-${block.slice(0, 24)}`}>{block}</p>;
      })}
    </div>
  );
}

export default async function PrivacyPage() {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");
  if (await hasCurrentConsent(viewer.id))
    redirect(await resolveLandingPath(viewer));

  const [notice, choices] = await Promise.all([
    getCurrentNotice(),
    getOptionalConsents(viewer),
  ]);
  const isInterim = Boolean(
    notice && /INTERIM PRIVACY DISCLOSURE/i.test(notice.body),
  );
  const isDraft = Boolean(
    notice &&
      /DRAFT|PENDING LEGAL REVIEW|\[[^\]]*CONFIRM[^\]]*\]/i.test(notice.body),
  );

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        title="Review your privacy choices"
        description="Start with the short version, open the full notice if you want the detail, then choose what MCAC may do."
        action={<ScreenId id="AUTH-02" />}
        className="mb-1"
      />
      {!notice ? (
        <ErrorState
          title="Privacy notice unavailable"
          body="MCAC is finalizing its privacy notice. Acceptance and member registration are disabled, and no acceptance has been recorded. Contact admin@mcac.org.in for more information."
        />
      ) : (
        <>
          <Card className="grid gap-5 p-5 sm:p-6">
            {isInterim || isDraft ? (
              <span className="inline-flex min-h-6 w-fit items-center rounded-full bg-danger-bg px-2.5 py-0.5 text-xs font-semibold tracking-wide text-danger">
                {isInterim
                  ? "INTERIM - FINAL NOTICE PENDING"
                  : "DRAFT - PENDING LEGAL REVIEW"}
              </span>
            ) : null}

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-6 items-center rounded-full bg-navy-tint px-2.5 py-0.5 text-xs font-semibold text-navy-text">
                  Privacy notice v{notice.version}
                </span>
                <span className="text-xs font-medium text-ink-muted">
                  One-time review for this version
                </span>
              </div>
              <h2 className="text-xl font-semibold text-ink">
                The short version
              </h2>
              <p className="mt-2 leading-relaxed text-ink-secondary">
                MCAC uses the professional identity, profile, contact, and
                application information you provide to evaluate and manage
                membership, keep the portal secure, and operate the community.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-container bg-surface-subtle p-4">
                <h3 className="text-sm font-semibold text-ink">
                  Required for membership
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                  Reviewing applications, maintaining accounts, operating the
                  private member directory, protecting the service, and
                  responding to requests or grievances.
                </p>
              </div>
              <div className="rounded-container bg-success-bg p-4">
                <h3 className="text-sm font-semibold text-success">
                  Community updates are optional
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                  Approved members appear in the private member directory.
                  Their professional profile can be found in People and tagged
                  in posts. Phone, email, and LinkedIn visibility stay separate.
                  Community updates remain optional.
                </p>
              </div>
            </div>

            <p className="rounded-control border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink-secondary">
              You can turn optional community updates off in your profile. For
              privacy requests, contact Sachin Kelkar at{" "}
              <a
                className="font-medium text-navy-text underline decoration-navy/30 underline-offset-2"
                href="mailto:sachinke@gmail.com"
              >
                sachinke@gmail.com
              </a>
              .
            </p>

            <details className="group rounded-container border border-border bg-surface">
              <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-4 rounded-container px-4 py-3.5 font-semibold text-ink focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <span>
                  Read the full privacy notice
                  <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                    The complete approved text and all 12 sections
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-xl text-ink-muted transition-transform duration-150 ease-out-strong group-open:rotate-180"
                >
                  ⌄
                </span>
              </summary>
              <div className="border-t border-border px-4 py-5 sm:px-5">
                <NoticeBody body={notice.body} />
                <p className="mt-5 border-t border-border pt-3 text-xs text-ink-muted">
                  Your acceptance is recorded with a timestamp against privacy
                  notice version {notice.version}.
                </p>
              </div>
            </details>
          </Card>

          <Card className="grid gap-4 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Choose what MCAC can do
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                The first choice is required for membership. Community updates
                are optional and clearly show what changes when they are on or
                off.
              </p>
            </div>
            <AcceptForm version={notice.version} choices={choices} />
          </Card>
        </>
      )}
    </div>
  );
}
