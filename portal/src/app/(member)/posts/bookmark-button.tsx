"use client";

import { useState, useTransition } from "react";
import { cx } from "@/components/ui";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { toggleBookmarkAction } from "./actions";

export type BookmarkButtonProps = {
  postId: string;
  bookmarked: boolean;
  className?: string;
};

/**
 * Optimistic bookmark toggle (star). Reverts and surfaces a quiet error when
 * the server action fails.
 */
export function BookmarkButton({
  postId,
  bookmarked,
  className,
}: BookmarkButtonProps) {
  const [saved, setSaved] = useState(bookmarked);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onToggle() {
    if (pending) return;
    const next = !saved;
    setSaved(next);
    setFailed(false);
    startTransition(async () => {
      const result = await toggleBookmarkAction(postId);
      if (!result.ok) {
        setSaved(!next);
        setFailed(true);
        return;
      }
      setSaved(result.data.bookmarked);
    });
  }

  return (
    <span className={cx("inline-flex items-center gap-1.5", className)}>
      <span role="status" className="text-xs text-danger empty:-mr-1.5">
        {failed ? "Could not save" : ""}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={saved}
        aria-label={saved ? "Remove from Saved" : "Save this post"}
        className={cx(
          "inline-flex min-h-tap cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-sm font-medium transition-[color,background-color,scale] duration-150 ease-out-strong hover:bg-surface-subtle active:scale-[0.96]",
          saved ? "text-navy-text" : "text-ink-secondary",
        )}
      >
        <BookmarkSimpleIcon
          aria-hidden="true"
          size={18}
          weight={saved ? "fill" : "regular"}
        />
        {saved ? "Saved" : "Save"}
      </button>
    </span>
  );
}
