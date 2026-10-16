// PEOPLE-01 profession filter. The profiles.profession column is new and
// mostly empty, so the filter also reads the two places members already
// describe their work: their job title and their professional-role tags (any
// expertise tag that is not a vertical interest, see expertise-groups.ts).
// Kept free of database imports so the matching rules are unit-tested here
// and queries.ts only turns them into SQL.
import { isVerticalInterestLabel } from "../expertise-groups";
import { escapeLike } from "../sql-text";
import { cityKey, foldLabels, type FoldedLabel } from "./cities";
import { expandQuery } from "./synonyms";

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether `value` contains `term`. A term of two letters or fewer ("CA",
 * "CS") must be a whole word, so "CA" finds "CA" but not "Advocate".
 */
export function containsSearchTerm(value: string, term: string): boolean {
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
 * The SQL patterns for one profession filter: the filter text plus its
 * synonym expansions. A short term is a Postgres regex anchored on word
 * boundaries (match it against lower(column)); a longer one is an ILIKE
 * substring pattern.
 */
export type ProfessionFilterTerm =
  | { kind: "word"; pattern: string }
  | { kind: "substring"; pattern: string };

export function professionFilterTerms(filter: string): ProfessionFilterTerm[] {
  return expandQuery(filter).map((term) =>
    term.trim().length <= 2
      ? {
          kind: "word",
          pattern: `(^|[^[:alnum:]])${escapeRegex(
            term.toLowerCase(),
          )}([^[:alnum:]]|$)`,
        }
      : { kind: "substring", pattern: `%${escapeLike(term)}%` },
  );
}

/** What a member matched the profession filter on, for the result hint. */
export type ProfessionFilterMatch =
  | { field: "profession" }
  | { field: "title" }
  | { field: "role"; label: string };

/**
 * The same rule as the SQL in queries.ts, in code: profession, then title,
 * then a professional-role tag. Vertical-interest tags never count.
 */
export function matchProfessionFilter(
  member: { profession: string; title: string; tags: string[] },
  filter: string,
): ProfessionFilterMatch | null {
  const terms = expandQuery(filter);
  const roles = member.tags.filter((t) => !isVerticalInterestLabel(t));
  for (const term of terms) {
    if (containsSearchTerm(member.profession, term)) return { field: "profession" };
  }
  for (const term of terms) {
    if (containsSearchTerm(member.title, term)) return { field: "title" };
  }
  for (const term of terms) {
    const role = roles.find((label) => containsSearchTerm(label, term));
    if (role) return { field: "role", label: role };
  }
  return null;
}

/**
 * Options for the profession filter: the professional-role tags approved
 * members hold, plus the professions they typed (folded the same way as
 * groupProfessions). Both lists come from real members, so every option
 * finds someone. Duplicates are dropped ignoring case; the tag's spelling
 * wins.
 */
export function buildProfessionFilterOptions(
  memberTagLabels: string[],
  professions: (string | null | undefined)[],
): FoldedLabel[] {
  const options = new Map<string, FoldedLabel>();
  for (const raw of memberTagLabels) {
    const label = raw.trim();
    if (!label || isVerticalInterestLabel(label)) continue;
    const value = cityKey(label);
    if (!options.has(value)) options.set(value, { value, label });
  }
  for (const folded of foldLabels(professions)) {
    if (!options.has(folded.value)) options.set(folded.value, folded);
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}
