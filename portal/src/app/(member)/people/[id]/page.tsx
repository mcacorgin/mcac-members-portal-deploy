import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getMemberProfile } from "@/lib/directory/queries";
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  PageHeader,
  ScreenId,
  Tag,
} from "@/components/ui";

// PEOPLE-02: member profile with permitted contact actions. The contact block
// is driven ONLY by the projected contact object: a field that is undefined
// renders no action at all - never a disabled control, never a hidden value.

export const metadata = { title: "Member profile · MCAC Members Portal" };

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const res = await getMemberProfile(viewer, id);

  if (!res.ok) {
    if (res.code === "not_found") notFound();
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ScreenId id="PEOPLE-02" className="mb-2" />
        <ErrorState
          title="Profile could not load"
          body={res.message}
          action={
            <Button href="/people" variant="secondary">
              Back to People
            </Button>
          }
        />
      </div>
    );
  }

  const profile = res.data;
  const { contact } = profile;
  // Action hrefs are built only from the projected values, and only when the
  // value can form a sane URL: a plausible phone number (8-15 digits, near
  // E.164) and an http(s) LinkedIn URL. Otherwise the value may show but no
  // action link is emitted.
  const phoneDigits = contact.phone?.replace(/\D/g, "") ?? "";
  const phoneCallable = phoneDigits.length >= 8 && phoneDigits.length <= 15;
  const linkedinHref = (() => {
    if (!contact.linkedin) return undefined;
    try {
      const url = new URL(contact.linkedin);
      return url.protocol === "https:" || url.protocol === "http:"
        ? url.href
        : undefined;
    } catch {
      return undefined;
    }
  })();
  const hasAnyContact = Boolean(
    contact.phone || contact.email || contact.linkedin,
  );
  const subtitle = [
    profile.title && profile.company
      ? `${profile.title} @ ${profile.company}`
      : profile.title || profile.company,
    profile.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ScreenId id="PEOPLE-02" className="mb-2" />
      <PageHeader
        title="Member profile"
        description="Contact this member only through the fields they permit."
      />
      <Link
        href="/people"
        className="mb-3 inline-flex min-h-tap items-center px-1 font-medium text-navy-text"
      >
        ← Back to People
      </Link>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
        <Card className="ui-profile-card">
          <Avatar
            name={profile.name}
            src={profile.image ?? undefined}
            size="lg"
            className="mb-3"
          />
          <h3 className="mb-0.5 text-[17px] font-semibold text-ink">
            {profile.name}
          </h3>
          {subtitle ? (
            <p className="mb-3 text-ink-secondary">{subtitle}</p>
          ) : null}
          {profile.tags.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {profile.tags.map((label) => (
                <Tag key={label}>{label}</Tag>
              ))}
            </div>
          ) : null}
          {profile.bio ? (
            <p className="text-pretty text-ink-secondary">{profile.bio}</p>
          ) : (
            <p className="text-ink-muted">No professional summary provided.</p>
          )}
        </Card>

        <Card
          aria-labelledby="permitted-contact-title"
          className="ui-contact-card"
        >
          <h3
            id="permitted-contact-title"
            className="mb-3 text-base font-semibold text-ink"
          >
            Permitted contact
          </h3>
          {hasAnyContact ? (
            <div className="grid gap-3">
              {contact.phone ? (
                <div className="grid gap-2">
                  {phoneCallable ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        href={`tel:+${phoneDigits}`}
                        variant="primary"
                        className="flex-1"
                      >
                        Call
                      </Button>
                      <Button
                        href={`https://wa.me/${phoneDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="secondary"
                        className="flex-1"
                      >
                        WhatsApp
                      </Button>
                    </div>
                  ) : null}
                  <p className="font-mono text-[15px] font-medium text-ink">
                    {contact.phone}
                  </p>
                </div>
              ) : null}
              {contact.email ? (
                <div className="grid gap-2">
                  <Button
                    href={`mailto:${contact.email}`}
                    variant="secondary"
                  >
                    Email
                  </Button>
                  <p className="truncate font-mono text-[13px] text-ink-secondary">
                    {contact.email}
                  </p>
                </div>
              ) : null}
              {linkedinHref ? (
                <Button
                  href={linkedinHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                >
                  Open LinkedIn
                </Button>
              ) : null}
              <small className="text-xs text-ink-muted">
                Direct external actions. Automated messaging is not enabled.
              </small>
            </div>
          ) : (
            <div className="rounded-control border border-dashed border-border-strong bg-surface-subtle p-3.5">
              <strong className="block font-semibold text-ink">
                This member has not shared direct contact
              </strong>
              <p className="mt-1 text-ink-secondary">
                Contact fields are shared at each member&apos;s discretion. No
                hidden values are present on this page.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
