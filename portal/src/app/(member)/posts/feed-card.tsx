import Link from "next/link";
import type { FeedItem } from "@/lib/posts/queries";
import { Avatar, Card, StatusBadge, TypeBadge } from "@/components/ui";
import {
  daysLeft,
  editedNote,
  formatDate,
  metadataLine,
  relativeTime,
} from "./display";
import { BookmarkButton } from "./bookmark-button";
import { PostVisual } from "./post-visual";

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
              ? `Old · expired ${formatDate(item.expiresAt)}`
              : "Old"}
          </StatusBadge>
        ) : null}
        {remaining !== null ? (
          <span className="text-xs text-ink-muted">{remaining}d left</span>
        ) : null}
      </div>

      <h3 className="text-base font-semibold leading-snug">
        <Link
          href={`/posts/${item.id}`}
          className="text-ink hover:text-navy-text hover:underline"
        >
          {item.title}
        </Link>
      </h3>

      <div className="flex items-center gap-2 text-sm text-ink-secondary">
        <Link
          href={`/people/${item.author.id}`}
          className="flex min-w-0 items-center gap-2 rounded-control hover:text-navy-text hover:underline"
        >
          <Avatar
            name={item.author.name}
            src={item.author.image ?? undefined}
            className="size-[26px]! text-[10px]!"
          />
          <span className="truncate">{item.author.name}</span>
        </Link>
        <span aria-hidden="true">·</span>
        <span
          className="flex-none text-ink-muted"
          suppressHydrationWarning
        >
          {relativeTime(item.createdAt)}
        </span>
        {editedNote(item) ? (
          <span className="flex-none text-xs text-ink-muted">
            · {editedNote(item)}
          </span>
        ) : null}
      </div>

      <p className="line-clamp-3 text-sm text-pretty text-ink-secondary">
        {item.body}
      </p>

      {meta ? (
        <p className="line-clamp-1 text-[13px] text-ink-muted">{meta}</p>
      ) : null}

      <div className="-mb-1.5 flex items-center justify-between gap-2 border-t border-border pt-2">
        <Link
          href={`/posts/${item.id}`}
          className="inline-flex min-h-tap items-center text-sm text-ink-secondary hover:text-navy-text hover:underline"
        >
          {item.commentCount === 1
            ? "1 comment"
            : `${item.commentCount} comments`}
        </Link>
        <BookmarkButton postId={item.id} bookmarked={item.bookmarked} />
      </div>
    </Card>
  );
}
