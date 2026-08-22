import { requireViewer } from "@/lib/auth";
import {
  listNotifications,
} from "@/lib/notifications/queries";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  ScreenId,
  cx,
} from "@/components/ui";
import { relativeTime } from "../format";
import { dismissNotification, markAllRead, openNotification } from "./actions";
import { presentNotification } from "@/lib/notifications/presentation";

// HOME-03: in-app notifications. Tapping a tagged/mention/comment/reply row marks it
// read and follows it to /posts/[postId] (that page may ship from another
// lane); account_status rows follow to /me. Each row also has a dismiss (×)
// button that deletes it for good. HTML forbids nested forms, so the dismiss
// form is a sibling of the open-notification form, not nested inside it. All
// of it submits server actions, so the flow works without client JS.

export const metadata = { title: "Notifications · MCAC Members Portal" };

const PAGE_SIZE = 20;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const sp = await searchParams;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "", 10) || 1);

  const viewer = await requireViewer();
  const res = await listNotifications(viewer, { page, pageSize: PAGE_SIZE });

  if (!res.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ScreenId id="HOME-03" className="mb-2" />
        <PageHeader title="Notifications" />
        <ErrorState
          title="Notifications could not load"
          body={res.message}
          action={
            <Button href="/notifications" variant="secondary">
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const { rows, unread } = res.data;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ScreenId id="HOME-03" className="mb-2" />
      <PageHeader
        title="Notifications"
        description="Your own tags, mentions, comments, replies, and account updates."
        action={
          unread > 0 ? (
            <form action={markAllRead}>
              <Button type="submit" variant="secondary" size="sm">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      {rows.length === 0 && page === 1 ? (
        <EmptyState
          glyph="✓"
          title="No notifications yet"
          body="Tags, mentions, comments, replies, and account updates will appear here."
          action={
            <Button href="/people" variant="secondary">
              Find People
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid list-none overflow-hidden rounded-container border border-border bg-surface p-0">
            {rows.map((n) => {
              const view = presentNotification(n);
              const isUnread = n.readAt === null;
              const meta = `${view.kind} · ${relativeTime(n.createdAt)}`;
              const inner = (
                <>
                  <span
                    aria-hidden="true"
                    className={cx(
                      "size-[7px] flex-none rounded-full",
                      isUnread
                        ? "bg-navy-text"
                        : "border border-border-strong bg-transparent",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <strong
                      className={cx(
                        "block text-ink",
                        isUnread ? "font-semibold" : "font-medium",
                      )}
                    >
                      {view.title}
                      {isUnread ? (
                        <span className="sr-only"> (unread)</span>
                      ) : null}
                    </strong>
                    <small className="mt-0.5 block text-[13px] text-ink-muted">
                      {meta}
                      {view.detail ? ` · ${view.detail}` : ""}
                    </small>
                  </span>
                </>
              );
              return (
                <li
                  key={n.id}
                  className="flex items-stretch border-t border-border first:border-t-0"
                >
                  {view.target ? (
                    <form
                      action={openNotification.bind(null, n.id, view.target)}
                      className="min-w-0 flex-1"
                    >
                      <button
                        type="submit"
                        className="flex min-h-[64px] w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-subtle"
                      >
                        {inner}
                        <span aria-hidden="true" className="text-ink-muted">
                          ›
                        </span>
                      </button>
                    </form>
                  ) : (
                    <div className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 px-3.5 py-3">
                      {inner}
                    </div>
                  )}
                  <form
                    action={dismissNotification.bind(null, n.id)}
                    className="flex flex-none items-center"
                  >
                    <button
                      type="submit"
                      aria-label="Dismiss notification"
                      className="flex size-tap cursor-pointer items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink"
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        ×
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
            {rows.length === 0 ? (
              <li className="px-3.5 py-4 text-ink-secondary">
                No earlier notifications on this page.
              </li>
            ) : null}
          </ul>

          <div className="mt-3.5 flex items-center justify-between gap-2.5 py-2 text-xs text-ink-muted">
            <span>Page {page}</span>
            <span className="flex gap-2">
              {page > 1 ? (
                <Button
                  href={page === 2 ? "/notifications" : `/notifications?page=${page - 1}`}
                  variant="secondary"
                  size="sm"
                >
                  Newer
                </Button>
              ) : null}
              {rows.length === PAGE_SIZE ? (
                <Button
                  href={`/notifications?page=${page + 1}`}
                  variant="secondary"
                  size="sm"
                >
                  Load earlier
                </Button>
              ) : (
                <span className="inline-flex min-h-tap items-center">
                  End of notifications
                </span>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
