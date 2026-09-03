import type { Metadata } from "next";
import { Button, Card, PageHeader, ScreenId } from "@/components/ui";
import { VerifyContactEmailForm } from "./verify-form";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Verify communication email · MCAC Members Portal",
  referrer: "no-referrer",
};

export default async function VerifyContactEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const viewer = await requireViewer();
  const returnTo = token
    ? `/verify-contact-email?token=${encodeURIComponent(token)}`
    : "/verify-contact-email";

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Verify your communication email"
        description="Confirm this address for MCAC portal notifications. Your sign-in email and LinkedIn connection will not change."
        action={<ScreenId id="AUTH-09" />}
        className="mb-1"
      />
      <Card className="grid gap-4 p-5">
        {token ? (
          <>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Sign in with the same MCAC account that requested this change,
              then confirm below. This extra check prevents a forwarded or
              misdirected link from changing another member&apos;s account.
            </p>
            {viewer ? (
              <VerifyContactEmailForm token={token} />
            ) : (
              <Button
                href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
              >
                Sign in to verify
              </Button>
            )}
          </>
        ) : (
          <>
            <p role="alert" className="text-sm text-danger">
              This verification link is invalid or expired.
            </p>
            <Button href="/me/edit" variant="secondary">
              Request a new verification email
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
