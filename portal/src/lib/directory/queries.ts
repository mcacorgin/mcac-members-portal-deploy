import { cache } from "react";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, tables } from "@/db";
import {
  hasAdminRole,
  memberAccessError,
  projectContact,
  type ProjectedContact,
  type Viewer,
} from "@/lib/authz";
import { ok, err, type ActionResult } from "@/lib/contracts/result";
import { VERTICAL_INTEREST_LABELS } from "@/lib/expertise-groups";
import { escapeLike } from "@/lib/sql-text";
import { cityKey, groupCities, type DirectoryCity } from "./cities";
import { groupProfessions, type DirectoryProfession } from "./professions";
import {
  buildProfessionFilterOptions,
  containsSearchTerm,
  escapeRegex,
  matchProfessionFilter,
  professionFilterTerms,
} from "./profession-filter";
import { expandQuery, SYNONYMS } from "./synonyms";
import { parseQuery } from "./parse-query";

// Directory reads (MEMB-01/02, PEOPLE-01/02). Contact values NEVER leave this
// module unprojected: list rows carry no contact fields at all; profiles go
// through projectContact so hidden values are never serialized to the client.

export type DirectoryMatch =
  | {
      kind: "field";
      field:
        | "name"
        | "title"
        | "profession"
        | "city"
        | "company"
        | "bio"
        | "expertise"
        | "role";
      label?: string;
    }
  | { kind: "similar"; query: string };

export type DirectoryRow = {
  id: string;
  name: string;
  city: string;
  title: string;
  profession: string;
  company: string;
  tags: string[];
  image: string | null;
  match: DirectoryMatch | null;
};

/**
 * Which field a query matched, in the deterministic order: group order (the
 * AND-ed groups searchMembers parsed the query into), then within a group
 * the expandQuery term order, then field order name -> title -> profession
 * -> city -> company -> bio -> expertise. Falls back to "similar" when the
 * row matched no group's exact (non-fuzzy) tier - it only qualified through
 * a fuzzy strict_word_similarity hit somewhere.
 */
function deriveMatch(
  row: {
    name: string;
    title: string;
    profession: string;
    city: string;
    company: string;
    bio: string;
    tags: string[];
  },
  groups: string[],
  originalQuery: string,
): DirectoryMatch | null {
  if (groups.length === 0) return null;
  const fields = [
    ["name", row.name],
    ["title", row.title],
    ["profession", row.profession],
    ["city", row.city],
    ["company", row.company],
    ["bio", row.bio],
  ] as const;
  for (const group of groups) {
    for (const term of expandQuery(group)) {
      for (const [field, value] of fields) {
        if (containsSearchTerm(value, term)) return { kind: "field", field };
      }
      const tag = row.tags.find((t) => containsSearchTerm(t, term));
      if (tag) return { kind: "field", field: "expertise", label: tag };
    }
  }
  return { kind: "similar", query: originalQuery };
}

// Trigram threshold for the fuzzy tier. strict_word_similarity compares the
// query against whole words of the field, so a typo like "acountant" still
// reaches "Chartered Accountant" (0.73), but a shared two-letter prefix no
// longer does: plain word_similarity scored "legal" against "Lead Partner"
// at 0.33, over the old 0.3 threshold.
const FUZZY_THRESHOLD = 0.5;

/**
 * Builds the exact (ILIKE/regex) and fuzzy (strict_word_similarity) SQL for
 * one AND group. `group` is the raw group text (a word or a known phrase);
 * `expandQuery(group)` supplies its synonym expansions, each OR-ed across
 * every searchable field, with all the expertise-tag checks folded into one
 * EXISTS. The fuzzy tier runs once per group (not per expansion) against the
 * raw group text, and only for groups of >=4 characters, on
 * name/title/profession/tag label. `fuzzy` is null when the group is too
 * short for it.
 */
function buildGroupCondition(group: string): {
  exact: SQL;
  fuzzy: SQL | null;
} {
  const fieldConds: SQL[] = [];
  const tagConds: SQL[] = [];
  for (const term of expandQuery(group)) {
    if (term.trim().length <= 2) {
      const boundaryPattern = `(^|[^[:alnum:]])${escapeRegex(
        term.toLowerCase(),
      )}([^[:alnum:]]|$)`;
      fieldConds.push(
        sql`lower(${tables.users.name}) ~ ${boundaryPattern}`,
        sql`lower(${tables.profiles.title}) ~ ${boundaryPattern}`,
        sql`lower(${tables.profiles.profession}) ~ ${boundaryPattern}`,
        sql`lower(${tables.profiles.city}) ~ ${boundaryPattern}`,
        sql`lower(${tables.profiles.company}) ~ ${boundaryPattern}`,
        sql`lower(${tables.profiles.bio}) ~ ${boundaryPattern}`,
      );
      tagConds.push(sql`lower(et.label) ~ ${boundaryPattern}`);
    } else {
      const pattern = `%${escapeLike(term)}%`;
      fieldConds.push(
        ilike(tables.users.name, pattern),
        ilike(tables.profiles.title, pattern),
        ilike(tables.profiles.profession, pattern),
        ilike(tables.profiles.city, pattern),
        ilike(tables.profiles.company, pattern),
        ilike(tables.profiles.bio, pattern),
      );
      tagConds.push(sql`et.label ilike ${pattern}`);
    }
  }
  const exact = or(
    ...fieldConds,
    sql`exists (select 1 from ${tables.memberTags} mt join ${tables.expertiseTags} et on et.id = mt.tag_id where mt.user_id = ${tables.users.id} and (${or(...tagConds)}))`,
  )!;
  const fuzzy =
    group.trim().length >= 4
      ? or(
          sql`strict_word_similarity(${group}, ${tables.users.name}) >= ${FUZZY_THRESHOLD}`,
          sql`strict_word_similarity(${group}, ${tables.profiles.title}) >= ${FUZZY_THRESHOLD}`,
          sql`strict_word_similarity(${group}, ${tables.profiles.profession}) >= ${FUZZY_THRESHOLD}`,
          sql`exists (select 1 from ${tables.memberTags} mt join ${tables.expertiseTags} et on et.id = mt.tag_id where mt.user_id = ${tables.users.id} and strict_word_similarity(${group}, et.label) >= ${FUZZY_THRESHOLD})`,
        )!
      : null;
  return { exact, fuzzy };
}

/**
 * The PEOPLE-01 profession filter. profiles.profession is new and mostly
 * empty, so a member also matches on their job title or on one of their
 * professional-role tags (vertical-interest tags never count). Same synonym
 * expansion and short-term word anchoring as the main search, so "CA" finds
 * "Chartered Accountancy" without matching inside "Advocate".
 * matchProfessionFilter in profession-filter.ts is the same rule in code.
 */
function buildProfessionCondition(filter: string): SQL {
  const fieldConds: SQL[] = [];
  const tagConds: SQL[] = [];
  for (const term of professionFilterTerms(filter)) {
    if (term.kind === "word") {
      fieldConds.push(
        sql`lower(${tables.profiles.profession}) ~ ${term.pattern}`,
        sql`lower(${tables.profiles.title}) ~ ${term.pattern}`,
      );
      tagConds.push(sql`lower(et.label) ~ ${term.pattern}`);
    } else {
      fieldConds.push(
        ilike(tables.profiles.profession, term.pattern),
        ilike(tables.profiles.title, term.pattern),
      );
      tagConds.push(sql`et.label ilike ${term.pattern}`);
    }
  }
  const verticals = sql.join(
    VERTICAL_INTEREST_LABELS.map((label) => sql`${label}`),
    sql`, `,
  );
  return or(
    ...fieldConds,
    sql`exists (select 1 from ${tables.memberTags} mt join ${tables.expertiseTags} et on et.id = mt.tag_id where mt.user_id = ${tables.users.id} and et.label not in (${verticals}) and (${or(...tagConds)}))`,
  )!;
}

/** Folded cities of approved members. Cached per request: the people page
 * needs them for both the city filter and reading a city out of the query. */
const getApprovedCities = cache(async (): Promise<DirectoryCity[]> => {
  const rows = await db
    .selectDistinct({ city: tables.profiles.city })
    .from(tables.profiles)
    .innerJoin(tables.users, eq(tables.users.id, tables.profiles.userId))
    .where(eq(tables.users.status, "approved"));
  return groupCities(rows.map((r) => r.city));
});

export async function searchMembers(
  viewer: Viewer | null,
  input: {
    q?: string;
    city?: string;
    profession?: string;
    tagId?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<
  ActionResult<{
    rows: DirectoryRow[];
    total: number;
    page: number;
    pageSize: number;
    interpretation: { city: string | null; terms: string[]; relaxed: boolean } | null;
  }>
> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const q = input.q?.trim().slice(0, 200);

  // Members type their own city, so the stored spelling varies ("pune" vs
  // "Pune"). Match on the folded value or a member is invisible unless the
  // searcher happens to pick their exact casing. Old bookmarked ?city= links
  // keep working because both sides are folded.
  const explicitCityKey = cityKey(input.city ?? "");

  // Every meaningful word (or known phrase) the query carries must match
  // something before a row qualifies - see parse-query.ts. The known city
  // names let parseQuery keep "navi mumbai" whole and notice a city typed
  // inline ("tax pune") instead of via the explicit filter.
  let textGroups: string[] = [];
  let detectedCityKey: string | null = null;
  let cityLabel: string | null = null;
  if (q) {
    const cities = await getApprovedCities();
    const parsed = parseQuery(q, {
      phrases: [...Object.keys(SYNONYMS), ...cities.map((c) => c.value)],
      cityKeys: new Set(cities.map((c) => c.value)),
      cityAlreadyFiltered: Boolean(explicitCityKey),
    });
    textGroups = parsed.textGroups;
    detectedCityKey = parsed.cityKey;
    if (detectedCityKey) {
      cityLabel =
        cities.find((c) => c.value === detectedCityKey)?.label ??
        detectedCityKey;
    }
  }

  // The explicit ?city= filter is exact. A city read out of the query is not
  // a filter: members type "Pune, Maharashtra" or "PCMC Pune", and a Mumbai
  // firm can be called "Pune Legal LLP". So the city word is one more group
  // that has to match somewhere (never fuzzily, so "pune" does not pull in
  // "Punit"), and members whose city contains it are listed first.
  const explicitCityCond = explicitCityKey
    ? sql`lower(trim(${tables.profiles.city})) = ${explicitCityKey}`
    : undefined;
  const detectedCityCond = detectedCityKey
    ? buildGroupCondition(detectedCityKey).exact
    : undefined;
  const cityRank = detectedCityKey
    ? ilike(tables.profiles.city, `%${escapeLike(detectedCityKey)}%`)
    : undefined;

  const groupBuilt = textGroups.map(buildGroupCondition);
  const groupFull = groupBuilt.map((g) =>
    g.fuzzy ? or(g.exact, g.fuzzy)! : g.exact,
  );
  const hasFuzzyTier = groupBuilt.some((g) => g.fuzzy);
  const groupCount = groupBuilt.length + (detectedCityCond ? 1 : 0);

  // Word search, not an exact-match filter (Sandeep, 21 Sep 2026): a member
  // typing "tax" must find "Tax Advisor" and "US-India Tax Consultant". It
  // reads profession, title and professional-role tags, never the bio text
  // (see buildProfessionCondition).
  const professionFilter = (input.profession ?? "").trim().slice(0, 120);
  const professionCond = professionFilter
    ? buildProfessionCondition(professionFilter)
    : undefined;

  const tagCond = input.tagId
    ? inArray(
        tables.users.id,
        db
          .select({ userId: tables.memberTags.userId })
          .from(tables.memberTags)
          .where(eq(tables.memberTags.tagId, input.tagId)),
      )
    : undefined;

  // Sandeep's 2026-08-20 decision retired the directory opt-out. Every
  // approved member is discoverable; contact fields remain independently
  // projected by projectContact.
  function buildWhere(textCond: SQL | undefined) {
    const conditions = [eq(tables.users.status, "approved" as const)];
    if (explicitCityCond) conditions.push(explicitCityCond);
    if (textCond) conditions.push(textCond);
    if (professionCond) conditions.push(professionCond);
    if (tagCond) conditions.push(tagCond);
    return and(...conditions)!;
  }

  // Ranking, in order: members whose city contains the city typed in the
  // query; then members who match more groups exactly (in the relaxed tier
  // a row matching 2 of 3 words outranks one matching 1 of 3); then
  // similarity to the words that are not the city - never to the city
  // itself, or "Punit Shah" would lead a search for "pune".
  const exactCount = groupBuilt.length
    ? sql.join(
        groupBuilt.map((g) => sql`(case when ${g.exact} then 1 else 0 end)`),
        sql` + `,
      )
    : undefined;
  const similarityText = textGroups.join(" ");

  async function runSearch(where: SQL) {
    const base = db
      .select({
        id: tables.users.id,
        name: tables.users.name,
        city: tables.profiles.city,
        title: tables.profiles.title,
        profession: tables.profiles.profession,
        company: tables.profiles.company,
        bio: tables.profiles.bio,
        image: tables.users.image,
      })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(where);

    const orderedRows = base.orderBy(
      ...(cityRank
        ? [desc(sql<number>`case when ${cityRank} then 1 else 0 end`)]
        : []),
      ...(exactCount ? [desc(sql<number>`${exactCount}`)] : []),
      ...(similarityText
        ? [
            desc(sql<number>`greatest(
              word_similarity(${similarityText}, ${tables.users.name}),
              word_similarity(${similarityText}, ${tables.profiles.title}),
              word_similarity(${similarityText}, ${tables.profiles.profession}),
              coalesce((select max(word_similarity(${similarityText}, et.label)) from ${tables.memberTags} mt join ${tables.expertiseTags} et on et.id = mt.tag_id where mt.user_id = ${tables.users.id}), 0)
            )`),
          ]
        : []),
      asc(tables.users.name),
      asc(tables.users.id),
    );

    const [rows, [{ total }]] = await Promise.all([
      orderedRows.limit(pageSize).offset((page - 1) * pageSize),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(tables.users)
        .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
        .where(where),
    ]);
    return { rows, total };
  }

  // Three tiers, each tried only when the one before finds nobody:
  //  1. every group matches exactly;
  //  2. every group matches, typos allowed (fuzzy) - kept out of tier 1 so a
  //     near-miss never pads a result that already has real matches;
  //  3. any group matches (relaxed) - "ca pune" with no CA in Pune shows the
  //     CAs and the Pune members rather than nothing. The page says so.
  const cityAnd = detectedCityCond ? [detectedCityCond] : [];
  let relaxed = false;
  let { rows, total } = await runSearch(
    buildWhere(
      groupCount ? and(...cityAnd, ...groupBuilt.map((g) => g.exact)) : undefined,
    ),
  );
  if (total === 0 && hasFuzzyTier) {
    ({ rows, total } = await runSearch(
      buildWhere(and(...cityAnd, ...groupFull)),
    ));
  }
  if (total === 0 && groupCount >= 2) {
    relaxed = true;
    ({ rows, total } = await runSearch(
      buildWhere(or(...cityAnd, ...groupFull)),
    ));
  }

  const ids = rows.map((r) => r.id);
  const tagRows = ids.length
    ? await db
        .select({
          userId: tables.memberTags.userId,
          label: tables.expertiseTags.label,
        })
        .from(tables.memberTags)
        .innerJoin(
          tables.expertiseTags,
          eq(tables.expertiseTags.id, tables.memberTags.tagId),
        )
        .where(inArray(tables.memberTags.userId, ids))
        .orderBy(asc(tables.expertiseTags.label))
    : [];
  const tagsByUser = new Map<string, string[]>();
  for (const t of tagRows) {
    tagsByUser.set(t.userId, [...(tagsByUser.get(t.userId) ?? []), t.label]);
  }

  const matchGroups = detectedCityKey
    ? [...textGroups, detectedCityKey]
    : textGroups;
  return ok({
    rows: rows.map((r) => {
      const tags = tagsByUser.get(r.id) ?? [];
      return {
        id: r.id,
        name: r.name,
        city: r.city,
        title: r.title,
        profession: r.profession,
        company: r.company,
        tags,
        image: r.image,
        match: q
          ? deriveMatch({ ...r, tags }, matchGroups, q)
          : professionFilter
            ? professionMatch({ ...r, tags }, professionFilter)
            : null,
      };
    }),
    total,
    page,
    pageSize,
    interpretation: q ? { city: cityLabel, terms: textGroups, relaxed } : null,
  });
}

/** The result hint for a row found only through the profession filter. */
function professionMatch(
  row: { profession: string; title: string; tags: string[] },
  filter: string,
): DirectoryMatch | null {
  const match = matchProfessionFilter(row, filter);
  if (!match) return null;
  return match.field === "role"
    ? { kind: "field", field: "role", label: match.label }
    : { kind: "field", field: match.field };
}

export type MemberProfileView = {
  id: string;
  name: string;
  image: string | null;
  city: string;
  title: string;
  profession: string;
  company: string;
  bio: string;
  tags: string[];
  contact: ProjectedContact;
  isSelf: boolean;
};

export async function getMemberProfile(
  viewer: Viewer | null,
  memberId: string,
): Promise<ActionResult<MemberProfileView>> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");

  const row = await db
    .select({
      id: tables.users.id,
      name: tables.users.name,
      image: tables.users.image,
      email: tables.users.email,
      status: tables.users.status,
      city: tables.profiles.city,
      title: tables.profiles.title,
      profession: tables.profiles.profession,
      company: tables.profiles.company,
      bio: tables.profiles.bio,
      phone: tables.profiles.phone,
      linkedinUrl: tables.profiles.linkedinUrl,
      phoneVisibility: tables.profiles.phoneVisibility,
      emailVisibility: tables.profiles.emailVisibility,
      linkedinVisibility: tables.profiles.linkedinVisibility,
    })
    .from(tables.users)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
    .where(eq(tables.users.id, memberId))
    .limit(1);
  const member = row[0];
  const isSelf = viewer!.id === memberId;
  const isAdmin = hasAdminRole(viewer!.role);
  if (!member || (member.status !== "approved" && !isSelf && !isAdmin))
    return err("not_found", "This member profile is not available.");

  // Same order as the directory rows, so the tags a row shows are the first
  // ones on the profile too (the profile shows six before "+N more").
  const tagRows = await db
    .select({ label: tables.expertiseTags.label })
    .from(tables.memberTags)
    .innerJoin(
      tables.expertiseTags,
      eq(tables.expertiseTags.id, tables.memberTags.tagId),
    )
    .where(eq(tables.memberTags.userId, memberId))
    .orderBy(asc(tables.expertiseTags.label));

  return ok({
    id: member.id,
    name: member.name,
    image: member.image,
    city: member.city,
    title: member.title,
    profession: member.profession,
    company: member.company,
    bio: member.bio,
    tags: tagRows.map((t) => t.label),
    contact: projectContact(viewer!, { ...member, userId: member.id }),
    isSelf,
  });
}

/**
 * Distinct, folded professions of approved members, for the PEOPLE-01
 * profession filter's typeahead and the registration/evidence form's
 * profession typeahead. Deliberately ungated (no viewer check): the
 * application evidence form (AUTH-07) shows this to pending and
 * needs_changes applicants, who never pass memberAccessError, and it exposes
 * nothing more sensitive than the set of profession labels already on file.
 */
export async function getKnownProfessions(): Promise<DirectoryProfession[]> {
  const rows = await db
    .selectDistinct({ profession: tables.profiles.profession })
    .from(tables.profiles)
    .innerJoin(tables.users, eq(tables.users.id, tables.profiles.userId))
    .where(eq(tables.users.status, "approved"));
  return groupProfessions(rows.map((r) => r.profession));
}

/**
 * Options for the PEOPLE-01 profession filter: the professional-role tags
 * approved members hold, plus the professions they typed. Built only from
 * real members, so no option comes back empty. The profile forms keep using
 * getKnownProfessions, which suggests typed professions only.
 */
async function getProfessionFilterOptions(): Promise<DirectoryProfession[]> {
  const [tagRows, professionRows] = await Promise.all([
    db
      .selectDistinct({ label: tables.expertiseTags.label })
      .from(tables.memberTags)
      .innerJoin(
        tables.expertiseTags,
        eq(tables.expertiseTags.id, tables.memberTags.tagId),
      )
      .innerJoin(tables.users, eq(tables.users.id, tables.memberTags.userId))
      .where(eq(tables.users.status, "approved")),
    db
      .selectDistinct({ profession: tables.profiles.profession })
      .from(tables.profiles)
      .innerJoin(tables.users, eq(tables.users.id, tables.profiles.userId))
      .where(eq(tables.users.status, "approved")),
  ]);
  return buildProfessionFilterOptions(
    tagRows.map((r) => r.label),
    professionRows.map((r) => r.profession),
  );
}

/** Distinct cities, professions, and all expertise tags, for the PEOPLE-01 filters. */
export async function getDirectoryFilters(viewer: Viewer | null): Promise<
  ActionResult<{
    cities: DirectoryCity[];
    /** Typed professions only: the profile forms' typeahead. */
    professions: DirectoryProfession[];
    /** The People profession filter's options (roles and professions). */
    professionFilterOptions: DirectoryProfession[];
    tags: { id: string; label: string }[];
  }>
> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");
  const [cities, professions, professionFilterOptions, tags] =
    await Promise.all([
      getApprovedCities(),
      getKnownProfessions(),
      getProfessionFilterOptions(),
      db
        .select({ id: tables.expertiseTags.id, label: tables.expertiseTags.label })
        .from(tables.expertiseTags)
        .orderBy(asc(tables.expertiseTags.label)),
    ]);
  return ok({ cities, professions, professionFilterOptions, tags });
}
