import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, tables } from "@/db";
import { adminAccessError, type Viewer } from "@/lib/authz";
import { ok, err, type ActionResult } from "@/lib/contracts/result";
import { escapeLike } from "@/lib/sql-text";

// Admin reads (ADMIN-01/02/04). ADMIN-02 exposes only the required privacy
// audit data: notice version, acceptance timestamp, identity, account state.

export async function getAdminOverview(admin: Viewer | null): Promise<
  ActionResult<{
    pendingCount: number;
    needsChangesCount: number;
    memberCount: number;
    suspendedCount: number;
  }>
> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");
  const rows = await db
    .select({
      status: tables.users.status,
      count: sql<number>`count(*)::int`,
    })
    .from(tables.users)
    .groupBy(tables.users.status);
  const by = new Map(rows.map((r) => [r.status, r.count]));
  return ok({
    pendingCount: by.get("pending") ?? 0,
    needsChangesCount: by.get("needs_changes") ?? 0,
    memberCount: by.get("approved") ?? 0,
    suspendedCount: by.get("suspended") ?? 0,
  });
}

export type ReviewQueueRow = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "needs_changes";
  createdAt: Date;
  city: string;
  consented: boolean;
};

export async function listReviewQueue(
  admin: Viewer | null,
): Promise<ActionResult<ReviewQueueRow[]>> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");

  const rows = await db
    .select({
      id: tables.users.id,
      name: tables.users.name,
      email: tables.users.email,
      status: tables.users.status,
      createdAt: tables.users.createdAt,
      city: tables.profiles.city,
    })
    .from(tables.users)
    .leftJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
    .where(
      or(
        eq(tables.users.status, "pending"),
        eq(tables.users.status, "needs_changes"),
      ),
    )
    .orderBy(asc(tables.users.createdAt));

  const current = await db.query.privacyNotices.findFirst({
    where: eq(tables.privacyNotices.isCurrent, true),
  });
  const ids = rows.map((r) => r.id);
  const consents = current && ids.length
    ? await db.query.consentRecords.findMany({
        where: and(
          inArray(tables.consentRecords.userId, ids),
          eq(tables.consentRecords.noticeVersion, current.version),
        ),
      })
    : [];
  const consented = new Set(consents.map((c) => c.userId));

  return ok(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      status: r.status as "pending" | "needs_changes",
      createdAt: r.createdAt,
      city: r.city ?? "",
      consented: consented.has(r.id),
    })),
  );
}

export async function getApplicationDetail(
  admin: Viewer | null,
  userId: string,
): Promise<
  ActionResult<{
    id: string;
    name: string;
    email: string;
    role: Viewer["role"];
    status: Viewer["status"];
    statusReason: string | null;
    statusChangedAt: Date | null;
    createdAt: Date;
    profile: {
      city: string;
      phone: string;
      company: string;
      title: string;
      bio: string;
      linkedinUrl: string;
      phoneVisibility: string;
      emailVisibility: string;
      linkedinVisibility: string;
      onboardingCompletedAt: Date | null;
    } | null;
    tags: { id: string; label: string }[];
    consent: {
      currentVersion: number | null;
      acceptedCurrent: boolean;
      records: { noticeVersion: number; acceptedAt: Date }[];
    };
  }>
> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");

  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
  });
  if (!user) return err("not_found", "Account not found.");

  const [profile, tagRows, consentRows, current] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(tables.profiles.userId, userId) }),
    db
      .select({ id: tables.expertiseTags.id, label: tables.expertiseTags.label })
      .from(tables.memberTags)
      .innerJoin(
        tables.expertiseTags,
        eq(tables.expertiseTags.id, tables.memberTags.tagId),
      )
      .where(eq(tables.memberTags.userId, userId)),
    db.query.consentRecords.findMany({
      where: eq(tables.consentRecords.userId, userId),
      orderBy: desc(tables.consentRecords.acceptedAt),
    }),
    db.query.privacyNotices.findFirst({
      where: eq(tables.privacyNotices.isCurrent, true),
    }),
  ]);

  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    statusReason: user.statusReason,
    statusChangedAt: user.statusChangedAt,
    createdAt: user.createdAt,
    profile: profile
      ? {
          city: profile.city,
          phone: profile.phone,
          company: profile.company,
          title: profile.title,
          bio: profile.bio,
          linkedinUrl: profile.linkedinUrl,
          phoneVisibility: profile.phoneVisibility,
          emailVisibility: profile.emailVisibility,
          linkedinVisibility: profile.linkedinVisibility,
          onboardingCompletedAt: profile.onboardingCompletedAt,
        }
      : null,
    tags: tagRows,
    consent: {
      currentVersion: current?.version ?? null,
      acceptedCurrent: Boolean(
        current &&
          consentRows.some((c) => c.noticeVersion === current.version),
      ),
      records: consentRows.map((c) => ({
        noticeVersion: c.noticeVersion,
        acceptedAt: c.acceptedAt,
      })),
    },
  });
}

export async function listMembersAdmin(
  admin: Viewer | null,
  input: { q?: string; status?: Viewer["status"]; page?: number; pageSize?: number },
): Promise<
  ActionResult<{
    rows: {
      id: string;
      name: string;
      email: string;
      status: Viewer["status"];
      role: Viewer["role"];
      city: string;
      createdAt: Date;
      linkedInLinked: boolean;
    }[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));

  const conditions = [];
  if (input.q) {
    const pattern = `%${escapeLike(input.q)}%`;
    conditions.push(
      or(
        ilike(tables.users.name, pattern),
        ilike(tables.users.email, pattern),
      )!,
    );
  }
  if (input.status) conditions.push(eq(tables.users.status, input.status));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: tables.users.id,
        name: tables.users.name,
        email: tables.users.email,
        status: tables.users.status,
        role: tables.users.role,
        city: tables.profiles.city,
        createdAt: tables.users.createdAt,
      })
      .from(tables.users)
      .leftJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(where)
      .orderBy(asc(tables.users.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(tables.users)
      .where(where),
  ]);

  const linkedIds = rows.length
    ? new Set(
        (
          await db
            .select({ userId: tables.accounts.userId })
            .from(tables.accounts)
            .where(
              and(
                inArray(
                  tables.accounts.userId,
                  rows.map((r) => r.id),
                ),
                eq(tables.accounts.provider, "linkedin"),
              ),
            )
        ).map((r) => r.userId),
      )
    : new Set<string>();

  return ok({
    rows: rows.map((r) => ({
      ...r,
      city: r.city ?? "",
      linkedInLinked: linkedIds.has(r.id),
    })),
    total,
    page,
    pageSize,
  });
}
