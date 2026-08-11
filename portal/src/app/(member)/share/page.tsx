import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { enabledSections, memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import {
  ALLOWED_ATTACHMENT_MIMES,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/attachments";
import { Button, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { Composer } from "./composer";

export const metadata = { title: "Share - MCAC Members Portal" };

// SHARE-01 - composer for every post type whose section is enabled for the
// viewer. Rendered as a child of the (member) shell layout.

export default async function SharePage() {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));

  const enabledTypes = await enabledSections(viewer!.id);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Share"
        description="Publish an opportunity, job, knowledge item, or event to the network."
        action={<ScreenId id="SHARE-01" />}
      />

      {enabledTypes.length === 0 ? (
        <ErrorState
          title="Sharing is not available"
          body="An administrator has disabled every share type for your account. The rest of the portal remains available."
          action={
            <Button href="/home" variant="secondary">
              Back to Home
            </Button>
          }
        />
      ) : (
        <Composer
          enabledTypes={enabledTypes}
          acceptMimes={[...ALLOWED_ATTACHMENT_MIMES]}
          maxBytes={MAX_ATTACHMENT_BYTES}
        />
      )}
    </div>
  );
}
