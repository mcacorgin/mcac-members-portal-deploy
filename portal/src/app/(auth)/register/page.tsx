import Link from "next/link";
import { redirect } from "next/navigation";
import { linkedInConfigured, requireViewer } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { resolveLandingPath } from "@/lib/account/routing";
import { getCurrentNotice } from "@/lib/account/registration";
import { ADMIN_EMAIL } from "@/lib/contact";
import { Card, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { AdminContactLine } from "@/components/admin-contact-line";
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
            ? "Apply with LinkedIn or email. Next: read the privacy notice, choose who sees your contact details, then wait for an admin to approve you."
            : linkedInConfigured
              ? "Apply with LinkedIn. Next: read the privacy notice, choose who sees your contact details, then wait for an admin to approve you."
            : "Apply with email. Next: read the privacy notice, choose who sees your contact details, then wait for an admin to approve you."
        }
        action={<ScreenId id="AUTH-01" />}
        className="mb-1"
      />
      {!notice ? (
        <ErrorState
          title="Member registration is temporarily unavailable"
          body={`MCAC is finalizing its privacy notice. No application data will be collected until it is published. Contact ${ADMIN_EMAIL} for more information.`}
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
          <div className="grid gap-1 border-t border-border pt-4 text-sm">
            <p className="flex min-h-tap flex-wrap items-center gap-x-1 text-ink-secondary">
              Already have an account?
              <Link
                href="/sign-in"
                className="inline-flex min-h-tap items-center font-medium text-navy-text"
              >
                Sign in
              </Link>
            </p>
            <AdminContactLine />
          </div>
        </Card>
      )}
      {notice ? (
        <p className="text-sm">
          <Link
            href="/privacy"
            className="inline-flex min-h-tap items-center font-medium text-navy-text"
          >
            Privacy notice
          </Link>
        </p>
      ) : null}
    </div>
  );
}
