import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { hasAdminRole, memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { listNotifications } from "@/lib/notifications/queries";
import { PortalShell } from "@/components/portal-shell";

// THE member shell (route group "(member)"). Guard first: only approved
// accounts render anything below; everyone else is redirected to their
// current lifecycle screen. This guard is convenience only - every query and
// action re-authorizes in src/lib (defense in depth).
//
// Shell contract for sibling lanes: pages under (member) render inside
// <main> below and should start with their <ScreenId> and a PageHeader.
// Content width is owned by each page (use "mx-auto w-full max-w-3xl" for
// single-column screens). The mobile tab bar is fixed to four equal tabs;
// do not add destinations.

export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));

  const notifications = await listNotifications(viewer, { pageSize: 5 });
  const notificationPreview = notifications.ok
    ? notifications.data
    : { rows: [], unread: 0 };
  const isAdmin = hasAdminRole(viewer!.role);

  return (
    <PortalShell isAdmin={isAdmin} notificationPreview={notificationPreview}>
      {children}
    </PortalShell>
  );
}
