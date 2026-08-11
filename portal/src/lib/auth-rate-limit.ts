// Shared database rate limit for failed credential checks. Credentials
// sign-in and LinkedIn account linking use the same email key, so failures
// count across application instances and both authentication surfaces.

import { db, tables } from "@/db";
import { eq, sql } from "drizzle-orm";

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export async function isLockedOut(key: string): Promise<boolean> {
  const entry = await db.query.authRateLimits.findFirst({
    where: eq(tables.authRateLimits.key, key),
  });
  if (!entry) return false;
  if (entry.resetAt.getTime() <= Date.now()) {
    await clearFailures(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export async function recordFailure(key: string): Promise<void> {
  const resetAt = new Date(Date.now() + FAILURE_WINDOW_MS);
  await db
    .insert(tables.authRateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: tables.authRateLimits.key,
      set: {
        count: sql<number>`
          case
            when ${tables.authRateLimits.resetAt} <= now() then 1
            else ${tables.authRateLimits.count} + 1
          end
        `,
        resetAt: sql<Date>`
          case
            when ${tables.authRateLimits.resetAt} <= now()
              then ${resetAt.toISOString()}::timestamptz
            else ${tables.authRateLimits.resetAt}
          end
        `,
      },
    });
}

export async function clearFailures(key: string): Promise<void> {
  await db
    .delete(tables.authRateLimits)
    .where(eq(tables.authRateLimits.key, key));
}
