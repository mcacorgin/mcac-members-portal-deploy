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
        title="Contact visibility choices"
        description="Choose each contact field's audience. These choices are separate from the privacy notice you just accepted, are never implied by it, and can be changed later from your profile."
        action={<ScreenId id="AUTH-03" />}
        className="mb-1"
      />
      <Card className="grid gap-4 p-5">
        <p className="rounded-control bg-navy-tint px-3 py-2.5 text-sm text-navy-text">
          MCAC administrators always need your identity and a reachable phone
          number to operate your account. That requirement does not make any
          field visible to members; only the choices below do.
        </p>
        <VisibilityForm />
      </Card>
    </div>
  );
}
