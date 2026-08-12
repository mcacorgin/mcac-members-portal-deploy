import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { enabledSections, memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { listFeed, type FeedView } from "@/lib/posts/queries";
import { POST_TYPE_NAMES, type PostTypeName } from "@/lib/posts/types";
import {
  MANDATE_TYPE_LABELS,
  OPPORTUNITY_MANDATE_TYPES,
  type OpportunityMandateType,
} from "@/lib/posts/opportunity";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
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

const VIEWS: { view: FeedView; label: string }[] = [
  { view: "active", label: "Active" },
  { view: "tagged", label: "Tagged for me" },
  { view: "old", label: "Old" },
  { view: "mine", label: "My posts" },
];

const EMPTY_COPY: Record<FeedView, { title: string; body: string }> = {
  active: {
    title: "The network is ready for its first share",
    body: "No opportunities, jobs, knowledge, or events have been posted yet.",
  },
  tagged: {
    title: "Nothing tagged for you yet",
    body: "When a member tags you in a post it will appear here.",
  },
  old: {
    title: "No old posts",
    body: "Expired opportunities move here after their expiry date.",
  },
  mine: {
    title: "You have not shared anything yet",
    body: "Posts you publish will be listed here.",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function feedHref(params: {
  view: FeedView;
  type?: PostTypeName;
  q?: string;
  mandateType?: OpportunityMandateType;
  industry?: string;
  geography?: string;
  page?: number;
}): string {
  const search = new URLSearchParams();
  if (params.view !== "active") search.set("view", params.view);
  if (params.type) search.set("type", params.type);
  if (params.q) search.set("q", params.q);
  if (params.mandateType) search.set("mandateType", params.mandateType);
  if (params.industry) search.set("industry", params.industry);
  if (params.geography) search.set("geography", params.geography);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/home?${qs}` : "/home";
}

function chipClass(active: boolean): string {
  return cx(
    "inline-flex min-h-tap items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
    active
      ? "border-navy bg-navy text-white"
      : "border-border-strong bg-surface text-ink-secondary hover:bg-surface-subtle",
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

  const sp = await searchParams;
  const viewParam = first(sp.view);
  const view: FeedView = VIEWS.some((v) => v.view === viewParam)
    ? (viewParam as FeedView)
    : "active";
  const typeParam = first(sp.type);
  const type: PostTypeName | undefined = POST_TYPE_NAMES.includes(
    typeParam as PostTypeName,
  )
    ? (typeParam as PostTypeName)
    : undefined;
  const q = first(sp.q)?.trim().slice(0, 200) || undefined;
  const mandateRaw = first(sp.mandateType);
  const mandateType = OPPORTUNITY_MANDATE_TYPES.includes(
    mandateRaw as OpportunityMandateType,
  )
    ? (mandateRaw as OpportunityMandateType)
    : undefined;
  const industry = first(sp.industry)?.trim().slice(0, 160) || undefined;
  const geography = first(sp.geography)?.trim().slice(0, 160) || undefined;
  const pageNum = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);

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
      description="Opportunities, jobs, knowledge, and events from the network."
      action={<ScreenId id="HOME-01" />}
    />
  );

  if (enabledTypes.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        <ErrorState
          title="This section is not available"
          body="An administrator has disabled member posts for your account. Other areas of the portal remain available."
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      {header}

      <nav aria-label="Feed views" className="mb-3 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.view}
            href={feedHref({ view: v.view, type, q, mandateType, industry, geography })}
            aria-current={view === v.view ? "page" : undefined}
            className={chipClass(view === v.view)}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {enabledTypes.length > 1 ? (
        <nav aria-label="Post types" className="mb-3 flex flex-wrap gap-2">
          <Link
            href={feedHref({ view, q, mandateType, industry, geography })}
            aria-current={type === undefined ? "true" : undefined}
            className={chipClass(type === undefined)}
          >
            All
          </Link>
          {enabledTypes.map((t) => (
            <Link
              key={t}
              href={feedHref({ view, type: t, q })}
              aria-current={type === t ? "true" : undefined}
              className={chipClass(type === t)}
            >
              {TYPE_PLURAL_LABELS[t]}
            </Link>
          ))}
        </nav>
      ) : null}

      <form action="/home" method="get" role="search" className="mb-4 grid gap-3">
        {view !== "active" ? (
          <input type="hidden" name="view" value={view} />
        ) : null}
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search posts"
          aria-label="Search posts"
        />
        {!type || type === "opportunity" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Select name="mandateType" defaultValue={mandateType ?? ""} aria-label="Mandate type">
              <option value="">All mandate types</option>
              {OPPORTUNITY_MANDATE_TYPES.map((kind) => (
                <option key={kind} value={kind}>
                  {MANDATE_TYPE_LABELS[kind]}
                </option>
              ))}
            </Select>
            <Input name="industry" defaultValue={industry ?? ""} placeholder="Filter by industry" aria-label="Filter by industry" />
            <Input name="geography" defaultValue={geography ?? ""} placeholder="Filter by geography" aria-label="Filter by geography" />
          </div>
        ) : null}
        <Button type="submit" variant="secondary" className="justify-self-start">
          Apply filters
        </Button>
      </form>

      {items.length === 0 ? (
        filtered ? (
          <EmptyState
            glyph="?"
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
            glyph="+"
            title={EMPTY_COPY[view].title}
            body={EMPTY_COPY[view].body}
            action={
              view === "active" || view === "mine" ? (
                <Button href="/share">Share something</Button>
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
