// Splits a PEOPLE-01 free-text search into AND-ed match groups (search
// discovery upgrade, 2026-09-27; see docs/superpowers/specs/2026-07-28-
// search-discovery-upgrade-design.md for the corpus that shaped this).
// Pure text parsing only - no DB access, no synonym expansion (that's
// expandQuery in synonyms.ts, applied per group by the caller).
//
// Why groups instead of one OR-ed phrase: "tax pune" used to OR "tax" and
// "pune" together with every synonym expansion, so any tax member anywhere
// outranked every Pune member. Every meaningful word (or known phrase) the
// member typed must now match SOMETHING before a row qualifies. Each group
// may match any field, so "tax advisor" still finds "Advisor - Direct Tax".
//
// The algorithm:
//  1. Normalise (lowercase, trim, collapse whitespace, cap at 200 chars -
//     the same cap searchMembers already applies to `q`).
//  2. Split on whitespace/commas and strip punctuation from the ends of each
//     token ("pune?" -> "pune"), keeping "&", "/" and inner hyphens.
//  3. Greedily match the longest known phrase at each token position. Only
//     synonym triggers ("due diligence") and city names ("navi mumbai") are
//     phrases: a synonym trigger has to reach expandQuery whole, and a city
//     name has to be recognised whole. Everything else stays single words,
//     which match more loosely than a phrase would.
//  4. Drop stopwords (see STOPWORDS below).
//  5. If nothing meaningful is left, the whole normalised query becomes one
//     group, so a search is never silently empty or silently everything.
//  6. The first group that exactly equals a known city key is returned
//     separately as cityKey, unless an explicit city filter is already in
//     effect (cityAlreadyFiltered). The caller still requires it to match,
//     but ranks members in that city first.
//  7. At most MAX_GROUPS text groups are kept, after the city is taken out.

/**
 * Stopwords dropped from a free-text query before grouping. This is not a
 * general English stopword list - it's specific to how members phrase a
 * directory search ("someone who can help with GST near Pune", "need a tax
 * expert"), so words that carry search meaning elsewhere (e.g. "due" in "due
 * diligence") are deliberately left out.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "in",
  "at",
  "of",
  "for",
  "from",
  "to",
  "with",
  "near",
  "and",
  "or",
  "who",
  "someone",
  "anyone",
  "somebody",
  "looking",
  "need",
  "needs",
  "want",
  "me",
  "my",
  "i",
  "is",
  "are",
  "based",
  "located",
  "member",
  "members",
  "people",
  "person",
  "expert",
  "experts",
  "help",
  "does",
  "do",
  "can",
  "any",
  "some",
  "find",
  "know",
  "good",
  "best",
  "please",
  "on",
  "by",
  "about",
]);

/**
 * Caps the number of AND-ed text groups a single query can produce, applied
 * after phrase extraction, stopword filtering and city detection (so a city
 * typed at the end of a long query is still found). Without this, a long,
 * comma-heavy query could blow up the WHERE clause into dozens of ANDed OR
 * blocks; six groups is already more distinct concepts than one directory
 * search realistically carries.
 */
export const MAX_GROUPS = 6;

/** Matches the cap searchMembers already applies to `q` before it reaches
 * this module; enforced again here so parseQuery is safe to call directly. */
const MAX_QUERY_LENGTH = 200;

export type ParsedQuery = {
  /** Text groups to AND together, in query order. Excludes the city group,
   * if one was detected. */
  textGroups: string[];
  /** The folded city key detected inside the query, or null when no group
   * matched a known city (or city extraction was disabled). */
  cityKey: string | null;
};

function normalize(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .slice(0, MAX_QUERY_LENGTH)
    .replace(/\s+/g, " ");
}

// Punctuation at either end of a token: "pune?", "(gst)", "tax." Letters,
// digits, "&" and "/" survive, so "m&a" and "ca/cs" stay whole; a hyphen
// inside a word ("cross-border") is never at an end, so it stays too.
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}&/]+|[^\p{L}\p{N}&/]+$/gu;

/** Tokens split on whitespace/commas, with edge punctuation stripped. */
function tokenize(normalized: string): string[] {
  return normalized
    .split(/[\s,]+/)
    .map((t) => t.replace(EDGE_PUNCTUATION, ""))
    .filter(Boolean);
}

export function parseQuery(
  query: string,
  known: {
    /** Lowercase phrases to greedily match as a single group: synonym
     * triggers and city names. A one-word entry is a harmless no-op here -
     * it just matches the token it already equals, the same as the default
     * single-word grouping below. */
    phrases: readonly string[];
    /** Folded city keys that at least one approved member has. */
    cityKeys: ReadonlySet<string>;
    /** True when an explicit ?city= filter is already applied - disables
     * city extraction from the free-text query so the same city isn't
     * double-interpreted. */
    cityAlreadyFiltered?: boolean;
  },
): ParsedQuery {
  const normalized = normalize(query);
  if (!normalized) return { textGroups: [], cityKey: null };

  const tokens = tokenize(normalized);

  const phraseTokenLists = known.phrases
    .map((p) => tokenize(normalize(p)))
    .filter((t) => t.length > 1); // single-word phrases are a no-op; skip them
  const maxPhraseLen = phraseTokenLists.reduce(
    (m, t) => Math.max(m, t.length),
    1,
  );
  const phraseSet = new Set(phraseTokenLists.map((t) => t.join(" ")));

  const rawGroups: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    let matched = false;
    for (
      let len = Math.min(maxPhraseLen, tokens.length - i);
      len >= 2;
      len--
    ) {
      const candidate = tokens.slice(i, i + len).join(" ");
      if (phraseSet.has(candidate)) {
        rawGroups.push(candidate);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      rawGroups.push(tokens[i]);
      i += 1;
    }
  }

  const groups = rawGroups.filter(
    (g) => !(g.indexOf(" ") === -1 && STOPWORDS.has(g)),
  );
  // Only stopwords or only punctuation (",,,"): search for the whole query as
  // typed, so the search is never silently empty or silently everything.
  if (groups.length === 0) return { textGroups: [normalized], cityKey: null };

  let cityKey: string | null = null;
  const textGroups: string[] = [];
  for (const g of groups) {
    if (
      !known.cityAlreadyFiltered &&
      cityKey === null &&
      known.cityKeys.has(g)
    ) {
      cityKey = g;
      continue;
    }
    textGroups.push(g);
  }

  return { textGroups: textGroups.slice(0, MAX_GROUPS), cityKey };
}
