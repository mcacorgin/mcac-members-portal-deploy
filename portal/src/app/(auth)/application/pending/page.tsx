import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  getApplicationState,
  getOptionalConsents,
} from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";
import { Button, Card, PageHeader, ScreenId, StatusBadge } from "@/components/ui";
import { OptionalConsentsForm } from "@/components/optional-consents-form";
import { PreferredContactEmailCard } from "@/components/preferred-contact-email-card";
import { getPreferredContactEmailState } from "@/lib/account/preferred-contact-email";
import { PendingButton } from "../../_components/pending-button";
import { signOutAction } from "../../actions";
import { checkStatusAction } from "./actions";

export const metadata = {
  title: "Application pending - MCAC Members Portal",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * AUTH-05 pending isolation screen. Renders ONLY the applicant's own status;
 * no member names, posts, contacts, notifications, or attachments ever load
 * here.
 */
export default async function PendingPage() {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");
  const landing = await resolveLandingPath(viewer);
  if (landing !== "/application/pending") redirect(landing);

  const [state, consentChoices, emailState] = await Promise.all([
    getApplicationState(viewer),
    getOptionalConsents(viewer),
    getPreferredContactEmailState(viewer.id),
  ]);
  const submittedOn = state.latestConsentAt
    ? dateFormat.format(state.latestConsentAt)
    : null;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Your application is with MCAC"
        description="An MCAC admin will review it. You can use the portal once they approve you."
        action={<ScreenId id="AUTH-05" />}
        className="mb-1"
      />
      <Card className="grid gap-4 p-5">
        <StatusBadge status="pending" className="w-fit">
          Pending review
        </StatusBadge>
        <div className="grid gap-2 text-[0.9375rem] leading-relaxed text-ink">
          <p>
            {submittedOn ? `Submitted ${submittedOn}. ` : ""}What happens
            next: when an admin approves you, tap Check status or sign in
            again to open the portal. If they need changes, you will see what
            to fix here.
          </p>
          <p className="font-semibold">
            No member content is available while pending.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={checkStatusAction} className="grid flex-1 min-w-36">
            <PendingButton pendingLabel="Checking status...">
              Check status
            </PendingButton>
          </form>
          <Button
            href="/application/evidence"
            variant="secondary"
            className="flex-1 min-w-36"
          >
            Edit my application
          </Button>
          <form action={signOutAction} className="grid flex-1 min-w-36">
            <PendingButton variant="secondary" pendingLabel="Signing out...">
              Sign out
            </PendingButton>
          </form>
        </div>
        <p className="border-t border-border pt-3 text-xs text-ink-muted">
          Need help with your application? Contact{" "}
          <a
            href="mailto:admin@mcac.org.in"
            className="font-medium text-navy-text underline"
          >
            admin@mcac.org.in
          </a>
          .
        </p>
      </Card>
      <p className="text-xs text-ink-muted">
        Nothing else is needed. The settings below are optional.
      </p>
      {emailState ? <PreferredContactEmailCard state={emailState} /> : null}
      <Card className="grid gap-3 p-5">
        <h2 className="text-base font-semibold text-ink">Community updates</h2>
        <p className="text-[0.8125rem] text-ink-secondary">
          Optional community updates from the privacy notice. Change this at
          any time, whatever happens to your application.
        </p>
        <OptionalConsentsForm choices={consentChoices} />
      </Card>
    </div>
  );
}
