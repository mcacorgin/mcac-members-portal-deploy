"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

// Section sub-nav for the admin console, rendered at the top of the content
// column inside the shared PortalShell (see (admin)/layout.tsx) - not its
// own header. The wrapping border in the layout gives the underline tabs
// below a baseline to sit flush against.

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/policy", label: "Policy" },
  { href: "/admin/members", label: "Members" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    // Overview owns the queue and the application detail drill-down.
    return pathname === "/admin" || pathname.startsWith("/admin/applications");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="-mb-px overflow-x-auto">
      <ul className="flex gap-1">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-tap items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy",
                  active
                    ? "border-navy text-navy-text"
                    : "border-transparent text-ink-secondary hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
