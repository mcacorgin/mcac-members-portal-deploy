import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireViewer } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { getDirectoryFilters } from "@/lib/directory/queries";
import { Button, Card, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { ProfileForm } from "../profile-form";
import { VisibilityForm } from "../visibility-form";

// HOME-06: the editing half of the profile, split out of /me so that page
// can stay a calm read view (client feedback: /me led with edit forms
// members rarely touch). Re-authorizes here (defense in depth) since it
// reads the viewer's own profile row directly.

export const metadata = { title: "Edit profile · MCAC Members Portal" };

export default async function MeEditPage() {
  const maybeViewer = await requireViewer();
  const denied = memberAccessError(maybeViewer);
  if (denied || !maybeViewer) redirect(await resolveLandingPath(maybeViewer));
  const viewer = maybeViewer;

  const [profile, myTagRows, filtersRes] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(tables.profiles.userId, viewer.id),
    }),
    db.query.memberTags.findMany({
      where: eq(tables.memberTags.userId, viewer.id),
    }),
    getDirectoryFilters(viewer),
  ]);

  const header = (
    <div className="mb-5 flex items-center justify-between gap-3">
      <Button href="/me" variant="ghost">
        Back to Me
      </Button>
      <ScreenId id="HOME-06" />
    </div>
  );

  if (!profile || !filtersRes.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        <PageHeader title="Edit profile" />
        <ErrorState
          title="Profile could not load"
          body="Your account actions remain available on Me. Try again."
          action={
            <Button href="/me/edit" variant="secondary">
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const allTags = filtersRes.data.tags;
  const myTagIds = myTagRows.map((t) => t.tagId);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      {header}
      <PageHeader
        title="Edit profile"
        description="Update your details and choose who can see your contact information."
      />

      <Card>
        <h3 className="mb-3 text-base font-semibold text-ink">
          Profile details
        </h3>
        <ProfileForm
          defaults={{
            name: viewer.name,
            city: profile.city,
            phone: profile.phone,
            company: profile.company,
            title: profile.title,
            bio: profile.bio,
            linkedinUrl: profile.linkedinUrl,
            tagIds: myTagIds,
          }}
          allTags={allTags}
        />
      </Card>

      <Card>
        <h3 className="mb-1 text-base font-semibold text-ink">
          Contact visibility
        </h3>
        <p className="mb-3 text-[13px] text-ink-secondary">
          Decide separately which contact fields approved members may see.
          Admin-only fields stay available to administrators.
        </p>
        <VisibilityForm
          defaults={{
            phone: profile.phoneVisibility,
            email: profile.emailVisibility,
            linkedin: profile.linkedinVisibility,
          }}
        />
      </Card>
    </div>
  );
}
