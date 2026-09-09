// Members type their own city on the application form, so the same place
// reaches the database in several spellings ("pune", "Pune", "Pune ").
// PEOPLE-01 folds them here so the filter shows one option per place and
// matches every member in it.

/**
 * One entry in the PEOPLE-01 city filter. `value` is the folded key that goes
 * into the URL and the query; `label` is what the member sees.
 */
export type DirectoryCity = { value: string; label: string };

/** Folded form of a city: what "pune", "Pune " and "PUNE" all share. */
export function cityKey(city: string): string {
  return city.trim().toLowerCase();
}

// Words break on spaces and hyphens, so "navi-mumbai" reads as two words and
// becomes "Navi-Mumbai" rather than "Navi-mumbai".
const WORD_BREAK = /([\s-]+)/;

/** True when every word is already capitalised the ordinary way. */
function isTitleCase(city: string): boolean {
  return city
    .split(WORD_BREAK)
    .filter((w) => /\p{L}/u.test(w))
    .every((w) => {
      // Judge the first letter, not the first character, so a word wrapped in
      // brackets is not mistaken for one that is already capitalised.
      const at = w.search(/\p{L}/u);
      const tail = w.slice(at + 1);
      return w[at] === w[at].toUpperCase() && tail === tail.toLowerCase();
    });
}

/** Capitalise a word, but leave one that already carries capitals alone. */
function titleCase(city: string): string {
  return city
    .split(WORD_BREAK)
    .map((w) =>
      !/\p{L}/u.test(w) || w !== w.toLowerCase()
        ? w
        : w.replace(/\p{L}/u, (ch) => ch.toUpperCase()),
    )
    .join("");
}

/**
 * Collapse the spellings to one option per place: prefer the variant that is
 * already capitalised normally, otherwise capitalise the first one. Sorted by
 * label so the filter reads alphabetically.
 */
export function groupCities(rows: (string | null | undefined)[]): DirectoryCity[] {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const city = (row ?? "").trim();
    if (!city) continue;
    const key = cityKey(city);
    const variants = groups.get(key);
    if (variants) variants.push(city);
    else groups.set(key, [city]);
  }
  return [...groups.entries()]
    .map(([value, variants]) => {
      // Codepoint order, not localeCompare: localeCompare can call two
      // different strings equal, which would let the label drift with the row
      // order the database happens to return.
      const sorted = [...variants].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const label = sorted.find(isTitleCase) ?? titleCase(sorted[0]);
      return { value, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
