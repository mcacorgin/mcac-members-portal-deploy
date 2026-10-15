// Members type their own city on the application form, so the same place
// reaches the database in several spellings ("pune", "Pune", "Pune ").
// PEOPLE-01 folds them here so the filter shows one option per place and
// matches every member in it.

/**
 * One entry in a folded PEOPLE-01 filter list. `value` is the folded key;
 * `label` is what the member sees.
 */
export type FoldedLabel = { value: string; label: string };

/** One entry in the PEOPLE-01 city filter (see FoldedLabel). */
export type DirectoryCity = FoldedLabel;

/** Folded form of a city: what "pune", "Pune " and "PUNE" all share. */
export function cityKey(city: string): string {
  return city.trim().toLowerCase();
}

// Words break on spaces, hyphens, and ampersands, so "navi-mumbai" reads as
// two words and becomes "Navi-Mumbai" rather than "Navi-mumbai", and
// "m&a advisor" (a profession, not a city, but folded the same way) becomes
// "M&A Advisor" rather than "M&a Advisor".
const WORD_BREAK = /([\s&-]+)/;

// Minor words that stay lowercase when they are not the first word of a
// place or profession name ("Daman and Diu", "Insolvency Professional and
// Forensic Audit Specialist"), the way a style guide title-cases them. The
// Romance particles (de, da, di, du, la, le) are for place and company names
// ("Cote d'Ivoire"-style names, "the Cite de la Musique"). A minor word only
// counts when it is its own space-separated word. "a" is left out on
// purpose: in "Grade A Contractor" or "Sector 7 A" it is a letter, not an
// article.
const MINOR_WORDS = new Set([
  "and", "or", "of", "the", "in", "on", "at", "for", "to", "with",
  "an", "de", "da", "di", "du", "la", "le",
]);

/** True when the separator right before a word (if any) is plain whitespace,
 * i.e. the word is space-separated rather than joined by a hyphen or "&". */
function isSpaceSeparated(parts: string[], index: number): boolean {
  return index > 0 && /^\s+$/.test(parts[index - 1]);
}

/**
 * True when every word is already capitalised the ordinary way, treating a
 * MINOR_WORDS entry that is not the first word as correctly capitalised when
 * it is spelled lowercase ("Daman and Diu" is title case; so is "the Hague"
 * for its second word, but the first word of a name still needs a capital:
 * "the hague" is not).
 */
function isTitleCase(city: string): boolean {
  const parts = city.split(WORD_BREAK);
  let seenWord = false;
  return parts.every((w, i) => {
    if (!/\p{L}/u.test(w)) return true;
    const isFirstWord = !seenWord;
    seenWord = true;
    if (
      !isFirstWord &&
      isSpaceSeparated(parts, i) &&
      w === w.toLowerCase() &&
      MINOR_WORDS.has(w)
    ) {
      return true;
    }
    // Judge the first letter, not the first character, so a word wrapped in
    // brackets is not mistaken for one that is already capitalised.
    const at = w.search(/\p{L}/u);
    const tail = w.slice(at + 1);
    return w[at] === w[at].toUpperCase() && tail === tail.toLowerCase();
  });
}

/**
 * Capitalise a word, but leave one that already carries capitals alone, and
 * leave a MINOR_WORDS entry lowercase unless it is the first word ("the
 * hague" -> "The Hague", but "and" in "daman and diu" -> "Daman and Diu").
 */
function titleCase(city: string): string {
  const parts = city.split(WORD_BREAK);
  let seenWord = false;
  return parts
    .map((w, i) => {
      if (!/\p{L}/u.test(w)) return w;
      const isFirstWord = !seenWord;
      seenWord = true;
      if (w !== w.toLowerCase()) return w;
      if (!isFirstWord && isSpaceSeparated(parts, i) && MINOR_WORDS.has(w)) {
        return w;
      }
      return w.replace(/\p{L}/u, (ch) => ch.toUpperCase());
    })
    .join("");
}

/**
 * Collapse free-text spellings to one option per distinct value: prefer the
 * variant that is already capitalised normally, otherwise capitalise the
 * first one. Sorted by label so a filter built from this reads
 * alphabetically. Shared by groupCities (PEOPLE-01 city filter) and
 * groupProfessions (PEOPLE-01 profession filter) - members type both fields
 * freely, so both need the same case-folding.
 */
export function foldLabels(rows: (string | null | undefined)[]): FoldedLabel[] {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const value = (row ?? "").trim();
    if (!value) continue;
    const key = cityKey(value);
    const variants = groups.get(key);
    if (variants) variants.push(value);
    else groups.set(key, [value]);
  }
  return [...groups.entries()]
    .map(([value, variants]) => {
      // Codepoint order, not localeCompare: localeCompare can call two
      // different strings equal, which would let the label drift with the row
      // order the database happens to return.
      const sorted = [...variants].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      // When several spellings are already capitalised ("Daman And Diu" and
      // "Daman and Diu"), prefer the one this module would write itself.
      const canonical = titleCase(value);
      const label = variants.includes(canonical)
        ? canonical
        : (sorted.find(isTitleCase) ?? titleCase(sorted[0]));
      return { value, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Collapse the spellings to one option per place: prefer the variant that is
 * already capitalised normally, otherwise capitalise the first one. Sorted by
 * label so the filter reads alphabetically.
 */
export function groupCities(rows: (string | null | undefined)[]): DirectoryCity[] {
  return foldLabels(rows);
}
