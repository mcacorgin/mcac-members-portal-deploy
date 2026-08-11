"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { UserCircleIcon } from "@phosphor-icons/react/dist/csr/UserCircle";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { cx } from "@/components/ui";

// The frozen four-tab IA (Home · People · Share · Me) still governs the
// mobile tab bar exactly - `TAB_ITEMS` never grows. The desktop rail has more
// room, so it also carries Saved (`RAIL_ITEMS`): mobile members reach it
// instead through a link row near the top of /me. `match` prefixes drive the
// active state (e.g. /posts and /notifications live under Home, /me/edit
// lives under Me, as in the approved prototype).

type NavItem = {
  label: string;
  href: string;
  icon: Icon;
  share?: boolean;
  match: string[];
};

const HOME: NavItem = {
  label: "Home",
  href: "/home",
  icon: HouseIcon,
  match: ["/home", "/posts", "/notifications"],
};
const PEOPLE: NavItem = {
  label: "People",
  href: "/people",
  icon: UsersThreeIcon,
  match: ["/people"],
};
const SHARE: NavItem = {
  label: "Share",
  href: "/share",
  icon: PlusIcon,
  share: true,
  match: ["/share"],
};
const SAVED: NavItem = {
  label: "Saved",
  href: "/saved",
  icon: BookmarkSimpleIcon,
  match: ["/saved"],
};
const ME: NavItem = {
  label: "Me",
  href: "/me",
  icon: UserCircleIcon,
  match: ["/me"],
};

const TAB_ITEMS: NavItem[] = [HOME, PEOPLE, SHARE, ME];
// Saved sits after Share (not between People and Share): Share is the one
// emphasized primary-action pill in the rail, so grouping Home/People as
// "browse" and Saved/Me as "your stuff" around it keeps that emphasis intact
// (better-layout: group with space/purpose, not by inserting a plain item
// next to the one item styled as a call to action).
const RAIL_ITEMS: NavItem[] = [HOME, PEOPLE, SHARE, SAVED, ME];

function isActive(pathname: string, item: NavItem): boolean {
  return item.match.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Mobile (<lg) sticky bottom tab bar: four equal-width tabs. */
export function MemberTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="ui-mobile-tabs sticky bottom-0 z-10 grid grid-cols-4 border-t border-border bg-surface/95 px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
    >
      {TAB_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        const NavIcon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "ui-nav-item flex min-h-tap min-w-0 flex-col items-center justify-center gap-0.5 rounded-control p-1 text-[11px] font-medium",
              item.share
                ? "font-semibold text-navy-text"
                : active
                  ? "text-navy-text"
                  : "text-ink-muted",
            )}
          >
            {item.share ? (
              <span
                aria-hidden="true"
                className="mb-px grid size-[26px] place-items-center rounded-[8px] bg-navy text-[15px] leading-none text-white"
              >
                <NavIcon size={16} weight="bold" />
              </span>
            ) : (
              <span aria-hidden="true" className="grid size-[26px] place-items-center">
                <NavIcon size={19} weight={active ? "fill" : "regular"} />
              </span>
            )}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop (lg+) rail items: the four tab destinations plus Saved, plus
 * Administration for admins. */
export function MemberRailNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="grid gap-0.5">
      {RAIL_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        const NavIcon = item.icon;
        if (item.share) {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="ui-nav-item ui-nav-primary mt-2 flex min-h-tap items-center justify-start gap-2 rounded-control bg-navy px-2.5 text-[13.5px] font-semibold text-white hover:bg-navy-hover"
            >
              <NavIcon aria-hidden="true" size={17} weight="bold" />
              <span>{item.label}</span>
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "ui-nav-item flex min-h-tap items-center justify-start gap-2 rounded-control px-2.5 text-[13.5px] font-medium",
              active
                ? "bg-surface-sunken font-semibold text-ink"
                : "text-ink-secondary hover:bg-surface-subtle",
            )}
          >
            <NavIcon
              aria-hidden="true"
              size={17}
              weight={active ? "fill" : "regular"}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
      {isAdmin ? (
        <Link
          href="/admin"
          aria-current={
            pathname === "/admin" || pathname.startsWith("/admin/")
              ? "page"
              : undefined
          }
          className={cx(
            "ui-nav-item mt-2 flex min-h-tap items-center justify-start gap-2 rounded-control px-2.5 text-[13.5px] font-medium",
            pathname === "/admin" || pathname.startsWith("/admin/")
              ? "bg-surface-sunken font-semibold text-ink"
              : "text-ink-secondary hover:bg-surface-subtle",
          )}
        >
          <GearSixIcon aria-hidden="true" size={17} weight="regular" />
          <span>Administration</span>
        </Link>
      ) : null}
    </nav>
  );
}
