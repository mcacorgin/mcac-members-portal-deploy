import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireViewer } from "@/lib/auth";
import { getApplicationState } from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";
import { groupExpertiseTags } from "@/lib/expertise-groups";
import { Card, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { EvidenceForm } from "./evidence-form";

export const metadata = {
  title: "Application details - MCAC Members Portal",
};

/**
 * AUTH-07: pre-approval application evidence. Pending and needs_changes
 * applicants only - anyone else is forwarded to their correct screen. Not
 * guarded by landing-path equality: a pending applicant with already-complete
 * evidence may still open this page to edit before review.
 */
export default async function EvidencePage() {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");

  // Evidence is step three of the lifecycle (consent -> contact visibility ->
  // evidence). A pending/needs_changes viewer who has not cleared the earlier
  // steps must be sent back to them, not straight to this form.
  const landing = await resolveLandingPath(viewer);
  if (landing === "/register/privacy" || landing === "/register/contact-visibility")
    redirect(landing);
  if (viewer.status !== "pending" && viewer.status !== "needs_changes")
    redirect(landing);

  // Not getDirectoryFilters: it gates on approved member access, which a
  // pending or needs_changes applicant never has. Expertise tags are public
  // to any authenticated applicant filling out this form.
  const [user, profile, myTagRows, tags, state] = await Promise.all([
    db.query.users.findFirst({
      where: eq(tables.users.id, viewer.id),
      columns: { name: true, email: true, image: true },
    }),
    db.query.profiles.findFirst({
      where: eq(tables.profiles.userId, viewer.id),
    }),
    db.query.memberTags.findMany({
      where: eq(tables.memberTags.userId, viewer.id),
    }),
    db.query.expertiseTags.findMany({ orderBy: asc(tables.expertiseTags.label) }),
    getApplicationState(viewer),
  ]);
  const { professions, verticals } = groupExpertiseTags(tags);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Your application details"
        description="MCAC reviews these details before approving access."
        action={<ScreenId id="AUTH-07" />}
        className="mb-1"
      />
      {!user ? (
        <ErrorState
          title="Application form unavailable"
          body="Your account could not be loaded, so the application form cannot continue right now. Nothing was saved; try again shortly."
        />
      ) : (
        <Card className="grid gap-4 p-5">
          {viewer.status === "needs_changes" && state.statusReason ? (
            <p className="rounded-control bg-warning-bg px-3 py-2.5 text-sm text-warning">
              <strong>Reason from the reviewer:</strong> {state.statusReason}
            </p>
          ) : null}
          <EvidenceForm
            professionTags={professions}
            verticalTags={verticals}
            defaults={{
              name: user.name,
              city: profile?.city,
              phone: profile?.phone,
              company: profile?.company,
              title: profile?.title,
              bio: profile?.bio,
              linkedinUrl: profile?.linkedinUrl,
              tagIds: myTagRows.map((t) => t.tagId),
            }}
            identity={{ name: user.name, email: user.email, image: user.image }}
            submitLabel={
              viewer.status === "needs_changes"
                ? "Save changes and resubmit"
                : undefined
            }
          />
        </Card>
      )}
    </div>
  );
}
