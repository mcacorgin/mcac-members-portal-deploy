import { Button, Card, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Reset password - MCAC Members Portal" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!(await getConfig("auth.emailFallbackEnabled"))) redirect("/sign-in");
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Choose a new password"
        description="This link came from your reset email and is valid for one hour."
        action={<ScreenId id="AUTH-01" />}
        className="mb-1"
      />
      {email && token ? (
        <Card className="p-5">
          <ResetPasswordForm email={email} token={token} />
        </Card>
      ) : (
        <ErrorState
          title="This reset link is incomplete"
          body="Open the link exactly as it appears in your reset email, or request a new one."
          action={
            <Button href="/forgot-password" variant="secondary">
              Request a new link
            </Button>
          }
        />
      )}
    </div>
  );
}
