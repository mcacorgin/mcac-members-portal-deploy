import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  getApplicationState,
  getOptionalConsents,
} from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";
import { Card, PageHeader, ScreenId, StatusBadge } from "@/components/ui";
import { OptionalConsentsForm } from "@/components/optional-consents-form";
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

  const [state, consentChoices] = await Promise.all([
    getApplicationState(viewer),
    getOptionalConsents(viewer),
  ]);
  const submittedOn = state.latestConsentAt
    ? dateFormat.format(state.latestConsentAt)
    : null;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Your application is with MCAC"
        description="An administrator will review your application before you can access the member network."
        action={<ScreenId id="AUTH-05" />}
        className="mb-1"
      />
      <Card className="grid gap-4 p-5">
        <StatusBadge status="pending" className="w-fit">
          Pending review
        </StatusBadge>
        <div className="grid gap-2 text-[15px] leading-relaxed text-ink">
          <p>
            {submittedOn ? `Submitted ${submittedOn}. ` : ""}An administrator
            will review your privacy record, contact choices, and application
            details.
          </p>
          <p>
            <strong>What happens next:</strong> once a decision is recorded you
            will be routed to the right place automatically - approval opens
            the member portal directly, and any requested change appears on
            your status screen.
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
          <form action={signOutAction} className="grid flex-1 min-w-36">
            <PendingButton variant="secondary" pendingLabel="Signing out...">
              Sign out
            </PendingButton>
          </form>
        </div>
        <p className="border-t border-border pt-3 text-xs text-ink-muted">
          Need help with your application? Contact admin@mcac.org.in.
        </p>
      </Card>
      <Card className="grid gap-3 p-5">
        <h3 className="text-base font-semibold text-ink">Community updates</h3>
        <p className="text-[13px] text-ink-secondary">
          Optional community updates from the privacy notice. Change this at
          any time, whatever happens to your application.
        </p>
        <OptionalConsentsForm choices={consentChoices} />
      </Card>
    </div>
  );
}
