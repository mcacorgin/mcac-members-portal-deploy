// Corpus-derived community vocabulary (2026-07-28 WhatsApp analysis; see
// docs/superpowers/specs/2026-07-28-search-discovery-upgrade-design.md).
// Trigger phrases are lowercase; matching is token/phrase-boundary based.

export const SYNONYMS: Record<string, string[]> = {
  "m&a": ["mergers", "acquisitions", "investment banking"],
  "mna": ["mergers", "acquisitions", "investment banking"],
  "merger": ["m&a", "investment banking"],
  "acquisition": ["m&a", "investment banking"],
  "mandate": ["m&a", "investment banking"],
  "exit": ["m&a"],
  "lawyer": ["advocate", "legal", "litigation"],
  "attorney": ["advocate", "legal"],
  "legal": ["advocate", "litigation"],
  "solicitor": ["advocate", "legal"],
  "gst": ["indirect tax"],
  "fema": ["cross-border", "international tax"],
  "tax": ["gst", "international tax"],
  "valuation": ["due diligence"],
  "due diligence": ["valuation"],
  "dd": ["due diligence", "valuation"],
  "investor": ["private equity", "fundraising"],
  "funding": ["private equity", "fundraising"],
  "fundraise": ["fundraising", "private equity"],
  "pe": ["private equity"],
  "vc": ["private equity", "fundraising"],
  "cs": ["company secretary"],
  "secretarial": ["company secretary"],
  "dpdp": ["data privacy"],
  "privacy": ["data privacy"],
  "hr": ["human resources", "organisation design", "recruitment"],
  "hiring": ["recruitment", "staffing"],
  "rpo": ["recruitment", "staffing"],
  "property": ["real estate"],
  "warehouse": ["real estate", "logistics"],
  "iso": ["certification"],
  "ai": ["automation"],
  "wealth": ["portfolio", "investment advisory"],
  "cfa": ["wealth management", "portfolio"],
  "msme": ["sme", "business advisory"],
  "sme": ["msme", "business advisory"],
  "erp": ["business analysis", "it advisory"],
  "audit": ["chartered accountant"],
  "ca": ["chartered accountant", "audit"],
};

const MAX_TERMS = 6;

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Token/phrase-boundary containment: trigger must appear as whole tokens. */
function containsPhrase(haystack: string, phrase: string): boolean {
  const tokens = haystack.split(/[^a-z0-9&]+/).filter(Boolean);
  const phraseTokens = phrase.split(/[^a-z0-9&]+/).filter(Boolean);
  for (let i = 0; i + phraseTokens.length <= tokens.length; i++) {
    if (phraseTokens.every((t, j) => tokens[i + j] === t)) return true;
  }
  return false;
}

export function expandQuery(q: string): string[] {
  const original = q.trim();
  if (!original) return [];
  const norm = normalize(original);
  const out: string[] = [original];
  const seen = new Set([norm]);
  for (const [trigger, expansions] of Object.entries(SYNONYMS)) {
    if (out.length >= MAX_TERMS) break;
    if (!containsPhrase(norm, trigger)) continue;
    for (const term of expansions) {
      if (out.length >= MAX_TERMS) break;
      const key = normalize(term);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(term);
    }
  }
  return out;
}
