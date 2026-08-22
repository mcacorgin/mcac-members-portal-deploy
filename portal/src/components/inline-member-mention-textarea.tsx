"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Textarea, cx } from "@/components/ui";

export type MemberMentionOption = {
  id: string;
  name: string;
  detail: string;
};

type SearchResult =
  | { ok: true; data: MemberMentionOption[] }
  | { ok: false };

type MentionTrigger = {
  start: number;
  cursor: number;
  query: string;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function OptionName({ name, query }: { name: string; query: string }) {
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

export function containsMemberMention(body: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|\\s)@${escaped}(?=\\s|[.,!?;:]|$)`,
  ).test(body);
}

export function InlineMemberMentionTextarea({
  id,
  name,
  value,
  selected,
  onChange,
  onMention,
  searchMembers,
  disabled,
  maxMentions,
  rows,
  maxLength,
  autoFocus,
  invalid,
  describedBy,
  placeholder = "Write a response. Type @ to mention someone",
}: {
  id: string;
  name?: string;
  value: string;
  selected: MemberMentionOption[];
  onChange: (value: string) => void;
  onMention: (member: MemberMentionOption, nextValue: string) => void;
  searchMembers: (query: string) => Promise<SearchResult>;
  disabled: boolean;
  maxMentions: number;
  rows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  const listboxId = `${id}-mention-listbox`;
  const statusId = `${id}-mention-status`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<MentionTrigger | null>(null);
  const [options, setOptions] = useState<MemberMentionOption[]>([]);
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
    if (selected.length >= maxMentions) {
      setOptions([]);
      setSearching(false);
      setSearchError(`You can mention up to ${maxMentions} members.`);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const result = await searchMembers(term);
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

  function selectMention(member: MemberMentionOption) {
    if (!trigger) return;
    const trailing = value.slice(trigger.cursor);
    const spacer = trailing.startsWith(" ") ? "" : " ";
    const insertion = `@${member.name}${spacer}`;
    const nextValue = value.slice(0, trigger.start) + insertion + trailing;
    const nextCursor = trigger.start + insertion.length;
    // Let the parent commit the visible token and structured recipient in one
    // callback. Keeping those updates together prevents a rapid remove/re-add
    // sequence from briefly restoring the text without its hidden ID.
    onMention(member, nextValue);
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
        name={name}
        rows={rows}
        maxLength={maxLength}
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
        placeholder={placeholder}
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
            options.map((option, index) => (
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
                    <OptionName name={option.name} query={trigger?.query ?? ""} />
                  </span>
                  {option.detail ? (
                    <span className="block truncate text-xs text-ink-muted">
                      {option.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
