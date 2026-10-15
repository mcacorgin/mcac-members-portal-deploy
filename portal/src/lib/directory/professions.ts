// Members type their own profession on the application form, so the same
// role reaches the database in several spellings ("tax advisor",
// "Tax Advisor"). PEOPLE-01 folds them here, the same way cities.ts folds
// city names, so the profession filter's typeahead shows one option per
// distinct role.
import { foldLabels, type FoldedLabel } from "./cities";

/** One entry in the PEOPLE-01 profession filter (see FoldedLabel). */
export type DirectoryProfession = FoldedLabel;

/**
 * Collapse profession spellings to one option per distinct role. Sorted by
 * label so the typeahead reads alphabetically.
 */
export function groupProfessions(
  rows: (string | null | undefined)[],
): DirectoryProfession[] {
  return foldLabels(rows);
}
