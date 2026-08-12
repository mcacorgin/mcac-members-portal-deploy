import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import {
  getDirectoryFilters,
  searchMembers,
} from "@/lib/directory/queries";
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Label,
  PageHeader,
  ScreenId,
  Select,
  Tag,
  cx,
} from "@/components/ui";

// PEOPLE-01: directory search. Server component driven entirely by
// searchParams; filters submit as a GET form and expertise chips are links,
// so everything works without client JS.

export const metadata = { title: "People · MCAC Members Portal" };

type SearchParams = Promise<{
  q?: string | string[];
  city?: string | string[];
  tag?: string | string[];
  page?: string | string[];
}>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function chipHref(params: { q: string; city: string; tag: string }): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.city) search.set("city", params.city);
  if (params.tag) search.set("tag", params.tag);
  const qs = search.toString();
  return qs ? `/people?${qs}` : "/people";
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const city = first(sp.city);
  const tagId = first(sp.tag);
  const page = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);
  const hasFilters = Boolean(q || city || tagId);

  const viewer = await requireViewer();
  const [filtersRes, resultRes] = await Promise.all([
    getDirectoryFilters(viewer),
    searchMembers(viewer, {
      q: q || undefined,
      city: city || undefined,
      tagId: tagId || undefined,
      page,
    }),
  ]);

  if (!resultRes.ok || !filtersRes.ok) {
    const message = !resultRes.ok
      ? resultRes.message
      : !filtersRes.ok
        ? filtersRes.message
        : "";
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ScreenId id="PEOPLE-01" className="mb-2" />
        <PageHeader title="People" />
        <ErrorState
          title="People search unavailable"
          body={message}
          action={
            <Button href="/people" variant="secondary">
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const { cities, tags } = filtersRes.data;
  const { rows, total, pageSize } = resultRes.data;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (city) search.set("city", city);
    if (tagId) search.set("tag", tagId);
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `/people?${qs}` : "/people";
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="People"
        description="Find members by name, city, or expertise. Contact details appear only when shared."
        action={
          <span className="inline-flex min-h-tap items-center text-sm text-ink-muted">
            {total} {total === 1 ? "member" : "members"}
          </span>
        }
        className="ui-directory-heading"
      />

      <form
        method="get"
        action="/people"
        role="search"
        className="ui-directory-toolbar mb-3 grid gap-2.5"
      >
        <Label htmlFor="people-q" className="text-sm font-medium">
          Search members
        </Label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            id="people-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, company, or city"
          />
          <Button type="submit" className="px-4">
            Search
          </Button>
        </div>
        {tagId ? <input type="hidden" name="tag" value={tagId} /> : null}
        <details
          className="ui-filter-disclosure rounded-control border border-border bg-surface"
          open={Boolean(city)}
        >
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium text-ink-secondary">
            <span>City filter</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="max-w-40 truncate text-ink-muted">
                {city || "All cities"}
              </span>
              <span
                aria-hidden="true"
                className="ui-filter-caret text-base text-ink-muted"
              >
                ⌄
              </span>
            </span>
          </summary>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-border p-3">
            <Select
              id="people-city"
              name="city"
              defaultValue={city}
              aria-label="City"
            >
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </div>
        </details>
      </form>

      <div
        className="ui-expertise-strip -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1"
        aria-label="Filter by expertise"
      >
        <Link
          href={chipHref({ q, city, tag: "" })}
          aria-current={!tagId ? "true" : undefined}
          className={cx(
            "ui-expertise-chip flex min-h-tap flex-none items-center border-b-2 px-2.5 text-[13px] font-medium transition-[color,border-color,transform]",
            !tagId
              ? "border-navy font-semibold text-navy-text"
              : "border-transparent text-ink-muted hover:text-ink-secondary",
          )}
        >
          All expertise
        </Link>
        {tags.map((t) => {
          const active = t.id === tagId;
          return (
            <Link
              key={t.id}
              href={chipHref({ q, city, tag: active ? "" : t.id })}
              aria-current={active ? "true" : undefined}
              className={cx(
                "ui-expertise-chip flex min-h-tap flex-none items-center border-b-2 px-2.5 text-[13px] font-medium transition-[color,border-color,transform]",
                active
                  ? "border-navy font-semibold text-navy-text"
                  : "border-transparent text-ink-muted hover:text-ink-secondary",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            glyph="⌕"
            title="No members match your search"
            body="Clear the search or filters and try another name, city, or expertise."
            action={
              <Button href="/people" variant="primary">
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            glyph="◎"
            title="No approved members yet"
            body="Only approved and onboarded profiles appear in the directory."
          />
        )
      ) : (
        <>
          <ul
            aria-label="Approved members"
            className="grid list-none overflow-hidden rounded-container border border-border bg-surface p-0"
          >
            {rows.map((member) => {
              const detail = [
                member.title && member.company
                  ? `${member.title} @ ${member.company}`
                  : member.title || member.company,
                member.city,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={member.id}
                  className="border-t border-border first:border-t-0"
                >
                  <Link
                    href={`/people/${member.id}`}
                    className="ui-member-result flex min-h-tap items-center gap-3 px-3.5 py-3 hover:bg-surface-subtle"
                  >
                    <Avatar
                      name={member.name}
                      src={member.image ?? undefined}
                      className="ui-member-avatar"
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate font-semibold text-ink">
                        {member.name}
                      </strong>
                      {detail ? (
                        <small className="block truncate text-[13px] text-ink-muted">
                          {detail}
                        </small>
                      ) : null}
                      {member.match ? (
                        <span className="block text-xs text-ink-muted">
                          {member.match.kind === "field"
                            ? member.match.field === "expertise"
                              ? `Matched on Expertise — ${member.match.label}`
                              : `Matched on ${
                                  {
                                    name: "Name",
                                    title: "Title",
                                    city: "City",
                                    company: "Company",
                                    bio: "Bio",
                                  }[member.match.field]
                                }`
                            : `Similar to "${member.match.query}"`}
                        </span>
                      ) : null}
                      {member.tags.length > 0 ? (
                        <span className="ui-member-tags mt-1.5 flex flex-wrap gap-1.5">
                          {member.tags.slice(0, 2).map((label) => (
                            <Tag key={label}>{label}</Tag>
                          ))}
                          {member.tags.slice(2).map((label) => (
                            <Tag key={label} className="hidden sm:inline-flex">
                              {label}
                            </Tag>
                          ))}
                          {member.tags.length > 2 ? (
                            <Tag className="sm:hidden">
                              +{member.tags.length - 2}
                            </Tag>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    <span aria-hidden="true" className="text-ink-muted">
                      ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {total > pageSize ? (
          <div className="mt-3.5 flex items-center justify-between gap-2.5 py-2 text-xs text-ink-muted">
            <span>
              Showing {start}-{end} of {total}{" "}
              {total === 1 ? "member" : "members"}
            </span>
            <span className="flex gap-2">
              {page > 1 ? (
                <Button href={pageHref(page - 1)} variant="secondary" size="sm">
                  Previous
                </Button>
              ) : null}
              {page < lastPage ? (
                <Button href={pageHref(page + 1)} variant="secondary" size="sm">
                  Next
                </Button>
              ) : null}
            </span>
          </div>
          ) : null}
        </>
      )}
    </div>
  );
}
