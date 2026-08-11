import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, tables } from "@/db";
import { memberAccessError, type Viewer } from "@/lib/authz";
import { ok, err, type ActionResult } from "@/lib/contracts/result";

// In-app notifications (NOTF-01, HOME-03).

export type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
};

export async function listNotifications(
  viewer: Viewer | null,
  input: { page?: number; pageSize?: number } = {},
): Promise<ActionResult<{ rows: NotificationRow[]; unread: number }>> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));

  const [rows, [{ unread }]] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(tables.notifications.userId, viewer!.id),
      orderBy: desc(tables.notifications.createdAt),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(tables.notifications)
      .where(
        and(
          eq(tables.notifications.userId, viewer!.id),
          isNull(tables.notifications.readAt),
        ),
      ),
  ]);

  return ok({
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      readAt: r.readAt,
      createdAt: r.createdAt,
    })),
    unread,
  });
}

export async function unreadCount(viewer: Viewer | null): Promise<number> {
  if (memberAccessError(viewer)) return 0;
  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(tables.notifications)
    .where(
      and(
        eq(tables.notifications.userId, viewer!.id),
        isNull(tables.notifications.readAt),
      ),
    );
  return unread;
}

export async function markNotificationRead(
  viewer: Viewer | null,
  notificationId: string,
): Promise<ActionResult> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");
  await db
    .update(tables.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(tables.notifications.id, notificationId),
        eq(tables.notifications.userId, viewer!.id),
        isNull(tables.notifications.readAt),
      ),
    );
  return ok(undefined);
}

export async function dismissNotification(
  viewer: Viewer | null,
  notificationId: string,
): Promise<ActionResult> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");
  await db
    .delete(tables.notifications)
    .where(
      and(
        eq(tables.notifications.id, notificationId),
        eq(tables.notifications.userId, viewer!.id),
      ),
    );
  return ok(undefined);
}

export async function markAllNotificationsRead(
  viewer: Viewer | null,
): Promise<ActionResult> {
  const denied = memberAccessError(viewer);
  if (denied) return err(denied, "Member access is required.");
  await db
    .update(tables.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(tables.notifications.userId, viewer!.id),
        isNull(tables.notifications.readAt),
      ),
    );
  return ok(undefined);
}
