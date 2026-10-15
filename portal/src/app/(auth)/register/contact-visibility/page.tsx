import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { hasCurrentConsent } from "@/lib/account/registration";
import { Card, PageHeader, ScreenId } from "@/components/ui";
import { VisibilityForm } from "./visibility-form";

export const metadata = {
  title: "Contact visibility - MCAC Members Portal",
};

export default async function ContactVisibilityPage() {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");
  // The visibility step follows the privacy notice in the application flow.
  if (!(await hasCurrentConsent(viewer.id))) redirect("/register/privacy");

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Who can see your contact details?"
        description="Choose who can see your phone, email and LinkedIn. You can change this later under Me."
        action={<ScreenId id="AUTH-03" />}
        className="mb-1"
      />
      <Card className="grid gap-4 p-5">
        <p className="rounded-control bg-navy-tint px-3 py-2.5 text-sm text-navy-text">
          MCAC admins can always see your details. Other members see only what
          you mark as visible.
        </p>
        <VisibilityForm />
      </Card>
    </div>
  );
}
