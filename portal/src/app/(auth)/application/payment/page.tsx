import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireViewer } from "@/lib/auth";
import { resolveLandingPath } from "@/lib/account/routing";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { PaymentDetails } from "@/components/membership-fee";
import { OptionalConsentsForm } from "@/components/optional-consents-form";
import { getOptionalConsents } from "@/lib/account/registration";
import { PendingButton } from "../../_components/pending-button";
import { signOutAction } from "../../actions";
import { checkStatusAction } from "../pending/actions";

export const metadata = {
  title: "Membership fee - MCAC Members Portal",
};

/**
 * awaiting_payment: an admin approved the application (or the member's year
 * ended). Shows only how to pay. No member content loads here; an admin
 * confirms payment, then the account becomes approved.
 */
export default async function PaymentPage() {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");
  const landing = await resolveLandingPath(viewer);
  if (landing !== "/application/payment") redirect(landing);

  const [row, consentChoices] = await Promise.all([
    db.query.users.findFirst({
      where: eq(tables.users.id, viewer.id),
      columns: { memberNumber: true },
    }),
    getOptionalConsents(viewer),
  ]);
  const returning = row?.memberNumber != null;

  return (
    <div className="grid gap-4">
      <PageHeader
        title={
          returning
            ? "Renew your MCAC membership"
            : "Your application is approved"
        }
        description={
          returning
            ? "Your account, profile and posts are kept. Pay the membership fee to open member access again."
            : "Pay the membership fee to join. An MCAC admin opens your member access when your payment arrives."
        }
        className="mb-1"
      />
      <PaymentDetails />
      <Card className="grid gap-4 p-5">
        <StatusBadge status="pending" className="w-fit">
          Payment due
        </StatusBadge>
        <div className="grid gap-2 text-[0.9375rem] leading-relaxed text-ink">
          <p>
            After you pay, MCAC checks that the money arrived. This can take a
            short while. Tap Check status or sign in again to open the portal.
          </p>
          <p className="font-semibold">
            No member content is available until payment is confirmed.
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
          Questions about payment? Contact{" "}
          <a
            href="mailto:admin@mcac.org.in"
            className="font-medium text-navy-text underline"
          >
            admin@mcac.org.in
          </a>
          .
        </p>
      </Card>
      {/* Privacy notice section 10: withdrawal must stay reachable in every state. */}
      <Card className="grid gap-3 p-5">
        <h2 className="text-base font-semibold text-ink">Community updates</h2>
        <p className="text-[0.8125rem] text-ink-secondary">
          Optional community updates from the privacy notice. Change this at
          any time, whether or not you have paid.
        </p>
        <OptionalConsentsForm choices={consentChoices} />
      </Card>
    </div>
  );
}
