import Link from "next/link";
import { redirect } from "next/navigation";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { NewspaperIcon } from "@phosphor-icons/react/dist/ssr/Newspaper";
import { requireViewer } from "@/lib/auth";
import { enabledSections, memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { feedHref, feedViewParam, readFeedParams } from "@/lib/posts/feed-url";
import { listFeed, type FeedView } from "@/lib/posts/queries";
import {
  MANDATE_TYPE_LABELS,
  OPPORTUNITY_MANDATE_TYPES,
} from "@/lib/posts/opportunity";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Label,
  PageHeader,
  ScreenId,
  Select,
  cx,
} from "@/components/ui";
import { TYPE_PLURAL_LABELS } from "../posts/display";
import { FeedCard } from "../posts/feed-card";

export const metadata = { title: "Home - MCAC Members Portal" };

// HOME-01 - Home feed. View tabs, per-type filter chips (section-gated),
// search, pagination. Rendered as a child of the (member) shell layout.

// "old" is the stored status of expired posts. The tab reads "Expired" and
// its links say ?view=expired (see lib/posts/feed-url.ts).
const VIEWS: { view: FeedView; label: string }[] = [
  { view: "active", label: "Active" },
  { view: "tagged", label: "Tagged for me" },
  { view: "old", label: "Expired" },
  { view: "mine", label: "My posts" },
];

const EMPTY_COPY: Record<FeedView, { title: string; body: string }> = {
  active: {
    title: "The network is ready for its first post",
    body: "No business opportunities, jobs, knowledge, or events have been posted yet.",
  },
  tagged: {
    title: "Nothing tagged for you yet",
    body: "When a member tags you in a post it will appear here.",
  },
  old: {
    title: "No expired posts",
    body: "Business opportunities and jobs move here after their expiry date.",
  },
  mine: {
    title: "You have not posted anything yet",
    body: "Posts you publish will be listed here.",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

// Small caption above each tab row. The rows point at it with
// aria-labelledby, so the visible word is also the row's name.
const ROW_LABEL_CLASS = "mb-1 text-xs font-medium text-ink-muted";

function viewClass(active: boolean): string {
  return cx(
    "ui-view-chip inline-flex min-h-tap min-w-0 items-center justify-center rounded-[6px] px-2 text-center text-[0.8125rem] font-medium transition-[color,background-color,box-shadow,transform]",
    active
      ? "bg-surface font-semibold text-navy-text shadow-sm"
      : "text-ink-secondary hover:bg-surface/70",
  );
}

function typeClass(active: boolean): string {
  return cx(
    "ui-type-chip inline-flex min-h-tap flex-none items-center border-b-2 px-2.5 text-[0.8125rem] font-medium transition-[color,border-color,transform]",
    active
      ? "border-navy text-navy-text"
      : "border-transparent text-ink-muted hover:text-ink-secondary",
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));

  // Opportunity filters apply only with ?type=opportunity; readFeedParams
  // drops them elsewhere and sends older All-tab filter links to that tab.
  const { params, redirectTo } = readFeedParams(await searchParams);
  if (redirectTo) redirect(redirectTo);
  const {
    view,
    type,
    q,
    mandateType,
    industry,
    geography,
    page: pageNum,
  } = params;

  const [enabledTypes, result] = await Promise.all([
    enabledSections(viewer!.id),
    listFeed(viewer, {
      view,
      type,
      search: q,
      mandateType,
      industry,
      geography,
      page: pageNum,
    }),
  ]);

  const header = (
    <PageHeader
      title="Home"
      description="Business opportunities, jobs, knowledge, and events from the network."
      action={<ScreenId id="HOME-01" />}
    />
  );

  if (enabledTypes.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        <ErrorState
          title="This section is not available"
          body="An admin has turned off posts for your account. The rest of the portal still works."
        />
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        {result.code === "section_disabled" ? (
          <ErrorState
            title="This section is not available"
            body="An administrator has disabled this post type for your account. Other posts remain available."
            action={
              <Button href={feedHref({ view, q })} variant="secondary">
                Back to available posts
              </Button>
            }
          />
        ) : (
          <ErrorState
            title="Home could not refresh"
            body="Try again in a moment."
            action={
              <Button href={feedHref({ view, type, q })} variant="secondary">
                Retry
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const { items, page, pageSize, total } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(q || type || mandateType || industry || geography);
  const opportunityFilterCount = [mandateType, industry, geography].filter(
    Boolean,
  ).length;
  // A member who can see only business opportunities gets no type row, so
  // their All feed is the opportunity feed and the filters show there too.
  const showOpportunityFilters =
    type === "opportunity" ||
    (enabledTypes.length === 1 && enabledTypes[0] === "opportunity");

  return (
    <div className="ui-feed-page mx-auto w-full max-w-3xl">
      <PageHeader
        title="Home"
        description={
          <>
            <span className="sm:hidden">Latest from the MCAC network.</span>
            <span className="hidden sm:inline">
              Business opportunities, jobs, knowledge, and events from the network.
            </span>
          </>
        }
        action={<ScreenId id="HOME-01" />}
        className="ui-feed-heading"
      />

      <p id="home-view-label" className={ROW_LABEL_CLASS}>
        Show
      </p>
      <nav
        aria-labelledby="home-view-label"
        className="ui-view-switcher mb-3 grid grid-cols-4 gap-1 rounded-control bg-surface-sunken p-1"
      >
        {VIEWS.map((v) => (
          <Link
            key={v.view}
            href={feedHref({ view: v.view, type, q, mandateType, industry, geography })}
            aria-current={view === v.view ? "page" : undefined}
            className={viewClass(view === v.view)}
          >
            {v.view === "tagged" ? (
              <>
                <span className="sr-only">Tagged for me</span>
                <span aria-hidden="true" className="sm:hidden">
                  Tagged
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  Tagged for me
                </span>
              </>
            ) : (
              v.label
            )}
          </Link>
        ))}
      </nav>

      {enabledTypes.length > 1 ? (
        <>
          <p id="home-type-label" className={ROW_LABEL_CLASS}>
            Type
          </p>
          <nav
            aria-labelledby="home-type-label"
            className="ui-type-switcher -mx-1 mb-2 flex overflow-x-auto px-1"
          >
            <Link
              href={feedHref({ view, q })}
              aria-current={type === undefined ? "true" : undefined}
              className={typeClass(type === undefined)}
            >
              All
            </Link>
            {enabledTypes.map((t) => (
              <Link
                key={t}
                href={feedHref({ view, type: t, q })}
                aria-current={type === t ? "true" : undefined}
                className={typeClass(type === t)}
              >
                {TYPE_PLURAL_LABELS[t]}
              </Link>
            ))}
          </nav>
        </>
      ) : null}

      <form
        action="/home"
        method="get"
        role="search"
        className="ui-feed-toolbar mb-4 grid gap-2.5"
      >
        {view !== "active" ? (
          <input type="hidden" name="view" value={feedViewParam(view)} />
        ) : null}
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search posts"
            aria-label="Search posts"
          />
          <Button type="submit" className="px-4">
            Search
          </Button>
        </div>
        {showOpportunityFilters ? (
          <details
            className="ui-filter-disclosure rounded-control border border-border bg-surface"
            open={opportunityFilterCount > 0}
          >
            <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium text-ink-secondary">
              <span className="flex items-center gap-2">
                Business opportunity filters
                {opportunityFilterCount > 0 ? (
                  <span className="grid size-5 place-items-center rounded-full bg-navy text-[0.6875rem] font-semibold text-white">
                    {opportunityFilterCount}
                  </span>
                ) : null}
              </span>
              <CaretDownIcon
                aria-hidden="true"
                size={16}
                className="ui-filter-caret text-ink-muted"
              />
            </summary>
            <div className="grid gap-2.5 border-t border-border p-3 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label htmlFor="home-mandate-type">Mandate type</Label>
                <Select
                  id="home-mandate-type"
                  name="mandateType"
                  defaultValue={mandateType ?? ""}
                >
                  <option value="">All mandate types</option>
                  {OPPORTUNITY_MANDATE_TYPES.map((kind) => (
                    <option key={kind} value={kind}>
                      {MANDATE_TYPE_LABELS[kind]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="home-industry">Industry</Label>
                <Input
                  id="home-industry"
                  name="industry"
                  defaultValue={industry ?? ""}
                  placeholder="Industry"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="home-geography">Geography</Label>
                <Input
                  id="home-geography"
                  name="geography"
                  defaultValue={geography ?? ""}
                  placeholder="Geography"
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-3">
                <Button type="submit" variant="secondary">
                  Apply filters
                </Button>
                {opportunityFilterCount > 0 ? (
                  <Link
                    href={feedHref({ view, type, q })}
                    className="inline-flex min-h-tap items-center text-sm font-medium text-ink-muted hover:text-navy-text"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>
            </div>
          </details>
        ) : null}
      </form>

      {items.length === 0 ? (
        filtered ? (
          <EmptyState
            glyph={<MagnifyingGlassIcon aria-hidden="true" size={22} />}
            title="No posts match"
            body={
              q
                ? `Nothing in this view matches "${q}". Clear the search or filters to see more.`
                : "Nothing in this view matches the selected filters."
            }
            action={
              <Button href={feedHref({ view })} variant="secondary">
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            glyph={<NewspaperIcon aria-hidden="true" size={22} />}
            title={EMPTY_COPY[view].title}
            body={EMPTY_COPY[view].body}
            action={
              view === "active" || view === "mine" ? (
                <Button href="/share">Post something</Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {total > pageSize ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          {page > 1 ? (
            <Button
              href={feedHref({ view, type, q, mandateType, industry, geography, page: page - 1 })}
              variant="secondary"
            >
              Newer
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button
              href={feedHref({ view, type, q, mandateType, industry, geography, page: page + 1 })}
              variant="secondary"
            >
              Older
            </Button>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}
