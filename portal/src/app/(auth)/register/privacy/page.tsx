import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  getCurrentNotice,
  hasCurrentConsent,
} from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";
import { Card, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Privacy notice - MCAC Members Portal" };

export default async function PrivacyPage() {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");
  if (await hasCurrentConsent(viewer.id))
    redirect(await resolveLandingPath(viewer));

  const notice = await getCurrentNotice();

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Privacy disclosure and acceptance"
        description="Read the current disclosure before making an affirmative account-processing choice. Acceptance covers account processing only; which contact fields other members can see is a separate next step."
        action={<ScreenId id="AUTH-02" />}
        className="mb-1"
      />
      {!notice ? (
        <ErrorState
          title="Privacy notice unavailable"
          body="Acceptance is disabled because the current notice could not be loaded. No acceptance has been recorded; try again shortly."
        />
      ) : (
        <>
          <Card className="grid gap-4 p-5">
            <span className="inline-flex min-h-6 w-fit items-center rounded-full bg-danger-bg px-2.5 py-0.5 text-xs font-semibold tracking-wide text-danger">
              DRAFT - PENDING LEGAL REVIEW
            </span>
            <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink">
              {notice.body}
            </div>
            <p className="border-t border-border pt-3 text-xs text-ink-muted">
              Privacy notice version {notice.version}. Your acceptance is
              recorded with a timestamp against this exact version.
            </p>
          </Card>
          <Card className="p-5">
            <AcceptForm version={notice.version} />
          </Card>
        </>
      )}
    </div>
  );
}
