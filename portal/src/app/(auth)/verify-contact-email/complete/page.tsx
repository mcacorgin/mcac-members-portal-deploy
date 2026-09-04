import { Button, Card, PageHeader, ScreenId } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { getPreferredContactEmailState } from "@/lib/account/preferred-contact-email";

export const metadata = {
  title: "Communication email verified · MCAC Members Portal",
};

export default async function ContactEmailVerifiedPage() {
  const viewer = await requireViewer();
  const state = viewer ? await getPreferredContactEmailState(viewer.id) : null;
  const verifiedEmail = state?.preferredEmail ?? null;

  return (
    <div className="grid gap-4">
      <PageHeader
        title={verifiedEmail ? "Communication email verified" : "Check your communication email"}
        description={
          verifiedEmail
            ? `MCAC portal notifications will now go to ${verifiedEmail}. Your sign-in email and LinkedIn connection have not changed.`
            : "Open your verification link while signed in to confirm the email used for MCAC portal notifications."
        }
        action={<ScreenId id="AUTH-09" />}
        className="mb-1"
      />
      <Card className="grid gap-4 p-5">
        <p className="text-sm leading-relaxed text-ink-secondary">
          {verifiedEmail
            ? "You can review or change this address from Edit profile at any time."
            : "If the link has expired, request a new verification email from your account settings."}
        </p>
        <Button href="/">Continue to MCAC</Button>
      </Card>
    </div>
  );
}
