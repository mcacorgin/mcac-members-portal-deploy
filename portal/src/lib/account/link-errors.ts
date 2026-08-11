// The single list of Auth.js error codes this app understands, and the copy
// each surface shows for them.
//
// There used to be three parallel lists - the forwarding allowlist on
// /sign-in, the message map on /sign-in, and the message map on /me - kept in
// step by hand. A code added to one and missed in another was silently
// unreachable, and nothing caught it. Here the allowlist IS the keys of this
// table, so a new code reaches every surface at once, and the type demands the
// /me copy that the allowlist makes reachable.
//
// Never echo a raw code to a person: anything not in this table becomes the
// generic fallback rather than travelling as attacker-chosen text.

type LinkErrorCopy = {
  /**
   * What a signed-out visitor sees on /sign-in. Optional: some codes cannot
   * reach an anonymous visitor and deliberately fall through to the generic
   * message there.
   */
  signIn?: string;
  /** What a signed-in member sees on /me. Every forwarded code needs one. */
  me: string;
};

export const LINK_ERRORS = {
  LinkedInEmailRequired: {
    signIn:
      "LinkedIn did not share an email address. Continue with email to start your application.",
    me: "LinkedIn did not share an email address. Nothing changed.",
  },
  OAuthAccountNotLinked: {
    signIn:
      "An account already uses this email. Sign in with your email and password below - a second account will not be created.",
    me: "That LinkedIn account is already connected to another member. Contact an administrator if that seems wrong.",
  },
  // AccessDenied only comes from a signIn callback rejection, which for an
  // anonymous visitor cannot happen - so it has no /sign-in copy and falls
  // through to the generic message there, and is handled on /me instead.
  AccessDenied: {
    me: "We could not confirm it was you. Nothing changed - start again from this page.",
  },
  // A provider-side failure is OAuthCallbackError (@auth/core
  // callback/oauth/callback.js:96-102).
  OAuthCallbackError: {
    signIn:
      "LinkedIn did not finish. Nothing was submitted - try again or use email.",
    me: "LinkedIn did not finish. Nothing changed.",
  },
} as const satisfies Record<string, LinkErrorCopy>;

export type LinkErrorCode = keyof typeof LINK_ERRORS;

const SIGN_IN_FALLBACK =
  "Sign-in did not complete. Nothing was submitted - try again.";
const ME_FALLBACK = "Connecting LinkedIn did not finish. Nothing changed.";

/** Only these codes may be forwarded into a URL. */
export function isForwardableError(code: string): code is LinkErrorCode {
  return Object.hasOwn(LINK_ERRORS, code);
}

/** The code to put in `/me?linkError=`, or "Unknown" for anything else. */
export function forwardableError(code: string): LinkErrorCode | "Unknown" {
  return isForwardableError(code) ? code : "Unknown";
}

export function signInErrorMessage(code: string): string {
  if (!isForwardableError(code)) return SIGN_IN_FALLBACK;
  // Widened so the optional `signIn` is reachable on entries that omit it.
  const copy: LinkErrorCopy = LINK_ERRORS[code];
  return copy.signIn ?? SIGN_IN_FALLBACK;
}

export function linkErrorMessage(code: string): string {
  return isForwardableError(code) ? LINK_ERRORS[code].me : ME_FALLBACK;
}
