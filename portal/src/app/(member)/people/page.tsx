import Link from "next/link";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
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
} from "@/components/ui";

// PEOPLE-01: directory search. Server component driven entirely by
// searchParams; filters submit as a GET form and the chips that remove them
// are links, so everything works without client JS.

export const metadata = { title: "People · MCAC Members Portal" };

type SearchParams = Promise<{
  q?: string | string[];
  city?: string | string[];
  profession?: string | string[];
  tag?: string | string[];
  page?: string | string[];
}>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function chipHref(params: {
  q: string;
  city: string;
  profession: string;
  tag: string;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.city) search.set("city", params.city);
  if (params.profession) search.set("profession", params.profession);
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
  const profession = first(sp.profession).trim();
  const tagId = first(sp.tag);
  const page = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);
  const hasFilters = Boolean(q || city || profession || tagId);

  const viewer = await requireViewer();
  const [filtersRes, resultRes] = await Promise.all([
    getDirectoryFilters(viewer),
    searchMembers(viewer, {
      q: q || undefined,
      city: city || undefined,
      profession: profession || undefined,
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

  const { cities, professionFilterOptions, tags } = filtersRes.data;
  // The URL carries the folded key ("pune"); show the member the tidy label.
  const cityKey = city.trim().toLowerCase();
  const cityLabel = cities.find((c) => c.value === cityKey)?.label ?? city;
  // The URL carries the tag id. A stale id (a tag since removed) still
  // narrows the results, so it still gets a chip the member can remove.
  const tagLabel = tagId
    ? (tags.find((t) => t.id === tagId)?.label ?? "Unknown")
    : "";
  const { rows, total, pageSize, interpretation } = resultRes.data;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (city) search.set("city", city);
    if (profession) search.set("profession", profession);
    if (tagId) search.set("tag", tagId);
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `/people?${qs}` : "/people";
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="People"
        description="Search by name, work, city or expertise."
        action={
          <span className="inline-flex min-h-tap items-center text-sm text-ink-muted">
            {total} {total === 1 ? "member" : "members"}
          </span>
        }
        className="ui-directory-heading"
      />

      {/* Each box below is keyed on its value in the URL. The chips are
          links, and a link keeps this page mounted, so React would leave a
          removed filter in its box (it never re-reads a select's
          defaultValue) and the next Search would send it again. A new key
          starts the box afresh from the URL. */}
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
            key={q}
            id="people-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, profession, company or expertise"
          />
          <Button type="submit" className="px-4">
            Search
          </Button>
        </div>
        {/* Profession, city and expertise narrow the one search above
            rather than being a second search box: two text boxes made
            people guess where to type, and pushed results down on a phone.
            Expertise used to be a sideways-scrolling row of 41 links that
            gave no sign it scrolled; a drop-down list here is easier to
            use. */}
        <details className="ui-filter-disclosure rounded-control border border-border bg-surface">
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium text-ink-secondary">
            <span>Filters</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="max-w-40 truncate text-ink-muted sm:max-w-80">
                {[profession, city ? cityLabel : "", tagLabel]
                  .filter(Boolean)
                  .join(" · ") || "Any"}
              </span>
              <CaretDownIcon
                aria-hidden="true"
                size={16}
                className="ui-filter-caret text-ink-muted"
              />
            </span>
          </summary>
          <div className="grid gap-3 border-t border-border p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="people-profession" className="text-sm font-medium">
                Profession
              </Label>
              <Input
                key={profession}
                id="people-profession"
                type="search"
                name="profession"
                list="people-profession-options"
                // Only the list below, which comes from real members. The
                // browser's own saved entries offered words nobody matched.
                autoComplete="off"
                defaultValue={profession}
                placeholder="For example, Tax Advisor"
              />
              <datalist id="people-profession-options">
                {professionFilterOptions.map((p) => (
                  <option key={p.value} value={p.label} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="people-city" className="text-sm font-medium">
                City
              </Label>
              <Select
                key={cityKey}
                id="people-city"
                name="city"
                defaultValue={cityKey}
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="people-tag" className="text-sm font-medium">
                Expertise
              </Label>
              <Select
                key={tagId}
                id="people-tag"
                name="tag"
                defaultValue={tagId}
              >
                <option value="">All expertise</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </div>
        </details>
      </form>

      {profession || city || tagId ? (
        <ul
          aria-label="Active filters"
          className="mb-3 flex list-none flex-wrap gap-2 p-0"
        >
          {profession ? (
            <li>
              <Link
                href={chipHref({ q, city, profession: "", tag: tagId })}
                aria-label={`Profession: ${profession}, remove filter`}
                className="ui-filter-chip inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3 text-sm text-ink hover:bg-surface-sunken active:scale-[0.97]"
              >
                <span className="truncate">Profession: {profession}</span>
                <XIcon aria-hidden="true" size={14} className="flex-none" />
              </Link>
            </li>
          ) : null}
          {city ? (
            <li>
              <Link
                href={chipHref({ q, city: "", profession, tag: tagId })}
                aria-label={`City: ${cityLabel}, remove filter`}
                className="ui-filter-chip inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3 text-sm text-ink hover:bg-surface-sunken active:scale-[0.97]"
              >
                <span className="truncate">City: {cityLabel}</span>
                <XIcon aria-hidden="true" size={14} className="flex-none" />
              </Link>
            </li>
          ) : null}
          {tagId ? (
            <li>
              <Link
                href={chipHref({ q, city, profession, tag: "" })}
                aria-label={`Expertise: ${tagLabel}, remove filter`}
                className="ui-filter-chip inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3 text-sm text-ink hover:bg-surface-sunken active:scale-[0.97]"
              >
                <span className="truncate">Expertise: {tagLabel}</span>
                <XIcon aria-hidden="true" size={14} className="flex-none" />
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      {interpretation?.relaxed ? (
        <p className="mb-2 text-sm text-ink-muted">
          {`No one matches all of "${q}". Showing members who match part of it.`}
        </p>
      ) : interpretation?.city && rows.length > 0 ? (
        <p className="mb-2 text-sm text-ink-muted">
          {`Members in ${interpretation.city} are listed first.`}
        </p>
      ) : null}

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            glyph={<MagnifyingGlassIcon aria-hidden="true" size={22} />}
            title="No members match your search"
            body="Clear the search or filters and try another name, profession, city, or expertise."
            action={
              <Button href="/people" variant="primary">
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            glyph={<UsersThreeIcon aria-hidden="true" size={22} />}
            title="No approved members yet"
            body="Members appear here once an admin approves them."
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
                member.profession,
                member.title && member.company
                  ? `${member.title} at ${member.company}`
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
                    className="ui-member-result flex min-h-tap items-center gap-3 px-3.5 py-3 hover:bg-surface-subtle focus-visible:outline-offset-[-2px]"
                  >
                    <Avatar
                      name={member.name}
                      src={member.image ?? undefined}
                      className="ui-member-avatar"
                      decorative
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate font-semibold text-ink">
                        {member.name}
                      </strong>
                      {detail ? (
                        <small className="block truncate text-[0.8125rem] text-ink-muted">
                          {detail}
                        </small>
                      ) : null}
                      {member.match ? (
                        <span className="block text-xs text-ink-muted">
                          {member.match.kind === "field"
                            ? member.match.field === "expertise"
                              ? `Matched on expertise: ${member.match.label}`
                              : member.match.field === "role"
                                ? `Matched on role: ${member.match.label}`
                                : `Matched on ${
                                  {
                                    name: "name",
                                    title: "title",
                                    profession: "profession",
                                    city: "city",
                                    company: "company",
                                    bio: "bio",
                                  }[member.match.field]
                                }`
                            : `Similar to "${member.match.query}"`}
                        </span>
                      ) : null}
                      {member.tags.length > 0 ? (
                        // Two tags on a phone, three on a wider screen, then
                        // a plain count. The whole row is one link, so the
                        // count is text, not a control; the profile lists
                        // them all. The third tag hides with max-sm:hidden;
                        // plain "hidden" loses to Tag's own inline-flex,
                        // which comes later in the CSS.
                        <span className="ui-member-tags mt-1.5 flex flex-wrap items-center gap-1.5">
                          {member.tags.slice(0, 2).map((label) => (
                            <Tag key={label}>{label}</Tag>
                          ))}
                          {member.tags[2] ? (
                            <Tag className="max-sm:hidden">
                              {member.tags[2]}
                            </Tag>
                          ) : null}
                          {member.tags.length > 2 ? (
                            <span className="text-xs text-ink-muted sm:hidden">
                              +{member.tags.length - 2} more
                            </span>
                          ) : null}
                          {member.tags.length > 3 ? (
                            <span className="hidden text-xs text-ink-muted sm:inline">
                              +{member.tags.length - 3} more
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    <CaretRightIcon
                      aria-hidden="true"
                      size={16}
                      className="text-ink-muted"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          {total > pageSize ? (
          <div className="mt-3.5 flex items-center justify-between gap-2.5 py-2 text-xs text-ink-muted">
            <span>
              Showing {start}–{end} of {total}{" "}
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
