import { and, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { memberAccessError, type Viewer } from "@/lib/authz";
import { db, tables } from "@/db";

/** Only the first payment confirmation can create this audit marker. */
export async function listNewMembers(viewer: Viewer | null, now = new Date()) {
  if (memberAccessError(viewer)) return [];
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return db.select({ id: tables.users.id, name: tables.users.name })
    .from(tables.users)
    .innerJoin(tables.auditLog, and(
      eq(tables.auditLog.subjectId, tables.users.id),
      eq(tables.auditLog.subjectType, "user"),
      eq(tables.auditLog.action, "account.approved"),
      sql`${tables.auditLog.detail} ->> 'firstPaidActivation' = 'true'`,
    ))
    .where(and(
      eq(tables.users.role, "member"),
      eq(tables.users.status, "approved"),
      gt(tables.users.membershipValidUntil, now),
      gte(tables.auditLog.createdAt, cutoff),
      lte(tables.auditLog.createdAt, now),
    ))
    .orderBy(desc(tables.auditLog.createdAt), desc(tables.auditLog.id))
    .limit(5);
}
