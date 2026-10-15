import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { requireViewer } from "@/lib/auth";
import { getMemberProfile } from "@/lib/directory/queries";
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  ScreenId,
  Tag,
} from "@/components/ui";

// PEOPLE-02: member profile with permitted contact actions. The contact block
// is driven ONLY by the projected contact object: a field that is undefined
// renders no action at all - never a disabled control, never a hidden value.

// The tab title and the page read the same profile. cache() makes that one
// query per request, and the title can only name someone the page itself
// would show: getMemberProfile refuses anyone else.
const loadProfile = cache(async (id: string) =>
  getMemberProfile(await requireViewer(), id),
);

// Profiles list every expertise area a member picked, up to 15 or so. The
// first few show; the rest wait behind a "+N more" toggle.
const VISIBLE_TAGS = 6;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const res = await loadProfile(id);
  return {
    title: res.ok
      ? `${res.data.name} · MCAC Members Portal`
      : "Member profile · MCAC Members Portal",
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await loadProfile(id);

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
  const extraTags = profile.tags.slice(VISIBLE_TAGS);
  const subtitle = [
    profile.profession,
    profile.title && profile.company
      ? `${profile.title} at ${profile.company}`
      : profile.title || profile.company,
    profile.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ScreenId id="PEOPLE-02" className="mb-2" />
      <Link
        href="/people"
        className="mb-3 inline-flex min-h-tap items-center gap-1 px-1 font-medium text-navy-text"
      >
        <CaretLeftIcon size={16} aria-hidden="true" />
        People
      </Link>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
        <Card className="ui-profile-card">
          <Avatar
            name={profile.name}
            src={profile.image ?? undefined}
            size="lg"
            className="mb-3"
            decorative
          />
          <h1 className="ui-page-title mb-0.5 text-[1.375rem] font-semibold text-balance text-ink">
            {profile.name}
          </h1>
          {subtitle ? (
            <p className="mb-3 text-ink-secondary">{subtitle}</p>
          ) : null}
          {profile.tags.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {profile.tags.slice(0, VISIBLE_TAGS).map((label) => (
                <Tag key={label}>{label}</Tag>
              ))}
              {extraTags.length > 0 ? (
                // No client JS: a closed <details> keeps the rest out of
                // sight, and when open it takes its own row below.
                <details className="group/more-tags open:basis-full">
                  <summary className="inline-flex min-h-tap cursor-pointer list-none items-center rounded-control px-1.5 text-sm font-medium text-navy-text hover:underline [&::-webkit-details-marker]:hidden">
                    <span className="group-open/more-tags:hidden">
                      +{extraTags.length} more
                      <span className="sr-only"> expertise areas</span>
                    </span>
                    <span className="hidden group-open/more-tags:inline">
                      Show fewer
                    </span>
                  </summary>
                  <div className="flex flex-wrap gap-1.5">
                    {extraTags.map((label) => (
                      <Tag key={label}>{label}</Tag>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
          {profile.bio ? (
            <p className="whitespace-pre-line text-pretty text-ink-secondary">
              {profile.bio}
            </p>
          ) : (
            <p className="text-ink-muted">No summary yet.</p>
          )}
        </Card>

        <Card
          aria-labelledby="permitted-contact-title"
          className="ui-contact-card"
        >
          <h2
            id="permitted-contact-title"
            className="mb-3 text-base font-semibold text-ink"
          >
            Contact details
          </h2>
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
                  <p className="font-mono text-[0.9375rem] font-medium text-ink">
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
                  <p className="truncate font-mono text-[0.8125rem] text-ink-secondary">
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
                Buttons open your phone&apos;s call, WhatsApp or email app.
              </small>
            </div>
          ) : (
            <div className="rounded-control border border-dashed border-border-strong bg-surface-subtle p-3.5">
              <strong className="block font-semibold text-ink">
                No contact details shared
              </strong>
              <p className="mt-1 text-ink-secondary">
                This member has not shared a phone, email or LinkedIn link. An
                MCAC admin can put you in touch.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
