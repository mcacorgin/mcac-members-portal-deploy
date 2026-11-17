// MCAC member numbers (tracker row 56). Stored as a plain integer on
// users.member_number and shown as "MCAC" plus at least three digits:
// 1 -> MCAC001, 42 -> MCAC042, 1234 -> MCAC1234.
//
// The live Phase 1 tracker (row 68, revision 44, checked 27 Oct) approves
// MCAC001, MCAC002, in order of joining. Changing the display later changes
// this one function; the stored numbers do not change.

export const MEMBER_NUMBER_PREFIX = "MCAC";
const MIN_DIGITS = 3;

export function formatMemberNumber(n: number | null | undefined): string | null {
  if (n == null || !Number.isInteger(n) || n < 1) return null;
  return `${MEMBER_NUMBER_PREFIX}${String(n).padStart(MIN_DIGITS, "0")}`;
}
