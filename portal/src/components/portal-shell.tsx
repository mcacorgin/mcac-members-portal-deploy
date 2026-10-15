import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/ui";
import { CollapsibleMobileHeader } from "@/components/collapsible-mobile-header";
import { MemberRailNav, MemberTabs } from "@/app/(member)/member-nav";
import { NotificationMenu } from "@/app/(member)/notification-menu";
import {
  listNotifications,
  NOTIFICATION_TRAY_MAX,
} from "@/lib/notifications/queries";
import type { Viewer } from "@/lib/authz";

// Shared rail/header/tabs shell, extracted mechanically from the (member)
// layout so member and admin pages render inside the same chrome (the
// client's "not uniform site" feedback). Guard rules and viewer loading stay
// in each layout - this component owns only the shell markup: brand rail +
// MemberRailNav (desktop), sticky header w/ NotificationMenu, mobile tab bar,
// 1440px container. Do not add auth/guard logic here.

export function PortalShell({
  isAdmin,
  viewer,
  children,
}: {
  isAdmin: boolean;
  viewer: Viewer;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
      {/* Desktop rail (lg+): same four destinations as the mobile tabs,
          plus Administration for admins. */}
      <aside className="ui-member-rail hidden w-[220px] flex-none flex-col border-r border-border bg-bg px-3 py-6 lg:flex">
        <div className="mx-2 mb-4 border-b border-border pb-4">
          <BrandLockup href="/" />
        </div>
        <MemberRailNav isAdmin={isAdmin} />
        {process.env.NODE_ENV !== "production" ? (
          <p className="ui-internal-scaffold mt-auto border-t border-border px-2 pt-2.5 text-[0.6875rem] text-ink-muted">
            Member navigation review
            <br />
            Home · People · Post · Me
          </p>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <CollapsibleMobileHeader className="flex min-h-[60px] items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur lg:px-6">
          {/* The desktop rail already carries the full lockup. */}
          <BrandLockup href="/" className="lg:hidden" />
          <span aria-hidden="true" className="hidden lg:block" />
          <div className="ml-auto flex items-center gap-2">
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex min-h-tap items-center rounded-control border border-border-strong bg-surface px-3 text-sm font-semibold text-navy-text transition-[background-color,scale] duration-150 ease-out-strong active:scale-[0.96] lg:hidden"
              >
                Admin
              </Link>
            ) : null}
            <Suspense fallback={<NotificationMenuPending />}>
              <NotificationMenuLoader viewer={viewer} />
            </Suspense>
          </div>
        </CollapsibleMobileHeader>

        <main
          id="main"
          className="w-full flex-1 px-4 pt-6 pb-10 lg:px-9 lg:pb-14"
        >
          {children}
        </main>

        <MemberTabs />
      </div>
    </div>
  );
}

// The tray shows at least five rows, and one per unread notification up to
// the cap, so up to 20 unread all fit. Unread rows come first, newest first,
// then the latest read ones. Rows and count come back in one round trip:
// fetch the cap, then trim to what the count asks for.
async function NotificationMenuLoader({ viewer }: { viewer: Viewer }) {
  const notifications = await listNotifications(viewer, {
    pageSize: NOTIFICATION_TRAY_MAX,
    unreadFirst: true,
  });
  const preview = notifications.ok
    ? notifications.data
    : { rows: [], unread: 0 };
  const size = Math.min(NOTIFICATION_TRAY_MAX, Math.max(5, preview.unread));
  return (
    <NotificationMenu
      rows={preview.rows.slice(0, size)}
      unread={preview.unread}
    />
  );
}

function NotificationMenuPending() {
  return (
    <button
      type="button"
      aria-label="Loading notifications"
      disabled
      className="grid size-tap place-items-center rounded-control border border-border text-ink-muted"
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      />
    </button>
  );
}
