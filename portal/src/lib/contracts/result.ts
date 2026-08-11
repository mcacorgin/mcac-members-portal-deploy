// Server-action result envelope (frozen contract). Every server action
// returns ActionResult<T>; UI switches on `ok` and renders errors by code.

export const ERROR_CODES = [
  "unauthorized", // no valid session
  "forbidden", // authenticated but not permitted (fail closed)
  "pending_approval", // account is pending; member content is isolated
  "account_restricted", // rejected / needs_changes / suspended
  "validation", // input failed schema checks; fieldErrors set
  "not_found",
  "conflict", // duplicate account, stale update
  "section_disabled", // section off globally or for this member
  "rate_limited",
  "internal",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err<T = never>(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, code, message, fieldErrors };
}
