"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  dismissNotification as dismissNotificationRow,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/queries";

// HOME-03 server actions. Both re-authorize through the queries module
// (defense in depth) and refresh the shell so the bell badge updates.

// The only screens a notification may follow to. Server-action arguments are
// untrusted; anything else (including protocol-relative //host URLs) falls
// back to the notifications list. Non-admins who somehow follow an
// /admin/applications/[id] target are bounced by the admin layout guard, so
// allowing it here is safe for every viewer, not just admins.
const SAFE_TARGET =
  /^\/(me|posts\/[A-Za-z0-9_-]+(?:#comment-[A-Za-z0-9_-]+)?|admin\/applications\/[A-Za-z0-9_-]+)$/;

/** Mark one notification read, then follow it to its related screen. */
export async function openNotification(
  notificationId: string,
  target: string,
): Promise<void> {
  const viewer = await requireViewer();
  await markNotificationRead(viewer, notificationId);
  revalidatePath("/", "layout");
  redirect(SAFE_TARGET.test(target) ? target : "/notifications");
}

export async function markAllRead(): Promise<void> {
  const viewer = await requireViewer();
  await markAllNotificationsRead(viewer);
  revalidatePath("/", "layout");
}

/** Remove one notification from the viewer's own list for good. */
export async function dismissNotification(notificationId: string): Promise<void> {
  const viewer = await requireViewer();
  await dismissNotificationRow(viewer, notificationId);
  revalidatePath("/", "layout");
}
