export const VERTICAL_INTEREST_LABELS = [
  "AI & Automation",
  "SaaS & Product",
  "Software Engineering",
  "Cybersecurity",
  "Real Estate — Industrial & Pre-leased",
  "Real Estate — Redevelopment",
  "Healthcare & Hospitals",
  "Pharma",
  "Auto Components",
  "Manufacturing & Engineering",
  "Retail",
  "EPC & Infrastructure",
  "Logistics & Warehousing",
  "Banking & NBFC",
] as const;

const verticalLabels = new Set<string>(VERTICAL_INTEREST_LABELS);

export type ExpertiseTagOption = { id: string; label: string };

/**
 * The existing member_tags relation remains the storage and search contract.
 * This function only gives the application form the two panels requested by
 * MCAC, so existing member selections do not need a data migration.
 *
 * Administrator-created labels default to Profession. That is the safer
 * fallback for an unknown tag because it keeps the label selectable instead
 * of silently hiding it from applicants.
 */
export function groupExpertiseTags<T extends ExpertiseTagOption>(tags: T[]): {
  professions: T[];
  verticals: T[];
} {
  const professions: T[] = [];
  const verticals: T[] = [];

  for (const tag of tags) {
    (verticalLabels.has(tag.label) ? verticals : professions).push(tag);
  }

  return { professions, verticals };
}
