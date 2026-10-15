"use client";

import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import type { NotificationRow } from "@/lib/notifications/queries";
import { presentNotification } from "@/lib/notifications/presentation";
import { cx } from "@/components/ui";
import { relativeTime } from "./format";
import {
  markShownNotificationsRead,
  openNotification,
} from "./notifications/actions";

export function NotificationMenu({
  rows,
  unread,
}: {
  rows: NotificationRow[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  // The rows the tray showed when it last opened, and whether more were
  // unread than it showed. Opening marks its unread rows read; the refresh
  // that follows drops their unread state and, with fewer unread, trims the
  // list. The open tray renders this copy, so it stays as it opened.
  const [shown, setShown] = useState<{
    rows: NotificationRow[];
    more: boolean;
  }>({ rows: [], more: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const firstControl = panelRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), a[href]",
    );
    firstControl?.focus();

    function onPointerDown(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const newCount = shown.rows.filter((row) => row.readAt === null).length;

  // Runs once per open, from the click that opens the tray: re-renders never
  // repeat it.
  function openTray() {
    const newIds = rows
      .filter((row) => row.readAt === null)
      .map((row) => row.id);
    setShown({ rows, more: unread > newIds.length });
    setOpen(true);
    if (newIds.length === 0) return;

    // Mark read by id, only the rows this tray shows: one that lands after
    // the render, or that the tray has no room for, must stay unread.
    startTransition(async () => {
      try {
        await markShownNotificationsRead(newIds);
      } catch {
        // The badge stays as it is; the next open tries again.
      }
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-controls={open ? "recent-notifications" : undefined}
        onClick={() => (open ? setOpen(false) : openTray())}
        className="relative grid size-tap cursor-pointer place-items-center rounded-control border border-border text-lg text-ink-secondary transition-[color,background-color,scale] duration-150 ease-out-strong hover:bg-surface-subtle active:scale-[0.96]"
      >
        <BellIcon aria-hidden="true" size={20} weight="regular" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-danger px-1 text-[0.6875rem] font-semibold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close notification menu"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="fixed inset-0 z-30 cursor-default bg-ink/10 sm:bg-transparent"
          />
          <div
            ref={panelRef}
            id="recent-notifications"
            role="dialog"
            aria-label="Recent notifications"
            className="ui-notification-menu fixed inset-x-3 top-[72px] z-40 max-h-[min(70vh,520px)] overflow-hidden rounded-container border border-border bg-surface shadow-[0_18px_50px_oklch(0.2_0.03_256/0.16)] sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+0.65rem)] sm:w-[390px]"
          >
            {/* No "Mark all read" here: opening the tray already marks
                what it shows, and a button that vanished a moment after
                opening would take keyboard focus with it. /notifications
                keeps one. */}
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold text-ink">Notifications</h2>
              <p className="text-xs text-ink-muted">
                {newCount > 0
                  ? shown.more
                    ? `${newCount} new, more on the notifications page`
                    : `${newCount} new`
                  : unread > 0
                    ? `${unread} unread`
                    : "You are up to date"}
              </p>
            </div>

            {shown.rows.length > 0 ? (
              <ul className="max-h-[min(52vh,390px)] list-none overflow-y-auto p-0">
                {shown.rows.map((notification) => {
                  const view = presentNotification(notification);
                  const isNew = notification.readAt === null;
                  const inner = (
                    <>
                      <span
                        aria-hidden="true"
                        className={cx(
                          "mt-1.5 size-[7px] flex-none rounded-full",
                          isNew
                            ? "bg-navy-text"
                            : "border border-border-strong bg-transparent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <strong
                          className={cx(
                            "line-clamp-2 block text-sm leading-snug text-ink",
                            isNew ? "font-semibold" : "font-medium",
                          )}
                        >
                          {view.title}
                          {isNew ? (
                            <span className="sr-only"> (new)</span>
                          ) : null}
                        </strong>
                        <small className="mt-1 block text-xs text-ink-muted">
                          {view.kind} · {relativeTime(notification.createdAt)}
                          {view.detail ? ` · ${view.detail}` : ""}
                        </small>
                      </span>
                    </>
                  );

                  return (
                    <li
                      key={notification.id}
                      className="border-b border-border last:border-b-0"
                    >
                      {view.target ? (
                        <form
                          action={openNotification.bind(
                            null,
                            notification.id,
                            view.target,
                          )}
                        >
                          <button
                            type="submit"
                            className="flex min-h-[68px] w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-surface-subtle active:bg-surface-subtle focus-visible:outline-offset-[-2px]"
                          >
                            {inner}
                            <span
                              aria-hidden="true"
                              className="mt-1 text-ink-muted"
                            >
                              <CaretRightIcon size={16} aria-hidden="true" />
                            </span>
                          </button>
                        </form>
                      ) : (
                        <div className="flex min-h-[68px] items-start gap-3 px-4 py-3">
                          {inner}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center">
                <strong className="block font-semibold text-ink">
                  No notifications yet
                </strong>
                <p className="mt-1 text-sm text-ink-secondary">
                  Tags, mentions, comments, replies, and account updates appear here.
                </p>
              </div>
            )}

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-tap items-center justify-center border-t border-border px-4 text-sm font-semibold text-navy-text hover:bg-surface-subtle active:bg-surface-subtle"
            >
              View all notifications
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
