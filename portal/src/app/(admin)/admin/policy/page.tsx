import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { adminAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { getConfig } from "@/lib/config";
import { PageHeader, ScreenId } from "@/components/ui";
import {
  BrandControl,
  ContactDefaultsControl,
  OpportunitiesControl,
  SectionsControl,
  SignInControl,
} from "./controls";

export const metadata = { title: "Policy - MCAC Members Portal" };

export default async function PolicyPage() {
  // Re-guard here: this page reads config directly (getConfig has no viewer
  // argument), and layouts are not re-run on every client navigation.
  const viewer = await requireViewer();
  const denied = adminAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));

  const [
    goldPresence,
    emailFallbackEnabled,
    contactPhone,
    contactEmail,
    contactLinkedin,
    expiryDays,
    expiryOverridable,
    sectionOpportunity,
    sectionJob,
    sectionKnowledge,
    sectionEvent,
  ] = await Promise.all([
    getConfig("brand.goldPresence"),
    getConfig("auth.emailFallbackEnabled"),
    getConfig("contact.defaults.phone"),
    getConfig("contact.defaults.email"),
    getConfig("contact.defaults.linkedin"),
    getConfig("posts.opportunityExpiryDays"),
    getConfig("posts.expiryAdminOverridable"),
    getConfig("sections.opportunity"),
    getConfig("sections.job"),
    getConfig("sections.knowledge"),
    getConfig("sections.event"),
  ]);

  return (
    <div>
      <div className="mb-1">
        <ScreenId id="ADMIN-03" />
      </div>
      <PageHeader
        title="Policy"
        description="Late-binding decisions live here as configuration. Changes apply immediately and are audit logged; no code change is needed."
      />
      <div className="grid gap-4">
        <SectionsControl
          opportunity={sectionOpportunity}
          job={sectionJob}
          knowledge={sectionKnowledge}
          event={sectionEvent}
        />
        <ContactDefaultsControl
          phone={contactPhone}
          email={contactEmail}
          linkedin={contactLinkedin}
        />
        <OpportunitiesControl
          expiryDays={expiryDays}
          adminOverridable={expiryOverridable}
        />
        <SignInControl initial={emailFallbackEnabled} />
        <BrandControl initial={goldPresence} />
      </div>
    </div>
  );
}
