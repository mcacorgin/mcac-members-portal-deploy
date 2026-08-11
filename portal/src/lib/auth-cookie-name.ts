// The session cookie name Auth.js uses for a given request, derived the way
// the library derives it. Kept in its own module, free of any next-auth import,
// so a spec file can load it directly: `src/lib/auth.ts` pulls in next-auth,
// which imports "next/server", which only Next's own bundler resolves
// (e2e/link-library.spec.ts:80-98 records that failure).

type SessionCookieInput = {
  /** The request URL @auth/core will parse, i.e. `request.url`. */
  requestUrl: string;
  /** `process.env.AUTH_URL ?? process.env.NEXTAUTH_URL`, whatever it is. */
  envUrl?: string;
  /** `config.useSecureCookies`, normally unset. */
  useSecureCookies?: boolean;
};

/**
 * There must be exactly one name, not a list to try in turn. The linking gate
 * compares its answer against the enrollment intent's owner, but the account
 * row is written for whoever the LIBRARY resolves to. Two independent
 * resolutions that merely agree most of the time is a takeover: with a plain
 * and a `__Secure-` session cookie both present and decoding to different
 * members, a list lets the gate approve against one while the library links the
 * other.
 *
 * Mirroring @auth/core exactly, including which operator each step uses - they
 * are not the same, and using the wrong one is how an empty `AUTH_URL` turned
 * into `new URL("")` and took the whole LinkedIn lane down:
 *
 * - `AUTH_URL ?? NEXTAUTH_URL` is NULLISH, so an empty `AUTH_URL` deliberately
 *   shadows `NEXTAUTH_URL` rather than falling through to it
 *   (next-auth/lib/env.js:6, @auth/core lib/utils/env.js:68). The caller does
 *   that half and hands the result in as `envUrl`.
 * - Falling back from that to the request URL is TRUTHY: `if (!url) return req`
 *   (next-auth/lib/env.js:7-8) and `if (envUrl)` (@auth/core
 *   lib/utils/env.js:70). An empty string means "not set", not "use empty".
 * - `useSecureCookies ?? <protocol check>` is NULLISH, so an explicit `false`
 *   wins over an https URL (@auth/core lib/init.js:69).
 */
export function sessionCookieName(input: SessionCookieInput): string {
  const secure =
    input.useSecureCookies ??
    new URL(input.envUrl || input.requestUrl).protocol === "https:";
  return `${secure ? "__Secure-" : ""}authjs.session-token`;
}
