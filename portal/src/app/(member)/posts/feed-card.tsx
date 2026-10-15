import Link from "next/link";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/ssr/CalendarPlus";
import type { FeedItem } from "@/lib/posts/queries";
import { isUpcomingEvent } from "@/lib/posts/calendar";
import { Avatar, Card, StatusBadge, TypeBadge } from "@/components/ui";
import {
  daysLeft,
  editedNote,
  formatDate,
  formatDaysLeft,
  metadataLine,
  relativeTime,
} from "./display";
import { BookmarkButton } from "./bookmark-button";
import { PostVisual } from "./post-visual";
import { LinkifiedText } from "@/components/linkified-text";

export type FeedCardProps = {
  item: FeedItem;
};

/** HOME-01 compact feed card: type, title, author, preview, meta, actions. */
export function FeedCard({ item }: FeedCardProps) {
  const meta = metadataLine(item.type, item.metadata);
  const remaining =
    item.status === "active" && item.type === "opportunity"
      ? daysLeft(item.expiresAt)
      : null;
  const upcomingEvent =
    item.type === "event" &&
    item.status !== "removed" &&
    isUpcomingEvent(item.metadata);

  return (
    <Card className="ui-feed-card grid gap-2.5">
      <PostVisual
        type={item.type}
        title={item.title}
        className="ui-feed-visual"
      />

      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={item.type} />
        {item.taggedViewer ? (
          <StatusBadge status="pending">Tagged for you</StatusBadge>
        ) : null}
        {item.status === "old" ? (
          <StatusBadge status="old">
            {item.expiresAt
              ? `Expired on ${formatDate(item.expiresAt)}`
              : "Expired"}
          </StatusBadge>
        ) : null}
        {remaining !== null ? (
          <span className="text-xs text-ink-muted">
            {formatDaysLeft(remaining)}
          </span>
        ) : null}
      </div>

      <h2 className="text-base font-semibold leading-snug">
        <Link
          href={`/posts/${item.id}`}
          className="text-ink hover:text-navy-text hover:underline active:text-navy-text active:underline"
        >
          {item.title}
        </Link>
      </h2>

      {/* Bigger author photo (council decision, 21 Sep 2026): 38px avatar
          with the name and time stacked beside it. The photo link repeats
          the name link, so it is hidden from assistive tech and tab order. */}
      <div className="flex items-center gap-2.5 text-sm text-ink-secondary">
        <Link
          href={`/people/${item.author.id}`}
          aria-hidden="true"
          tabIndex={-1}
          className="flex-none rounded-avatar"
        >
          <Avatar name={item.author.name} src={item.author.image ?? undefined} />
        </Link>
        <span className="min-w-0">
          <Link
            href={`/people/${item.author.id}`}
            className="block truncate font-medium text-ink hover:text-navy-text hover:underline active:text-navy-text active:underline"
          >
            {item.author.name}
          </Link>
          <span
            className="block text-xs text-ink-muted"
            suppressHydrationWarning
          >
            {relativeTime(item.createdAt)}
            {editedNote(item) ? ` · ${editedNote(item)}` : ""}
          </span>
        </span>
      </div>

      <p className="line-clamp-3 text-sm text-pretty text-ink-secondary">
        <LinkifiedText text={item.body} />
      </p>

      {meta ? (
        <p className="line-clamp-1 text-[0.8125rem] text-ink-muted">{meta}</p>
      ) : null}

      <div className="-mb-1.5 flex flex-wrap items-center justify-between gap-x-2 border-t border-border pt-2">
        <span className="flex flex-wrap items-center gap-x-4">
          <Link
            href={`/posts/${item.id}`}
            className="inline-flex min-h-tap items-center text-sm text-ink-secondary hover:text-navy-text hover:underline active:text-navy-text active:underline"
          >
            {item.commentCount === 1
              ? "1 comment"
              : `${item.commentCount} comments`}
          </Link>
          {/* The card is not one big link, so this sits beside the other
              links rather than inside one. It opens the post's own "Add to
              calendar" choices (Google, or an .ics file for Apple and
              Outlook): two links would crowd a phone-width card. */}
          {upcomingEvent ? (
            <Link
              href={`/posts/${item.id}#add-to-calendar`}
              className="inline-flex min-h-tap items-center gap-1.5 text-sm text-ink-secondary hover:text-navy-text hover:underline active:text-navy-text active:underline"
            >
              <CalendarPlusIcon size={16} aria-hidden="true" />
              Add to calendar
              <span className="sr-only">: {item.title}</span>
            </Link>
          ) : null}
        </span>
        <BookmarkButton
          postId={item.id}
          bookmarked={item.bookmarked}
          className="ml-auto"
        />
      </div>
    </Card>
  );
}
