import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { memberAccessError, sectionEnabledFor } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { listFeed, type FeedView } from "@/lib/posts/queries";
import { POST_TYPE_NAMES, type PostTypeName } from "@/lib/posts/types";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  ScreenId,
  cx,
} from "@/components/ui";
import { TYPE_PLURAL_LABELS } from "../posts/display";
import { FeedCard } from "../posts/feed-card";

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
  page?: number;
}): string {
  const search = new URLSearchParams();
  if (params.view !== "active") search.set("view", params.view);
  if (params.type) search.set("type", params.type);
  if (params.q) search.set("q", params.q);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/home?${qs}` : "/home";
}

function chipClass(active: boolean, kind: "view" | "type"): string {
  return cx(
    kind === "view" ? "ui-view-chip" : "ui-type-chip",
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
  const pageNum = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);

  const enabledFlags = await Promise.all(
    POST_TYPE_NAMES.map((t) => sectionEnabledFor(t, viewer!.id)),
  );
  const enabledTypes = POST_TYPE_NAMES.filter((_, i) => enabledFlags[i]);

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
          body="Your effective section settings hide member posts. Other areas of the portal remain available."
        />
      </div>
    );
  }

  const result = await listFeed(viewer, {
    view,
    type,
    search: q,
    page: pageNum,
  });

  if (!result.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        {result.code === "section_disabled" ? (
          <ErrorState
            title="This section is not available"
            body="Its filter and posts are hidden together by your effective section settings. Other posts remain available."
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
  const filtered = Boolean(q || type);
  const filterSummary = [
    type ? TYPE_PLURAL_LABELS[type] : null,
    q ? `"${q}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-3xl">
      {header}

      <div className="ui-feed-toolbar">
        <nav aria-label="Feed views" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.view}
              href={feedHref({ view: v.view, type, q })}
              aria-current={view === v.view ? "page" : undefined}
              className={chipClass(view === v.view, "view")}
            >
              {v.label}
            </Link>
          ))}
        </nav>

        <details className="group mt-3" open={filtered}>
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 border-t border-border pt-3 text-sm font-medium text-ink-secondary marker:hidden">
            <span>Filter posts</span>
            <span className="flex min-w-0 items-center gap-2 text-right text-xs text-ink-muted">
              {filterSummary || "Type or keyword"}
              <span
                aria-hidden="true"
                className="inline-block transition-transform group-open:rotate-180"
              >
                ↓
              </span>
            </span>
          </summary>

          <div className="mt-2 grid gap-3">
            {enabledTypes.length > 1 ? (
              <nav aria-label="Post types" className="flex flex-wrap gap-1">
                <Link
                  href={feedHref({ view, q })}
                  aria-current={type === undefined ? "true" : undefined}
                  className={chipClass(type === undefined, "type")}
                >
                  All
                </Link>
                {enabledTypes.map((t) => (
                  <Link
                    key={t}
                    href={feedHref({ view, type: t, q })}
                    aria-current={type === t ? "true" : undefined}
                    className={chipClass(type === t, "type")}
                  >
                    {TYPE_PLURAL_LABELS[t]}
                  </Link>
                ))}
              </nav>
            ) : null}

            <form action="/home" method="get" role="search">
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
            </form>
          </div>
        </details>
      </div>

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
              href={feedHref({ view, type, q, page: page - 1 })}
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
              href={feedHref({ view, type, q, page: page + 1 })}
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
