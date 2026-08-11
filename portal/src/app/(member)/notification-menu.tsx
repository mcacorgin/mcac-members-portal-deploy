"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import type { NotificationRow } from "@/lib/notifications/queries";
import { presentNotification } from "@/lib/notifications/presentation";
import { cx } from "@/components/ui";
import { relativeTime } from "./format";
import { markAllRead, openNotification } from "./notifications/actions";

export function NotificationMenu({
  rows,
  unread,
}: {
  rows: NotificationRow[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-controls="recent-notifications"
        onClick={() => setOpen((current) => !current)}
        className="relative grid size-tap cursor-pointer place-items-center rounded-control border border-border text-lg text-ink-secondary hover:bg-surface-subtle"
      >
        <BellIcon aria-hidden="true" size={20} weight="regular" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] font-semibold text-white"
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
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="font-semibold text-ink">Notifications</h2>
                <p className="text-xs text-ink-muted">
                  {unread > 0
                    ? `${unread} unread`
                    : "You are up to date"}
                </p>
              </div>
              {unread > 0 ? (
                <form action={markAllRead}>
                  <button
                    type="submit"
                    className="min-h-tap cursor-pointer rounded-control px-2 text-sm font-medium text-navy-text hover:bg-surface-subtle"
                  >
                    Mark all read
                  </button>
                </form>
              ) : null}
            </div>

            {rows.length > 0 ? (
              <ul className="max-h-[min(52vh,390px)] list-none overflow-y-auto p-0">
                {rows.map((notification) => {
                  const view = presentNotification(notification);
                  const isUnread = notification.readAt === null;
                  const inner = (
                    <>
                      <span
                        aria-hidden="true"
                        className={cx(
                          "mt-1.5 size-[7px] flex-none rounded-full",
                          isUnread
                            ? "bg-navy-text"
                            : "border border-border-strong bg-transparent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <strong
                          className={cx(
                            "line-clamp-2 block text-sm leading-snug text-ink",
                            isUnread ? "font-semibold" : "font-medium",
                          )}
                        >
                          {view.title}
                          {isUnread ? (
                            <span className="sr-only"> (unread)</span>
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
                            className="flex min-h-[68px] w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-surface-subtle"
                          >
                            {inner}
                            <span
                              aria-hidden="true"
                              className="mt-1 text-ink-muted"
                            >
                              ›
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
                  Tags, comments, replies, and account updates appear here.
                </p>
              </div>
            )}

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-tap items-center justify-center border-t border-border px-4 text-sm font-semibold text-navy-text hover:bg-surface-subtle"
            >
              View all notifications
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
