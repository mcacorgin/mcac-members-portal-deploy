"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CommentMentionOption,
  CommentNode,
} from "@/lib/posts/queries";
import {
  Avatar,
  Button,
  FieldError,
  Label,
  Textarea,
  cx,
} from "@/components/ui";
import { relativeTime } from "../display";
import {
  addCommentAction,
  deleteOwnCommentAction,
  editOwnCommentAction,
  searchCommentMentionMembersAction,
} from "../actions";

// HOME-02 discussion thread: top-level comments with one nesting level,
// deleted placeholders, inline reply/comment forms, a two-step
// delete-own-comment control, and an edit-own-comment control (no browser
// confirm dialogs). Editing is only offered while a comment has no replies -
// the server enforces the same rule regardless of what the UI shows.

const ERROR_COPY: Record<string, string> = {
  section_disabled: "This section is not available.",
  not_found: "This post is no longer available.",
  unauthorized: "Your session expired. Sign in again.",
};

const MAX_MENTIONS = 10;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function MentionOptionName({ name, query }: { name: string; query: string }) {
  const term = query.trim();
  const matchStart = name.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
  if (!term || matchStart < 0) return <>{name}</>;
  const matchEnd = matchStart + term.length;
  return (
    <>
      {name.slice(0, matchStart)}
      <mark className="bg-transparent font-bold text-navy-text">
        {name.slice(matchStart, matchEnd)}
      </mark>
      {name.slice(matchEnd)}
    </>
  );
}

function CommentBody({ comment }: { comment: CommentNode }) {
  if (!comment.body || comment.mentionedMembers.length === 0) {
    return <>{comment.body}</>;
  }

  const members = [...comment.mentionedMembers].sort(
    (a, b) => b.name.length - a.name.length,
  );
  const memberByToken = new Map(
    members.map((member) => [`@${member.name}`, member]),
  );
  const pattern = new RegExp(
    `(${members.map((member) => escapeRegex(`@${member.name}`)).join("|")})`,
    "g",
  );
  const parts: ReactNode[] = comment.body.split(pattern).map((part, index) => {
    const member = memberByToken.get(part);
    return member ? (
      <Link
        key={`${member.id}-${index}`}
        href={`/people/${member.id}`}
        className="rounded-control font-medium text-navy-text hover:underline"
      >
        {part}
      </Link>
    ) : (
      part
    );
  });
  return <>{parts}</>;
}

function containsMention(body: string, name: string): boolean {
  return new RegExp(
    `(?:^|\\s)@${escapeRegex(name)}(?=\\s|[.,!?;:]|$)`,
  ).test(body);
}

type MentionTrigger = {
  start: number;
  cursor: number;
  query: string;
};

function InlineMentionTextarea({
  id,
  value,
  selected,
  onChange,
  onMention,
  disabled,
  autoFocus,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  selected: CommentMentionOption[];
  onChange: (value: string) => void;
  onMention: (member: CommentMentionOption) => void;
  disabled: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listboxId = `${id}-mention-listbox`;
  const statusId = `${id}-mention-status`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<MentionTrigger | null>(null);
  const [options, setOptions] = useState<CommentMentionOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIds = new Set(selected.map((member) => member.id));
  const open = trigger !== null;
  const showMenu = open && Boolean(trigger?.query.trim());

  useEffect(
    () => () => {
      requestSeq.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function closeMenu() {
    requestSeq.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    setTrigger(null);
    setOptions([]);
    setSearching(false);
    setSearchError(null);
    setActiveIndex(0);
  }

  function search(query: string) {
    setSearchError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = query.trim();
    const seq = ++requestSeq.current;
    if (!term) {
      setOptions([]);
      setSearching(false);
      return;
    }
    if (selected.length >= MAX_MENTIONS) {
      setOptions([]);
      setSearching(false);
      setSearchError(`You can mention up to ${MAX_MENTIONS} members.`);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const result = await searchCommentMentionMembersAction(term);
      if (seq !== requestSeq.current) return;
      setSearching(false);
      if (!result.ok) {
        setSearchError("Member search is unavailable right now.");
        setOptions([]);
        return;
      }
      setOptions(result.data.filter((member) => !selectedIds.has(member.id)));
      setActiveIndex(0);
    }, 200);
  }

  function updateTrigger(nextValue: string, cursor: number) {
    const at = cursor - 1;
    if (
      at >= 0 &&
      nextValue[at] === "@" &&
      (at === 0 || /\s/.test(nextValue[at - 1] ?? ""))
    ) {
      setTrigger({ start: at, cursor, query: "" });
      search("");
      return;
    }
    if (!trigger) return;

    const query = nextValue.slice(trigger.start + 1, cursor);
    if (
      cursor <= trigger.start ||
      query.includes("@") ||
      query.includes("\n") ||
      /[()[\]{}]/.test(query) ||
      /\s{2,}/.test(query) ||
      query.length > 80
    ) {
      closeMenu();
      return;
    }
    setTrigger({ ...trigger, cursor, query });
    search(query);
  }

  function selectMention(member: CommentMentionOption) {
    if (!trigger) return;
    const trailing = value.slice(trigger.cursor);
    const spacer = trailing.startsWith(" ") ? "" : " ";
    const insertion = `@${member.name}${spacer}`;
    const nextValue =
      value.slice(0, trigger.start) + insertion + trailing;
    const nextCursor = trigger.start + insertion.length;
    onChange(nextValue);
    onMention(member);
    closeMenu();
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + options.length) % options.length,
      );
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      selectMention(options[activeIndex]);
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        id={id}
        aria-haspopup="listbox"
        aria-controls={showMenu ? listboxId : undefined}
        aria-activedescendant={
          showMenu && options[activeIndex]
            ? `${listboxId}-${options[activeIndex].id}`
            : undefined
        }
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={
          [describedBy, open ? statusId : undefined].filter(Boolean).join(" ") ||
          undefined
        }
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          const cursor = event.currentTarget.selectionStart;
          onChange(nextValue);
          updateTrigger(nextValue, cursor);
        }}
        onKeyDown={onKeyDown}
        onBlur={closeMenu}
        placeholder="Write a response. Type @ to mention someone"
        autoComplete="off"
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <span id={statusId} className="sr-only" aria-live="polite">
        {searching
          ? "Searching members"
          : searchError ??
            (open && trigger?.query.trim()
              ? `${options.length} members found`
              : open
                ? "Type a member name"
                : "")}
      </span>
      {showMenu ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 bottom-full z-30 mb-2 grid max-h-[min(14rem,40vh)] gap-0.5 overflow-y-auto rounded-container border border-border bg-surface p-1 shadow-card sm:right-auto sm:w-[min(28rem,100%)] lg:bottom-auto lg:top-full lg:mb-0 lg:mt-2"
          aria-label="Member mention results"
        >
          {searching && options.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-ink-muted">
              Searching...
            </li>
          ) : searchError ? (
            <li role="presentation" className="px-3 py-2 text-sm text-danger">
              {searchError}
            </li>
          ) : options.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-ink-muted">
              No approved members match this search.
            </li>
          ) : (
            options.map((option, index) => {
              return (
                <li
                  key={option.id}
                  id={`${listboxId}-${option.id}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectMention(option)}
                  className={cx(
                    "flex min-h-tap w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left",
                    index === activeIndex
                      ? "bg-surface-subtle"
                      : "hover:bg-surface-subtle",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-8 flex-none place-items-center rounded-avatar bg-navy text-[10px] font-semibold tracking-[0.02em] text-white"
                  >
                    {initialsOf(option.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      <MentionOptionName
                        name={option.name}
                        query={trigger?.query ?? ""}
                      />
                    </span>
                    {option.detail ? (
                      <span className="block truncate text-xs text-ink-muted">
                        {option.detail}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

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
  const [mentionedMembers, setMentionedMembers] = useState<
    CommentMentionOption[]
  >([]);
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
        mentionedUserIds: mentionedMembers.map((member) => member.id),
      });
      if (!result.ok) {
        setError(actionMessage(result.code, result.message));
        return;
      }
      setBody("");
      setMentionedMembers([]);
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-1.5" noValidate>
      <Label htmlFor={id}>{label}</Label>
      <InlineMentionTextarea
        id={id}
        value={body}
        onChange={(nextBody) => {
          setBody(nextBody);
          setMentionedMembers((members) =>
            members.filter((member) => containsMention(nextBody, member.name)),
          );
          if (error) setError(null);
        }}
        selected={mentionedMembers}
        onMention={(member) =>
          setMentionedMembers((members) =>
            members.some((item) => item.id === member.id)
              ? members
              : [...members, member],
          )
        }
        disabled={pending}
        autoFocus={autoFocus}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : undefined}
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

type EditCommentFormProps = {
  postId: string;
  commentId: string;
  initialBody: string;
  onDone: () => void;
  onCancel: () => void;
};

function EditCommentForm({
  postId,
  commentId,
  initialBody,
  onDone,
  onCancel,
}: EditCommentFormProps) {
  const id = useId();
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Enter a comment before saving.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Comments are limited to 2000 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await editOwnCommentAction({
        commentId,
        postId,
        body: trimmed,
      });
      if (!result.ok) {
        setError(actionMessage(result.code, result.message));
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-1.5" noValidate>
      <Label htmlFor={id}>Edit comment</Label>
      <Textarea
        id={id}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (error) setError(null);
        }}
        disabled={pending}
        autoFocus
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
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
  const [editing, setEditing] = useState(false);
  const canDelete =
    !comment.deleted && (comment.author?.id === viewerId || isAdmin);
  // Author-of-comment only, and only while it has no replies. No admin
  // override: this is strictly the comment's own author.
  const canEdit =
    !comment.deleted &&
    comment.author?.id === viewerId &&
    comment.replies.length === 0;

  return (
    <article
      id={`comment-${comment.id}`}
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
              {comment.editedAt ? (
                <span
                  className="text-xs text-ink-muted"
                  suppressHydrationWarning
                >
                  · Edited {relativeTime(comment.editedAt)}
                </span>
              ) : null}
            </div>
            {editing ? (
              <EditCommentForm
                postId={postId}
                commentId={comment.id}
                initialBody={comment.body ?? ""}
                onDone={() => setEditing(false)}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap text-ink-secondary">
                <CommentBody comment={comment} />
              </p>
            )}
          </div>
        </div>
      )}
      {editing ? null : (
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
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <DeleteOwnButton commentId={comment.id} postId={postId} />
          ) : null}
        </div>
      )}
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
