import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireViewer } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { getDirectoryFilters } from "@/lib/directory/queries";
import { Button, Card, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { getPreferredContactEmailState } from "@/lib/account/preferred-contact-email";
import { PreferredContactEmailCard } from "@/components/preferred-contact-email-card";

import { OptionalConsentsForm } from "@/components/optional-consents-form";
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

  const [profile, myTagRows, filtersRes, emailState] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(tables.profiles.userId, viewer.id),
    }),
    db.query.memberTags.findMany({
      where: eq(tables.memberTags.userId, viewer.id),
    }),
    getDirectoryFilters(viewer),
    getPreferredContactEmailState(viewer.id),
  ]);

  const header = (
    <div className="mb-5 flex items-center justify-between gap-3">
      <Button href="/me" variant="ghost">
        Back to Me
      </Button>
      <ScreenId id="HOME-06" />
    </div>
  );

  if (!profile || !filtersRes.ok || !emailState) {
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

      <PreferredContactEmailCard state={emailState} />

      <Card>
        <h2 className="mb-3 text-base font-semibold text-ink">
          Profile details
        </h2>
        <ProfileForm
          defaults={{
            name: viewer.name,
            city: profile.city,
            phone: profile.phone,
            company: profile.company,
            title: profile.title,
            profession: profile.profession,
            bio: profile.bio,
            linkedinUrl: profile.linkedinUrl,
            tagIds: myTagIds,
          }}
          allTags={allTags}
          professionOptions={filtersRes.data.professions.map((p) => p.label)}
        />
      </Card>

      <Card>
        <h2 className="mb-1 text-base font-semibold text-ink">
          Contact visibility
        </h2>
        <p className="mb-3 text-[0.8125rem] text-ink-secondary">
          Choose who sees each contact detail. Admin-only means only MCAC
          admins.
        </p>
        <VisibilityForm
          defaults={{
            phone: profile.phoneVisibility,
            email: profile.emailVisibility,
            linkedin: profile.linkedinVisibility,
          }}
        />
      </Card>

      <Card>
        <h2 className="mb-1 text-base font-semibold text-ink">
          Community updates
        </h2>
        <p className="mb-3 text-[0.8125rem] text-ink-secondary">
          Choose whether MCAC may send you community news. You can change
          this at any time.
        </p>
        <OptionalConsentsForm
          choices={{
            communications: profile.communicationsOptIn,
          }}
        />
      </Card>
    </div>
  );
}
