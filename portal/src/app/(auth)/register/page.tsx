import Link from "next/link";
import { redirect } from "next/navigation";
import { linkedInConfigured, requireViewer } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { resolveLandingPath } from "@/lib/account/routing";
import { getCurrentNotice } from "@/lib/account/registration";
import { Card, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { PendingButton } from "../_components/pending-button";
import { signInWithLinkedIn } from "../sign-in/actions";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Register - MCAC Members Portal" };

export default async function RegisterPage() {
  const viewer = await requireViewer();
  if (viewer) redirect(await resolveLandingPath(viewer));

  // ADMIN-03 promises "disabling this hides email sign-in for everyone"; the
  // registration action already refuses when the flag is off
  // (lib/account/registration.ts), so the form must disappear too or every
  // attempt reads as a failure. Mirrors sign-in/page.tsx.
  const emailSignInEnabled = await getConfig("auth.emailFallbackEnabled");
  const notice = await getCurrentNotice();

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Start your application"
        description={
          linkedInConfigured && emailSignInEnabled
            ? "Apply with LinkedIn, or create an account with email. You will read the privacy notice, choose contact visibility, and then wait for administrator review."
            : linkedInConfigured
              ? "Apply with LinkedIn. You will read the privacy notice, choose contact visibility, and then wait for administrator review."
            : "Create an account with email. You will read the privacy notice, choose contact visibility, and then wait for administrator review."
        }
        action={<ScreenId id="AUTH-01" />}
        className="mb-1"
      />
      {!notice ? (
        <ErrorState
          title="Member registration is temporarily unavailable"
          body="MCAC is finalizing its privacy notice. No application data will be collected until it is published. Contact admin@mcac.org.in for more information."
        />
      ) : (
        <Card className="grid gap-4 p-5">
          {linkedInConfigured ? (
          <form action={signInWithLinkedIn} className="grid">
            <PendingButton pendingLabel="Connecting to LinkedIn...">
              Continue with LinkedIn
            </PendingButton>
          </form>
          ) : (
          <p className="rounded-control bg-surface-subtle px-3 py-2.5 text-sm text-ink-secondary">
            LinkedIn sign-in arrives once the MCAC Company Page is configured.
          </p>
          )}
          {emailSignInEnabled ? (
          <>
            <div
              aria-hidden="true"
              className="flex items-center gap-3 text-xs text-ink-muted"
            >
              <span className="h-px flex-1 bg-border" />
              or apply with email
              <span className="h-px flex-1 bg-border" />
            </div>
            <RegisterForm />
          </>
          ) : null}
          <p className="flex min-h-tap items-center gap-1 border-t border-border pt-4 text-sm text-ink-secondary">
            Already have an account?
            <Link href="/sign-in" className="font-medium text-navy-text">
              Sign in
            </Link>
          </p>
        </Card>
      )}
    </div>
  );
}
