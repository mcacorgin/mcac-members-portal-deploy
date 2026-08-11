import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { adminAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { listNotifications } from "@/lib/notifications/queries";
import { PortalShell } from "@/components/portal-shell";
import { AdminNav } from "./admin-nav";

// (admin) shell guard. Convenience only - every query and mutation in
// src/lib re-authorizes (defense in depth). Non-admin APPROVED members get
// "forbidden" here and are routed to their landing path (/home).
//
// Admin pages render inside the SAME rail/header/tabs shell as member pages
// (PortalShell) - the rail highlights "Administration" and is the way back
// to the portal, so there is no separate "Back to portal" link or header
// here. AdminNav is a section sub-nav inside the content column, scoped to
// an inner max-w-5xl measure for readability within the wider shell.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer();
  const denied = adminAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));

  const notifications = await listNotifications(viewer, { pageSize: 5 });
  const notificationPreview = notifications.ok
    ? notifications.data
    : { rows: [], unread: 0 };

  return (
    <PortalShell isAdmin notificationPreview={notificationPreview}>
      <div className="ui-admin-main mx-auto w-full max-w-5xl">
        <div className="mb-4 border-b border-border">
          <AdminNav />
        </div>
        {children}
      </div>
    </PortalShell>
  );
}
