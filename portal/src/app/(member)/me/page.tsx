import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { linkedInConfigured, requireViewer } from "@/lib/auth";
import { hasAdminRole, memberAccessError } from "@/lib/authz";
import { isLinkedInLinked } from "@/lib/account/linked-accounts";
import { getPreferredContactEmailState } from "@/lib/account/preferred-contact-email";
// The codes, the copy and the /sign-in forwarding allowlist share one table so
// they cannot drift apart.
import { linkErrorMessage } from "@/lib/account/link-errors";
import { resolveLandingPath } from "@/lib/account/routing";
import { getDirectoryFilters } from "@/lib/directory/queries";
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  PageHeader,
  ScreenId,
  Tag,
  cx,
} from "@/components/ui";
import { type VisibilityChoice } from "./visibility-form";
import { ConnectLinkedInForm } from "./connect-linkedin-form";
import { signOutAction } from "./actions";

// HOME-04: a calm, view-first read of your own profile, contact-visibility
// choices, and account actions - editing and Saved each got their own
// screen (HOME-06 /me/edit, HOME-05 /saved) so this page stops leading with
// forms members rarely touch (client feedback). All own contact values are
// visible to self, each labeled with its current audience. An empty value
// reaches nobody whatever the stored choice (projectContact drops it), so it
// reads "Not added" / "Not shown" with a link to add it, and the stored
// choice is left alone to apply once a value exists. Reads the viewer's OWN
// profile row directly (self-scoped; the shared lib exposes no own-profile
// read yet).

export const metadata = { title: "Me · MCAC Members Portal" };

const VISIBILITY_LABELS: Record<VisibilityChoice, string> = {
  visible: "Visible to approved members",
  hidden: "Hidden",
  admin_only: "Admin-only",
};

const VISIBILITY_SHORT: Record<VisibilityChoice, string> = {
  visible: "visible",
  hidden: "hidden",
  admin_only: "admin-only",
};

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ linkError?: string | string[] }>;
}) {
  // Re-authorize here (defense in depth): this page reads its own profile
  // row directly, so it cannot rely on the layout guard alone.
  const maybeViewer = await requireViewer();
  const denied = memberAccessError(maybeViewer);
  if (denied || !maybeViewer) redirect(await resolveLandingPath(maybeViewer));
  const viewer = maybeViewer;

  const { linkError } = await searchParams;
  const linkErrorCode = Array.isArray(linkError) ? linkError[0] : linkError;

  const [profile, myTagRows, filtersRes, linkedIn, emailState] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(tables.profiles.userId, viewer.id),
    }),
    db.query.memberTags.findMany({
      where: eq(tables.memberTags.userId, viewer.id),
    }),
    getDirectoryFilters(viewer),
    isLinkedInLinked(viewer.id),
    getPreferredContactEmailState(viewer.id),
  ]);

  // OAuth providers can return a stale error parameter after the account was
  // already linked successfully. The stored account link is authoritative;
  // do not show a failure banner for a connection that exists.
  const errorMessage =
    !linkedIn && linkErrorCode ? linkErrorMessage(linkErrorCode) : null;

  if (!profile || !filtersRes.ok || !emailState) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ScreenId id="HOME-04" className="mb-2" />
        <PageHeader title="Me" />
        <ErrorState
          title="Profile could not load"
          body="Your account actions remain available. Try again."
          action={
            <Button href="/me" variant="secondary">
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const allTags = filtersRes.data.tags;
  const myTagIds = myTagRows.map((t) => t.tagId);
  const myTagLabels = allTags
    .filter((t) => myTagIds.includes(t.id))
    .map((t) => t.label);
  const isAdmin = hasAdminRole(viewer.role);
  const summaryLine = [
    profile.profession,
    profile.city,
    profile.title,
    profile.company,
  ]
    .filter(Boolean)
    .join(" · ");

  // addHref points at the field's input on /me/edit. Email has none: it is
  // the sign-in address, which that page does not edit.
  const contactRows: {
    label: string;
    value: string;
    visibility: VisibilityChoice;
    addHref: string | null;
  }[] = [
    {
      label: "Phone",
      value: profile.phone,
      visibility: profile.phoneVisibility,
      addHref: "/me/edit#me-phone",
    },
    {
      label: "Email",
      value: viewer.email,
      visibility: profile.emailVisibility,
      addHref: null,
    },
    {
      label: "LinkedIn",
      value: profile.linkedinUrl,
      visibility: profile.linkedinVisibility,
      addHref: "/me/edit#me-linkedin",
    },
  ];
  const visibilitySummary = contactRows
    .map((row) =>
      row.value
        ? `${row.label} ${VISIBILITY_SHORT[row.visibility]}`
        : `${row.label} not added`,
    )
    .join(" · ");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div>
        <ScreenId id="HOME-04" className="mb-2" />
        <PageHeader
          title="Me"
          description="Your profile, contact visibility, and account."
        />
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-control border border-danger/35 bg-danger-bg px-3 py-2.5 text-sm text-danger"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-container bg-navy p-4.5 text-white">
        <div className="grid grid-cols-[54px_minmax(0,1fr)] items-center gap-3">
          <Avatar
            name={viewer.name}
            src={viewer.image ?? undefined}
            size="lg"
            className="bg-white/15"
            decorative
          />
          <div className="min-w-0">
            <h2 className="mb-0.5 text-base font-semibold">{viewer.name}</h2>
            {summaryLine ? (
              <p className="truncate text-[0.8125rem] text-[#c3cfdf]">{summaryLine}</p>
            ) : null}
            <p className="text-[0.8125rem] text-[#c3cfdf]">{visibilitySummary}</p>
          </div>
        </div>
        <Button
          href="/me/edit"
          variant="secondary"
          size="sm"
          className="mt-3.5 border-white/25 bg-white/15 text-white hover:bg-white/25"
        >
          Edit profile
        </Button>
      </section>

      <Link
        href="/saved"
        className="flex min-h-[64px] items-center justify-between gap-3 rounded-container border border-border bg-surface px-3.5 py-3 hover:border-border-strong active:bg-surface-subtle"
      >
        <span>
          <strong className="block font-semibold text-ink">Saved</strong>
          <small className="block text-[0.8125rem] text-ink-secondary">
            Posts you&apos;ve bookmarked from Home
          </small>
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-navy-text">
          View saved
          <CaretRightIcon size={16} aria-hidden="true" />
        </span>
      </Link>

      {isAdmin ? (
        <Link
          href="/admin"
          className="flex min-h-[64px] items-center justify-between gap-3 rounded-container border border-border bg-surface px-3.5 py-3 hover:border-border-strong active:bg-surface-subtle"
        >
          <span>
            <strong className="block font-semibold text-ink">
              Administration
            </strong>
            <small className="block text-[0.8125rem] text-ink-secondary">
              Review applicants, policies, exports, and moderation
            </small>
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-navy-text">
            Open admin
            <CaretRightIcon size={16} aria-hidden="true" />
          </span>
        </Link>
      ) : null}

      <Card>
        <h2 className="mb-1 text-base font-semibold text-ink">
          Your contact details
        </h2>
        <p className="text-[0.8125rem] text-ink-secondary">
          Only you see all of this. Other members see only what you mark
          visible.
        </p>
        <Link
          href="/privacy"
          className="mb-1 inline-flex min-h-tap items-center text-[0.8125rem] font-medium text-navy-text underline"
        >
          Read the privacy notice
        </Link>
        <dl className="m-0 grid">
          {contactRows.map((row) => (
            <div
              key={row.label}
              className={cx(
                "grid grid-cols-[92px_minmax(0,1fr)] gap-x-2.5 gap-y-1 border-t border-border py-2.5 first:border-t-0 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center",
                // The Add link is a full tap target, taller than a value
                // line, so center the label against it.
                row.value ? "items-start" : "items-center",
              )}
            >
              <dt className="pt-0.5 text-xs font-medium text-ink-muted">
                {row.label}
              </dt>
              {row.value ? (
                <dd className="m-0 truncate text-[0.8125rem] font-medium text-ink">
                  {row.value}
                </dd>
              ) : (
                <dd className="m-0 flex flex-wrap items-center gap-x-2 text-[0.8125rem]">
                  <span className="text-ink-secondary">Not added</span>
                  {row.addHref ? (
                    <Link
                      href={row.addHref}
                      className="inline-flex min-h-tap items-center px-1 font-medium text-navy-text underline"
                    >
                      Add<span className="sr-only"> {row.label}</span>
                    </Link>
                  ) : null}
                </dd>
              )}
              <dd className="col-start-2 m-0 sm:col-start-auto">
                {row.value ? (
                  <Tag selected={row.visibility === "visible"}>
                    {VISIBILITY_LABELS[row.visibility]}
                  </Tag>
                ) : (
                  <Tag>Not shown</Tag>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="min-w-0">
            <strong className="block text-[0.8125rem] font-semibold text-ink">
              Email for MCAC updates
            </strong>
            <span className="block truncate text-[0.8125rem] text-ink-secondary">
              {emailState.effectiveEmail}
            </span>
            <small className="block text-xs text-ink-muted">
              Only MCAC uses this. It is not shown in the directory.
            </small>
          </div>
          <div className="flex items-center gap-2">
            <Tag selected={Boolean(emailState.preferredEmail)}>
              {emailState.preferredEmail ? "Verified" : "Sign-in email"}
            </Tag>
            <Link
              href="/me/edit"
              className="inline-flex min-h-tap items-center px-1 text-[0.8125rem] font-medium text-navy-text underline"
            >
              Change
            </Link>
          </div>
        </div>
        {myTagLabels.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {myTagLabels.map((label) => (
              <Tag key={label}>{label}</Tag>
            ))}
          </div>
        ) : null}
      </Card>

      {linkedInConfigured ? (
        <Card className="grid gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              LinkedIn sign-in
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-secondary">
              Connect LinkedIn to use it for future MCAC sign-ins.
            </p>
          </div>
          {linkedIn ? (
            <p
              data-testid="linkedin-connected"
              className="rounded-control bg-surface-subtle px-3 py-2.5 text-sm font-medium text-ink"
            >
              LinkedIn is connected to your MCAC account.
            </p>
          ) : (
            <ConnectLinkedInForm />
          )}
        </Card>
      ) : null}

      <Card className="flex items-center justify-between gap-3">
        <div>
          <strong className="block font-semibold text-ink">Sign out</strong>
          <small className="block text-[0.8125rem] text-ink-secondary">
            You can sign back in with the same account at any time.
          </small>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Card>
    </div>
  );
}
