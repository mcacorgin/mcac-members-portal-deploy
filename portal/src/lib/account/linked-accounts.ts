import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db, tables } from "@/db";

// The join between a portal user and their LinkedIn identity, plus the
// short-lived enrollment intent that proves a password was re-entered just
// before the OAuth round trip started.

/** Raw token lives here; only its hash reaches the database. */
export const LINK_INTENT_COOKIE = "mcac-link-intent";

const INTENT_TTL_MS = 5 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function isLinkedInLinked(userId: string): Promise<boolean> {
  const row = await db.query.accounts.findFirst({
    where: and(
      eq(tables.accounts.userId, userId),
      eq(tables.accounts.provider, "linkedin"),
    ),
  });
  return Boolean(row);
}

/** Mint a single-use intent and return the raw token for the cookie. */
export async function createLinkIntent(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  // Opportunistic sweep; rows are short-lived and single-use.
  await db.delete(tables.linkIntents).where(lt(tables.linkIntents.expiresAt, now));
  await db.insert(tables.linkIntents).values({
    tokenHash: hashToken(token),
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INTENT_TTL_MS),
  });
  return token;
}

/**
 * Delete the intent and return it when it was still valid. The row goes
 * whether or not it turns out to be usable, so a token is never replayable.
 */
export async function consumeLinkIntent(
  token: string,
): Promise<{ userId: string; createdAt: Date } | null> {
  const [row] = await db
    .delete(tables.linkIntents)
    .where(eq(tables.linkIntents.tokenHash, hashToken(token)))
    .returning();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { userId: row.userId, createdAt: row.createdAt };
}

/** True when a LinkedIn row was actually removed. */
export async function unlinkLinkedIn(userId: string): Promise<boolean> {
  const removed = await db
    .delete(tables.accounts)
    .where(
      and(
        eq(tables.accounts.userId, userId),
        eq(tables.accounts.provider, "linkedin"),
      ),
    )
    .returning();
  return removed.length > 0;
}
