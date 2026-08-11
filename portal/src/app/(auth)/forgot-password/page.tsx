import Link from "next/link";
import { Card, PageHeader, ScreenId } from "@/components/ui";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password - MCAC Members Portal" };

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Reset your password"
        description="Enter the email address you registered with and we will send a recovery link."
        action={<ScreenId id="AUTH-01" />}
        className="mb-1"
      />
      <Card className="grid gap-4 p-5">
        <ForgotPasswordForm />
        <p className="flex min-h-tap items-center gap-1 border-t border-border pt-4 text-sm text-ink-secondary">
          Remembered it?
          <Link href="/sign-in" className="font-medium text-navy-text">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
