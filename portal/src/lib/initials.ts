// Avatar initials. Members often type a title or a qualification into their
// name ("CA Rahul Shah", "Aditya Jadhav, CFA"), and taking the first and last
// word then gave "CS" and "AC". Titles and credentials are dropped from
// either end first; the name itself is never lost.

// Compared lower-case with the dots removed, so "Ph.D." and "phd" both match.
const TITLES = new Set([
  "ca",
  "cs",
  "cma",
  "cfa",
  "aca",
  "fca",
  "acs",
  "fcs",
  "cpa",
  "cfp",
  "frm",
  "icwa",
  "caiib",
  "mba",
  "phd",
  "llb",
  "llm",
  "bcom",
  "mcom",
  "adv",
  "advocate",
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "shri",
  "smt",
  "er",
]);

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// Single letters joined by dots: "M.S.", "C.S.", "M.S". These read as the
// titles Ms and CS, but in "M.S. Kulkarni" they are the person's initials.
const DOTTED_INITIALS = /^\p{L}(\.\p{L})+\.?$/u;

function isTitle(word: string): boolean {
  return TITLES.has(word.replace(/\./g, "").toLowerCase());
}

/** The first letter or digit of a word, so a quote or bracket in front of a
 * name is skipped. Falls back to the first character. */
function initialOf(word: string): string {
  const chars = Array.from(word);
  return chars.find((c) => LETTER_OR_DIGIT.test(c)) ?? chars[0] ?? "";
}

function initialsFromWords(words: string[]): string {
  if (words.length === 0) return "?";
  const first = initialOf(words[0]);
  const last = words.length > 1 ? initialOf(words[words.length - 1]) : "";
  return (first + last).toUpperCase();
}

function wordsOf(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * One or two letters for an avatar: the first letter of the first and last
 * words of the name. Text after a comma or inside brackets is ignored, and
 * titles and credentials (CA, CFA, Dr, Shri, ...) are dropped from the start
 * and the end. If that leaves one word, dotted initials next to it are kept,
 * so "M.S. Kulkarni" gives "MK", not "K". If it leaves nothing, the whole
 * name is used as typed.
 */
export function initialsOf(name: string): string {
  const cleaned = name
    .split(",")[0]
    .replace(/\([^)]*\)/g, " ")
    // An unclosed bracket: drop everything after it.
    .replace(/\(.*$/, " ");
  const words = wordsOf(cleaned).filter((w) => LETTER_OR_DIGIT.test(w));
  let start = 0;
  let end = words.length;
  while (start < end && isTitle(words[start])) start += 1;
  while (end > start && isTitle(words[end - 1])) end -= 1;
  if (end - start === 1) {
    if (start > 0 && DOTTED_INITIALS.test(words[start - 1])) start -= 1;
    else if (end < words.length && DOTTED_INITIALS.test(words[end])) end += 1;
  }
  if (end > start) return initialsFromWords(words.slice(start, end));
  const all = wordsOf(name);
  const named = all.filter((w) => LETTER_OR_DIGIT.test(w));
  return initialsFromWords(named.length > 0 ? named : all);
}
