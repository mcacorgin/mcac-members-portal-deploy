import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  getApplicationState,
  getOptionalConsents,
} from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";
import { Button, Card, PageHeader, ScreenId, StatusBadge } from "@/components/ui";
import { OptionalConsentsForm } from "@/components/optional-consents-form";
import { PendingButton } from "../../_components/pending-button";
import { signOutAction } from "../../actions";

export const metadata = {
  title: "Application status - MCAC Members Portal",
};

/**
 * AUTH-06: needs_changes / rejected / suspended. Fails closed - shows only
 * the account's own status and the administrator-recorded reason. No member
 * data renders here.
 */
export default async function StatusPage() {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");
  const landing = await resolveLandingPath(viewer);
  if (landing !== "/application/status") redirect(landing);

  const [state, consentChoices] = await Promise.all([
    getApplicationState(viewer),
    getOptionalConsents(viewer),
  ]);

  const content =
    viewer.status === "needs_changes" ? (
      <>
        <StatusBadge status="needs-changes" className="w-fit">
          Needs changes
        </StatusBadge>
        <div className="grid gap-2 text-[15px] leading-relaxed text-ink">
          <h3 className="text-base font-semibold">Update requested</h3>
          <p>
            An administrator has returned your application for changes. Member
            access remains closed until it is reviewed again.
          </p>
          {state.statusReason ? (
            <p className="rounded-control bg-warning-bg px-3 py-2.5 text-sm text-warning">
              <strong>Reason from the reviewer:</strong> {state.statusReason}
            </p>
          ) : null}
          <p>
            Update your application details and resubmit them for review.
          </p>
        </div>
        <Button href="/application/evidence">
          Review and update your application
        </Button>
      </>
    ) : viewer.status === "rejected" ? (
      <>
        <StatusBadge status="rejected" className="w-fit">
          Application not approved
        </StatusBadge>
        <div className="grid gap-2 text-[15px] leading-relaxed text-ink">
          <h3 className="text-base font-semibold">
            Your application was not approved
          </h3>
          {state.statusReason ? (
            <p className="rounded-control bg-danger-bg px-3 py-2.5 text-sm text-danger">
              <strong>Reason recorded:</strong> {state.statusReason}
            </p>
          ) : null}
          <p>
            For questions about this decision, contact admin@mcac.org.in.
          </p>
        </div>
      </>
    ) : (
      <>
        <StatusBadge status="suspended" className="w-fit">
          Access restricted
        </StatusBadge>
        <div className="grid gap-2 text-[15px] leading-relaxed text-ink">
          <h3 className="text-base font-semibold">This account is suspended</h3>
          {state.statusReason ? (
            <p className="rounded-control bg-danger-bg px-3 py-2.5 text-sm text-danger">
              <strong>Reason recorded:</strong> {state.statusReason}
            </p>
          ) : null}
          <p>
            Member access is closed while the account is suspended. A status
            reversal by an administrator routes you back to the correct account
            state on your next visit. For assistance, contact
            admin@mcac.org.in.
          </p>
        </div>
      </>
    );

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Application status"
        description="Review the latest decision on your MCAC application."
        action={<ScreenId id="AUTH-06" />}
        className="mb-1"
      />
      <Card className="grid gap-4 p-5">
        {content}
        <form action={signOutAction} className="grid border-t border-border pt-4">
          <PendingButton variant="secondary" pendingLabel="Signing out...">
            Sign out
          </PendingButton>
        </form>
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
