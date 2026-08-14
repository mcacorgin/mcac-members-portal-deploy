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
import { escapeLike } from "@/lib/sql-text";
import { expandQuery } from "./synonyms";

// Directory reads (MEMB-01/02, PEOPLE-01/02). Contact values NEVER leave this
// module unprojected: list rows carry no contact fields at all; profiles go
// through projectContact so hidden values are never serialized to the client.

export type DirectoryMatch =
  | {
      kind: "field";
      field: "name" | "title" | "city" | "company" | "bio" | "expertise";
      label?: string;
    }
  | { kind: "similar"; query: string };

export type DirectoryRow = {
  id: string;
  name: string;
  city: string;
  title: string;
  company: string;
  tags: string[];
  image: string | null;
  match: DirectoryMatch | null;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsSearchTerm(value: string, term: string): boolean {
  const normalizedTerm = term.toLowerCase();
  if (normalizedTerm.length > 2) {
    return value.toLowerCase().includes(normalizedTerm);
  }

  return new RegExp(
    `(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`,
    "i",
  ).test(value);
}

/**
 * Which field a query matched, in the deterministic order: term order from
 * expandQuery, then field order name -> title -> city -> company -> bio ->
 * expertise. Falls back to "similar" when the row matched only through the
 * fuzzy (word_similarity) tier - no field literally contains any term.
 */
function deriveMatch(
  row: { name: string; title: string; city: string; company: string; bio: string; tags: string[] },
  terms: string[],
  originalQuery: string,
): DirectoryMatch | null {
  const fields = [
    ["name", row.name],
    ["title", row.title],
    ["city", row.city],
    ["company", row.company],
    ["bio", row.bio],
  ] as const;
  for (const term of terms) {
    for (const [field, value] of fields) {
      if (containsSearchTerm(value, term)) return { kind: "field", field };
    }
    const tag = row.tags.find((t) => containsSearchTerm(t, term));
    if (tag) return { kind: "field", field: "expertise", label: tag };
  }
  return { kind: "similar", query: originalQuery };
}

export async function searchMembers(
  viewer: Viewer | null,
  input: {
    q?: string;
    city?: string;
    tagId?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<
  ActionResult<{ rows: DirectoryRow[]; total: number; page: number; pageSize: number }>
> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const q = input.q?.trim().slice(0, 200);

  // Directory consent (AUTH-02) is a listing gate, not a field mask: a member
  // who withheld it is absent from the directory, its search, and the share
  // picker that reuses this query. It never hides authorship of a post.
  const conditions = [
    eq(tables.users.status, "approved" as const),
    eq(tables.profiles.directoryListed, true),
  ];
  const terms = q ? expandQuery(q) : [];
  let exactMatch: SQL | undefined;
  if (q) {
    const exactConds: SQL[] = [];
    const fuzzyConds: SQL[] = [];
    for (const [termIndex, term] of terms.entries()) {
      const pattern = `%${escapeLike(term)}%`;
      if (term.trim().length <= 2) {
        const boundaryPattern = `(^|[^[:alnum:]])${escapeRegex(
          term.toLowerCase(),
        )}([^[:alnum:]]|$)`;
        exactConds.push(
          sql`lower(${tables.users.name}) ~ ${boundaryPattern}`,
          sql`lower(${tables.profiles.title}) ~ ${boundaryPattern}`,
          sql`lower(${tables.profiles.city}) ~ ${boundaryPattern}`,
          sql`lower(${tables.profiles.company}) ~ ${boundaryPattern}`,
          sql`lower(${tables.profiles.bio}) ~ ${boundaryPattern}`,
          sql`exists (select 1 from ${tables.memberTags} mt join ${tables.expertiseTags} et on et.id = mt.tag_id where mt.user_id = ${tables.users.id} and lower(et.label) ~ ${boundaryPattern})`,
        );
      } else {
        exactConds.push(
          ilike(tables.users.name, pattern),
          ilike(tables.profiles.title, pattern),
          ilike(tables.profiles.city, pattern),
          ilike(tables.profiles.company, pattern),
          ilike(tables.profiles.bio, pattern),
          sql`exists (select 1 from ${tables.memberTags} mt join ${tables.expertiseTags} et on et.id = mt.tag_id where mt.user_id = ${tables.users.id} and et.label ilike ${pattern})`,
        );
        if (termIndex === 0) {
          fuzzyConds.push(
            sql`word_similarity(${term}, ${tables.users.name}) >= 0.3`,
            sql`word_similarity(${term}, ${tables.profiles.title}) >= 0.3`,
            sql`exists (select 1 from ${tables.memberTags} mt join ${tables.expertiseTags} et on et.id = mt.tag_id where mt.user_id = ${tables.users.id} and word_similarity(${term}, et.label) >= 0.3)`,
          );
        }
      }
    }
    exactMatch = or(...exactConds)!;
    const textMatch = or(exactMatch, ...fuzzyConds)!;
    conditions.push(textMatch);
  }
  if (input.city) conditions.push(eq(tables.profiles.city, input.city));
  if (input.tagId) {
    const tagged = db
      .select({ userId: tables.memberTags.userId })
      .from(tables.memberTags)
      .where(eq(tables.memberTags.tagId, input.tagId));
    conditions.push(inArray(tables.users.id, tagged));
  }

  const where = and(...conditions);
  const base = db
    .select({
      id: tables.users.id,
      name: tables.users.name,
      city: tables.profiles.city,
      title: tables.profiles.title,
      company: tables.profiles.company,
      bio: tables.profiles.bio,
      image: tables.users.image,
    })
    .from(tables.users)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
    .where(where);

  const orderedRows =
    q && exactMatch
      ? base.orderBy(
          desc(sql<number>`case when ${exactMatch} then 1 else 0 end`),
          desc(sql<number>`greatest(
            word_similarity(${q}, ${tables.users.name}),
            word_similarity(${q}, ${tables.profiles.title}),
            coalesce((select max(word_similarity(${q}, et.label)) from ${tables.memberTags} mt join ${tables.expertiseTags} et on et.id = mt.tag_id where mt.user_id = ${tables.users.id}), 0)
          )`),
          asc(tables.users.name),
          asc(tables.users.id),
        )
      : base.orderBy(asc(tables.users.name), asc(tables.users.id));

  const [rows, [{ total }]] = await Promise.all([
    orderedRows.limit(pageSize).offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(where),
  ]);

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

  return ok({
    rows: rows.map((r) => {
      const tags = tagsByUser.get(r.id) ?? [];
      return {
        id: r.id,
        name: r.name,
        city: r.city,
        title: r.title,
        company: r.company,
        tags,
        image: r.image,
        match: q ? deriveMatch({ ...r, tags }, terms, q) : null,
      };
    }),
    total,
    page,
    pageSize,
  });
}

export type MemberProfileView = {
  id: string;
  name: string;
  image: string | null;
  city: string;
  title: string;
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
      company: tables.profiles.company,
      bio: tables.profiles.bio,
      phone: tables.profiles.phone,
      linkedinUrl: tables.profiles.linkedinUrl,
      phoneVisibility: tables.profiles.phoneVisibility,
      emailVisibility: tables.profiles.emailVisibility,
      linkedinVisibility: tables.profiles.linkedinVisibility,
      directoryListed: tables.profiles.directoryListed,
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
  // Hiding the row from the list but serving it by direct link would make the
  // consent decorative. Owners and administrators still reach it.
  if (!member.directoryListed && !isSelf && !isAdmin)
    return err("not_found", "This member profile is not available.");

  const tagRows = await db
    .select({ label: tables.expertiseTags.label })
    .from(tables.memberTags)
    .innerJoin(
      tables.expertiseTags,
      eq(tables.expertiseTags.id, tables.memberTags.tagId),
    )
    .where(eq(tables.memberTags.userId, memberId));

  return ok({
    id: member.id,
    name: member.name,
    image: member.image,
    city: member.city,
    title: member.title,
    company: member.company,
    bio: member.bio,
    tags: tagRows.map((t) => t.label),
    contact: projectContact(viewer!, { ...member, userId: member.id }),
    isSelf,
  });
}

/** Distinct cities and all expertise tags, for the PEOPLE-01 filters. */
export async function getDirectoryFilters(viewer: Viewer | null): Promise<
  ActionResult<{ cities: string[]; tags: { id: string; label: string }[] }>
> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");
  const [cities, tags] = await Promise.all([
    db
      .selectDistinct({ city: tables.profiles.city })
      .from(tables.profiles)
      .innerJoin(tables.users, eq(tables.users.id, tables.profiles.userId))
      .where(
        and(
          eq(tables.users.status, "approved"),
          eq(tables.profiles.directoryListed, true),
        ),
      )
      .orderBy(asc(tables.profiles.city)),
    db
      .select({ id: tables.expertiseTags.id, label: tables.expertiseTags.label })
      .from(tables.expertiseTags)
      .orderBy(asc(tables.expertiseTags.label)),
  ]);
  return ok({
    cities: cities.map((c) => c.city).filter(Boolean),
    tags,
  });
}
