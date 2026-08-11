"use client";

import { useState, useTransition } from "react";
import { cx } from "@/components/ui";
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
      {failed ? (
        <span className="text-xs text-danger">Could not save</span>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remove from Saved" : "Save this post"}
        className={cx(
          "inline-flex min-h-tap cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-sm font-medium transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed",
          saved ? "text-navy-text" : "text-ink-secondary",
        )}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {saved ? "★︎" : "☆︎"}
        </span>
        {saved ? "Saved" : "Save"}
      </button>
    </span>
  );
}
