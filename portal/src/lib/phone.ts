// Phone number handling for issue #82: the portal stores phone numbers in
// E.164 (+<country><national>). The registration, profile, and admin forms
// collect a country code (default +91) plus the national number; everything
// is normalized server-side before it reaches the database.

export const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "United States / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+971", label: "United Arab Emirates (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+965", label: "Kuwait (+965)" },
  { code: "+973", label: "Bahrain (+973)" },
  { code: "+968", label: "Oman (+968)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+852", label: "Hong Kong (+852)" },
  { code: "+64", label: "New Zealand (+64)" },
  { code: "+27", label: "South Africa (+27)" },
] as const;

export const DEFAULT_COUNTRY_CODE = "+91";

/**
 * Country codes whose numbering plans use a domestic trunk zero that must
 * be dropped when building the international form (e.g. 098... -> +91 98...
 * for India). Codes absent from this set (NANP +1, Singapore +65, Qatar
 * +974, Kuwait +965, Bahrain +973, Oman +968, Hong Kong +852) have no trunk
 * zero, so a leading zero there is left alone. Conservative list: when in
 * doubt the user can type the full international number with a leading +,
 * which bypasses trunk handling entirely.
 */
const TRUNK_ZERO_COUNTRIES = new Set([
  "+91", // India
  "+44", // United Kingdom
  "+61", // Australia
  "+49", // Germany
  "+33", // France
  "+81", // Japan
  "+60", // Malaysia
  "+966", // Saudi Arabia
  "+971", // United Arab Emirates
  "+31", // Netherlands
  "+353", // Ireland
  "+64", // New Zealand
  "+27", // South Africa
]);

/** E.164: a leading + followed by 7-15 digits (ITU-T limit). */
export const E164_PATTERN = /^\+\d{7,15}$/;

export function isValidE164(phone: string): boolean {
  return E164_PATTERN.test(phone.trim());
}

/**
 * Normalize a phone number to E.164. A leading + means the input already
 * carries its country code, so only formatting is stripped; otherwise the
 * selected country code is prepended after dropping formatting and, for
 * countries whose numbering plans use one, the national trunk zero (e.g.
 * 098... -> 98... for India). Returns "" when no digits remain, so
 * required-field validation can report it as missing.
 */
export function toE164(countryCode: string, phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }
  const ccDigits = countryCode.replace(/\D/g, "");
  let national = trimmed.replace(/\D/g, "");
  if (TRUNK_ZERO_COUNTRIES.has(`+${ccDigits}`)) {
    national = national.replace(/^0+/, "");
  }
  if (!ccDigits || !national) return "";
  return `+${ccDigits}${national}`;
}

/**
 * Split a stored number back into country code + national digits so the
 * form can prefill the dropdown and the input separately. Matches the
 * longest known country-code prefix; anything unrecognized falls back to
 * the default code with the raw digits as the national part.
 */
export function splitE164(phone: string): {
  countryCode: string;
  national: string;
} {
  const digits = phone.trim().replace(/\D/g, "");
  if (!digits) return { countryCode: DEFAULT_COUNTRY_CODE, national: "" };
  const codes = COUNTRY_CODES.map((c) => c.code.replace(/\D/g, "")).sort(
    (a, b) => b.length - a.length,
  );
  for (const cc of codes) {
    if (digits.startsWith(cc) && digits.length > cc.length) {
      return { countryCode: `+${cc}`, national: digits.slice(cc.length) };
    }
  }
  // Unknown prefix: keep the original text (including any +) as the
  // national part, so a re-save round-trips through toE164's leading-+
  // path unchanged instead of being silently rewritten under +91.
  const raw = phone.trim();
  return {
    countryCode: DEFAULT_COUNTRY_CODE,
    national: raw.startsWith("+") ? raw : digits,
  };
}
