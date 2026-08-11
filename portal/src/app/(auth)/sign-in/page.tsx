import Link from "next/link";
import { redirect } from "next/navigation";
import { linkedInConfigured, requireViewer } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { getConfig } from "@/lib/config";
import { resolveLandingPath } from "@/lib/account/routing";
import {
  forwardableError,
  signInErrorMessage,
} from "@/lib/account/link-errors";
import { Card, PageHeader, ScreenId } from "@/components/ui";
import { PendingButton } from "../_components/pending-button";
import { signInWithLinkedIn } from "./actions";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in - MCAC Members Portal" };

// OAuth callback failures redirect here with ?error=. The codes, the copy and
// the forwarding allowlist all live in lib/account/link-errors.ts so they
// cannot drift apart; never echo the raw code.

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;

  const viewer = await requireViewer();
  if (viewer) {
    // A signed-in viewer who lands here with an error was trying to connect
    // LinkedIn from /me. Without this they would be bounced to Home and the
    // failure would look like nothing happened.
    if (errorCode && !memberAccessError(viewer)) {
      redirect(`/me?linkError=${forwardableError(errorCode)}`);
    }
    redirect(await resolveLandingPath(viewer));
  }

  const errorMessage = errorCode ? signInErrorMessage(errorCode) : null;
  // ADMIN-03 promises "disabling this hides email sign-in for everyone"; the
  // credentials provider already refuses when the flag is off (lib/auth.ts),
  // so the form must disappear too or every attempt reads as a wrong password.
  const emailSignInEnabled = await getConfig("auth.emailFallbackEnabled");

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Continue to MCAC"
        description="A private, vetted members network. Applications require privacy acceptance, contact choices, application details, and administrator approval before any member content becomes available."
        action={<ScreenId id="AUTH-01" />}
        className="mb-1"
      />
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-control border border-danger/35 bg-danger-bg px-3 py-2.5 text-sm text-danger"
        >
          {errorMessage}
        </div>
      ) : null}
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
              or use email
              <span className="h-px flex-1 bg-border" />
            </div>
            <SignInForm />
          </>
        ) : null}
        <div className="grid gap-1 border-t border-border pt-4 text-sm">
          {emailSignInEnabled ? (
            <Link
              href="/forgot-password"
              className="inline-flex min-h-tap items-center font-medium text-navy-text"
            >
              Forgot password?
            </Link>
          ) : null}
          <p className="flex min-h-tap items-center gap-1 text-ink-secondary">
            New to MCAC?
            <Link href="/register" className="font-medium text-navy-text">
              Start an application
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
