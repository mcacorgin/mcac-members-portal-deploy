import NextAuth, { type NextAuthConfig } from "next-auth";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import LinkedIn from "next-auth/providers/linkedin";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { getConfig } from "@/lib/config";
import { getViewer, type Viewer } from "@/lib/authz";
import {
  clearFailures,
  isLockedOut,
  recordFailure,
} from "@/lib/auth-rate-limit";
import {
  consumeLinkIntent,
  isLinkedInLinked,
  LINK_INTENT_COOKIE,
} from "@/lib/account/linked-accounts";
import { recordAudit } from "@/lib/audit";
import { sessionCookieName } from "@/lib/auth-cookie-name";

// Orchestrator-owned auth wiring (shared contract). Sessions are JWTs that
// prove identity ONLY - every permission decision reloads the user row via
// getViewer, so approval revocation applies on the next request.

export const linkedInConfigured = Boolean(
  process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET,
);

// Outside production, AUTH_LINKEDIN_ISSUER points the provider at a mock
// OIDC server so e2e tests can run the full OAuth dance. Production always
// uses LinkedIn's real issuer baked into the provider.
const linkedInOptions =
  process.env.NODE_ENV !== "production" && process.env.AUTH_LINKEDIN_ISSUER
    ? { issuer: process.env.AUTH_LINKEDIN_ISSUER }
    : {};

const baseConfig: NextAuthConfig = {
  // Set explicitly, with the same fallback next-auth would apply
  // (next-auth/lib/env.js:22, which only fills a nullish secret). The gate
  // decodes the session itself and must use the very key the library signs
  // with, so both read this one value instead of each consulting the
  // environment on its own.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  // Derive the canonical URL from the request host so dev works on any port
  // and Vercel deployments need no AUTH_URL. Behind a proxy this trusts
  // x-forwarded-host, which Vercel controls.
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: tables.users,
    accountsTable: tables.accounts,
    sessionsTable: tables.sessions,
    verificationTokensTable: tables.verificationTokens,
  }),
  session: { strategy: "jwt" },
  // OAuth callback errors (e.g. OAuthAccountNotLinked) land back on the
  // sign-in page, which renders a friendly message from the error param.
  pages: { signIn: "/sign-in", error: "/sign-in" },
  providers: [
    ...(linkedInConfigured
      ? [
          LinkedIn({
            ...linkedInOptions,
            // Keep no bearer tokens or ID-token claims. handleLoginOrRegister
            // merges providerAccountId/provider/type/userId over this, so the
            // account row still identifies the member.
            account: () => ({}),
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        if (await isLockedOut(email)) return null;
        if (!(await getConfig("auth.emailFallbackEnabled"))) return null;
        const user = await db.query.users.findFirst({
          where: eq(tables.users.email, email),
        });
        if (!user?.passwordHash) {
          await recordFailure(email);
          return null;
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await recordFailure(email);
          return null;
        }
        await clearFailures(email);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  events: {
    // OAuth registrations arrive through the adapter; make sure the profile
    // row exists so onboarding and visibility defaults are well-defined.
    async createUser({ user }) {
      if (!user.id) return;
      const [phone, email, linkedin] = await Promise.all([
        getConfig("contact.defaults.phone"),
        getConfig("contact.defaults.email"),
        getConfig("contact.defaults.linkedin"),
      ]);
      await db
        .insert(tables.profiles)
        .values({
          userId: user.id,
          phoneVisibility: phone,
          emailVisibility: email,
          linkedinVisibility: linkedin,
        })
        .onConflictDoNothing();
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (typeof token.iat === "number")
        (session as { issuedAt?: number }).issuedAt = token.iat;
      return session;
    },
  },
};

/**
 * The ONE session cookie name Auth.js will use for this request.
 *
 * The derivation itself lives in lib/auth-cookie-name.ts, which imports no
 * next-auth and so can be tested directly; the reasoning is written up there.
 * This wrapper only supplies the three inputs from where they actually live.
 *
 * `url` is `new URL(req.url)` (@auth/core lib/utils/web.js:23) of the very
 * request next-auth handed this factory - `const _config = await config(req);
 * return Auth(reqWithEnvURL(req), _config)` (next-auth/index.js:104-106).
 * `reqWithEnvURL` swaps in AUTH_URL/NEXTAUTH_URL's origin first when either is
 * set (next-auth/lib/env.js:5-11); this app leaves both unset, but mirror it so
 * the two cannot drift if that ever changes.
 *
 * `trustHost` does not enter here at all: it only decides whether core ACCEPTS
 * the host (@auth/core lib/utils/assert.js:51), it never builds a URL.
 * `x-forwarded-proto`/`x-forwarded-host` do not either - they feed
 * createActionURL (@auth/core lib/utils/env.js:81-82), which synthesises the
 * request for `auth()` session reads, not the OAuth callback route this gate
 * runs on, which is served straight from the incoming request.
 *
 * One thing this does NOT track: `config.cookies.sessionToken.name`, which
 * init.js merges over the defaults. Nothing sets it, and setting it without
 * changing this would put the two resolutions back out of step.
 */
function requestSessionCookieName(request: NextRequest): string {
  return sessionCookieName({
    requestUrl: request.url,
    // Nullish between the two, exactly as next-auth/lib/env.js:6 does, so an
    // empty AUTH_URL shadows NEXTAUTH_URL instead of falling through to it.
    envUrl: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL,
    useSecureCookies: baseConfig.useSecureCookies,
  });
}

/**
 * The member the library is about to act as, or null. Decoded rather than
 * sniffed from cookie names: Auth.js accepts ANY cookie whose name starts with
 * the session name (@auth/core utils/cookie.js:129) and splits a large session
 * across `<name>.0`, `<name>.1`, ..., so name matching is guesswork that reads
 * a real session as "nobody is signed in" - the answer that lets a link
 * through. getToken runs the same SessionStore the callback does, under the one
 * name resolved above, so it sees exactly what the callback will see. The name
 * doubles as the encryption salt, so it is passed for both.
 */
async function sessionUserId(request: NextRequest): Promise<string | null> {
  return (await requestSessionIdentity(request))?.userId ?? null;
}

async function requestSessionIdentity(
  request: NextRequest,
): Promise<{ userId: string; issuedAt?: number } | null> {
  const cookieName = requestSessionCookieName(request);
  const token = await getToken({
    req: request,
    secret: baseConfig.secret!,
    salt: cookieName,
    cookieName,
  });
  return token?.sub
    ? { userId: token.sub, issuedAt: token.iat }
    : null;
}

// Request-aware config: the signIn callback has to read the enrollment-intent
// cookie, and this is the supported way to get the request into a callback
// (next-auth/index.d.ts:323). The gate runs BEFORE the account row is written
// (@auth/core callback/index.js:63-70), so a refusal prevents the link rather
// than having to undo it.
export const { handlers, auth, signIn, signOut } = NextAuth((request) => {
  // next-auth calls this factory once per request (`const _config = await
  // config(req)`, next-auth/index.js:104), so this flag is request-scoped -
  // concurrent sign-ins each get their own. The gate below is the only place
  // that can tell a member ATTACHING LinkedIn from a stranger REGISTERING with
  // it, because only it sees the enrollment intent; events.linkAccount fires on
  // both paths (@auth/core callback/handle-login.js:162 and :210) with no way
  // to distinguish them. Carry the answer across.
  let viaEnrollmentIntent = false;

  return {
    ...baseConfig,
    events: {
      ...baseConfig.events,
      async linkAccount({ user, account }) {
        if (account.provider !== "linkedin" || !user.id) return;
        // This event is awaited AFTER the account row is written, so a throw
        // here would report a link that actually happened as a failure. It
        // cannot: @auth/core wraps every event handler in its own try/catch and
        // logs an EventError instead (lib/init.js:89 and :138-151) - verified by
        // making recordAudit throw and watching the link still complete. The
        // catch below is not what keeps the link safe; it is here to say WHICH
        // user and which action lost its audit row, which the library's generic
        // EventError does not, and to keep that true if the library ever stops
        // wrapping. The link is done either way; the trail is best-effort.
        try {
          await recordAudit({
            actorId: user.id,
            action: viaEnrollmentIntent
              ? "account.linkedin.link"
              : "account.linkedin.register",
            subjectType: "user",
            subjectId: user.id,
            detail: {
              providerAccountId: account.providerAccountId,
              via: viaEnrollmentIntent ? "enrollment-intent" : "registration",
            },
          });
        } catch (error) {
          console.error(
            `audit: failed to record LinkedIn link for user ${user.id}`,
            error,
          );
        }
      },
    },
    callbacks: {
      ...baseConfig.callbacks,
      async signIn({ account, user: providerUser }) {
        if (account?.provider !== "linkedin") return true;

        // Without the request there is no way to tell a link from a
        // registration, so refuse rather than guess. Every OAuth callback has
        // one; if this ever fires, LinkedIn breaks loudly instead of silently
        // letting links through.
        if (!request) return false;

        const token = request.cookies.get(LINK_INTENT_COOKIE)?.value;
        const signedIn = await sessionUserId(request);

        // The cookie outlives its row. connectLinkedIn sets it for 5 minutes
        // (me/actions.ts:125-131) and nothing clears it, while consumeLinkIntent
        // deletes the row on the first callback - so a spent cookie rides along
        // on later sign-ins. A token that no longer resolves is worth exactly
        // what no token is worth, so the two cases share one answer below.
        const intent = token ? await consumeLinkIntent(token) : null;

        // LinkedIn can omit the email claim. A returning linked account has
        // the stored portal email, and an authenticated linking flow does not
        // need the provider email. A first-time registration needs one because
        // portal accounts require a unique email address.
        if (!intent && !signedIn && !providerUser.email) {
          return "/sign-in?error=LinkedInEmailRequired";
        }

        // No usable intent: legitimate only when nobody is signed in - the
        // ordinary registration and sign-in lane. A live session without one
        // means someone skipped the password check.
        if (!intent) return !signedIn;

        // handleLoginOrRegister links to whoever the SESSION says, not to the
        // intent's owner (@auth/core callback/handle-login.js:200-211). So an
        // intent minted by one member, replayed under another member's session,
        // would attach the first member's LinkedIn identity to the second. The
        // password was re-entered by intent.userId; only that member may be
        // linked.
        if (signedIn !== intent.userId) return false;

        // The library will not re-check any of this, so it happens here.
        const member = await db.query.users.findFirst({
          where: eq(tables.users.id, intent.userId),
          columns: { status: true, credentialsChangedAt: true },
        });
        if (!member || member.status !== "approved") return false;
        if (
          member.credentialsChangedAt &&
          member.credentialsChangedAt.getTime() > intent.createdAt.getTime()
        )
          return false;
        if (await isLinkedInLinked(intent.userId)) return false;

        // Everything below this line in the request is an attach, not a
        // registration. Only set it once the answer is yes: a refused link
        // writes no account row and so fires no event.
        viaEnrollmentIntent = true;
        return true;
      },
    },
  };
});

/**
 * Session -> fresh Viewer (or null). The entry point every page and server
 * action uses. Tokens issued before the user's last password reset are
 * rejected, so credential recovery revokes stolen sessions.
 */
export async function requireViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return freshViewer(
    session.user.id,
    (session as { issuedAt?: number }).issuedAt,
  );
}

/** Route handlers have the request already, so decode it directly instead of
 * relying on Next's ambient `headers()` request scope. */
export async function requireViewerFromRequest(
  request: NextRequest,
): Promise<Viewer | null> {
  const identity = await requestSessionIdentity(request);
  if (!identity) return null;
  return freshViewer(identity.userId, identity.issuedAt);
}

async function freshViewer(
  userId: string,
  issuedAt?: number,
): Promise<Viewer | null> {
  const row = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
    columns: { credentialsChangedAt: true },
  });
  if (
    row?.credentialsChangedAt &&
    typeof issuedAt === "number" &&
    // 2s skew grace: a token minted in the same instant as the change stays valid.
    issuedAt * 1000 < row.credentialsChangedAt.getTime() - 2000
  ) {
    return null;
  }
  return getViewer(userId);
}
