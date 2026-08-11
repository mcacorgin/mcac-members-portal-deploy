"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CommentNode } from "@/lib/posts/queries";
import {
  Avatar,
  Button,
  FieldError,
  Label,
  Textarea,
  cx,
} from "@/components/ui";
import { relativeTime } from "../display";
import { addCommentAction, deleteOwnCommentAction } from "../actions";

// HOME-02 discussion thread: top-level comments with one nesting level,
// deleted placeholders, inline reply/comment forms, and a two-step
// delete-own-comment control (no browser confirm dialogs).

const ERROR_COPY: Record<string, string> = {
  section_disabled: "This section is not available.",
  not_found: "This post is no longer available.",
  unauthorized: "Your session expired. Sign in again.",
};

function actionMessage(code: string, fallback: string): string {
  return ERROR_COPY[code] ?? fallback;
}

type CommentFormProps = {
  postId: string;
  parentId?: string;
  label: string;
  submitLabel: string;
  autoFocus?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
};

function CommentForm({
  postId,
  parentId,
  label,
  submitLabel,
  autoFocus,
  onDone,
  onCancel,
}: CommentFormProps) {
  const id = useId();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Enter a comment before posting.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Comments are limited to 2000 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addCommentAction({
        postId,
        body: trimmed,
        parentId,
      });
      if (!result.ok) {
        setError(actionMessage(result.code, result.message));
        return;
      }
      setBody("");
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-1.5" noValidate>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Write a useful response"
        disabled={pending}
        autoFocus={autoFocus}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Posting..." : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

type DeleteOwnButtonProps = {
  commentId: string;
  postId: string;
};

function DeleteOwnButton({ commentId, postId }: DeleteOwnButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        {error ? <span className="text-xs text-danger">{error}</span> : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-danger"
          onClick={() => setConfirming(true)}
        >
          Delete
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteOwnCommentAction(commentId, postId);
            if (!result.ok) {
              setError(actionMessage(result.code, result.message));
              setConfirming(false);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Deleting..." : "Confirm delete"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </span>
  );
}

type CommentItemProps = {
  comment: CommentNode;
  postId: string;
  viewerId: string;
  isAdmin: boolean;
  isReply?: boolean;
};

function CommentItem({
  comment,
  postId,
  viewerId,
  isAdmin,
  isReply = false,
}: CommentItemProps) {
  const [replying, setReplying] = useState(false);
  const canDelete =
    !comment.deleted && (comment.author?.id === viewerId || isAdmin);

  return (
    <article
      className={cx(
        "grid gap-1.5",
        isReply && "ml-4 border-l-2 border-border pl-3.5 sm:ml-6",
      )}
    >
      {comment.deleted ? (
        <p className="text-sm text-ink-muted italic">Comment removed</p>
      ) : (
        <div className="flex items-start gap-2.5">
          {comment.author ? (
            <Link
              href={`/people/${comment.author.id}`}
              aria-label={`View ${comment.author.name}'s member profile`}
              className="rounded-avatar"
            >
              <Avatar
                name={comment.author.name}
                src={comment.author.image ?? undefined}
                size="md"
              />
            </Link>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              {comment.author ? (
                <Link
                  href={`/people/${comment.author.id}`}
                  className="rounded-control text-sm font-semibold text-ink hover:text-navy-text hover:underline"
                >
                  {comment.author.name}
                </Link>
              ) : null}
              <span
                className="text-xs text-ink-muted"
                suppressHydrationWarning
              >
                {relativeTime(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap text-ink-secondary">
              {comment.body}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!isReply && !comment.deleted ? (
          replying ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReplying(true)}
            >
              Reply
            </Button>
          )
        ) : null}
        {canDelete ? (
          <DeleteOwnButton commentId={comment.id} postId={postId} />
        ) : null}
      </div>
      {replying ? (
        <CommentForm
          postId={postId}
          parentId={comment.id}
          label={`Reply to ${comment.author?.name ?? "comment"}`}
          submitLabel="Post reply"
          autoFocus
          onDone={() => setReplying(false)}
          onCancel={() => setReplying(false)}
        />
      ) : null}
      {comment.replies.length > 0 ? (
        <div className="mt-1 grid gap-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              viewerId={viewerId}
              isAdmin={isAdmin}
              isReply
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export type CommentsSectionProps = {
  postId: string;
  comments: CommentNode[];
  viewerId: string;
  isAdmin: boolean;
  commentsEnabled: boolean;
};

export function CommentsSection({
  postId,
  comments,
  viewerId,
  isAdmin,
  commentsEnabled,
}: CommentsSectionProps) {
  const count = comments.reduce(
    (sum, c) => sum + 1 + c.replies.length,
    0,
  );

  return (
    <section aria-label="Discussion" className="grid gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">Discussion</h2>
        <span className="text-sm text-ink-muted">
          {count === 1 ? "1 comment" : `${count} comments`} · replies stop at
          one level
        </span>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          No comments yet. Start a focused discussion with the poster.
        </p>
      ) : (
        <div className="grid gap-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              viewerId={viewerId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {commentsEnabled ? (
        <CommentForm
          postId={postId}
          label="Add a comment"
          submitLabel="Post comment"
        />
      ) : null}
    </section>
  );
}
