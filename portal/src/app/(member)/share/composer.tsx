"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { type PostTypeName } from "@/lib/posts/types";
import {
  OPPORTUNITY_ROLE_OPTIONS,
  mandateOpportunityMetadataFromForm,
  mandateOpportunityMetadataSchema,
} from "@/lib/posts/opportunity";
import { OpportunityFields } from "./opportunity-fields";
import {
  Button,
  FieldError,
  FormField,
  Input,
  Select,
  Tag,
  Textarea,
  cx,
} from "@/components/ui";
import { TYPE_LABELS, formatBytes } from "../posts/display";
import { publishShareAction, searchMembersAction } from "./actions";
import { SHARE_IDLE, type MemberOption, type ShareFormState } from "./form-state";

// SHARE-01 composer: neutral type choice, per-type fields, member tagging,
// optional attachment. Submits through publishShareAction (createPost first,
// then saveAttachment, then redirect to the new post).

export type ComposerProps = {
  enabledTypes: PostTypeName[];
  acceptMimes: string[];
  maxBytes: number;
};

const MAX_TAGGED = 20;

function mandateFieldErrors(formData: FormData): Record<string, string[]> {
  const parsed = mandateOpportunityMetadataSchema.safeParse(
    mandateOpportunityMetadataFromForm(formData),
  );
  if (parsed.success) return {};
  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = ["metadata", ...issue.path.map(String)].join(".");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

function TagPicker({
  selected,
  onChange,
  disabled,
}: {
  selected: MemberOption[];
  onChange: (next: MemberOption[]) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MemberOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any in-flight debounce timer on unmount.
  useEffect(
    () => () => {
      requestSeq.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function onQueryChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = value.trim();
    const seq = ++requestSeq.current;
    if (!term) {
      setOptions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const result = await searchMembersAction(term);
      if (seq !== requestSeq.current) return;
      setSearching(false);
      if (!result.ok) {
        setError("Member search is unavailable right now.");
        setOptions([]);
        return;
      }
      setError(null);
      setOptions(result.data);
    }, 250);
  }

  const selectedIds = new Set(selected.map((m) => m.id));
  const atLimit = selected.length >= MAX_TAGGED;

  return (
    <div className="grid gap-1.5">
      <FormField
        label="Tag relevant members (optional)"
        htmlFor="share-tag-search"
        hint={
          atLimit
            ? `Limit of ${MAX_TAGGED} tagged members reached.`
            : "Tagged members get an in-app notification and a queued email."
        }
        error={error}
      >
        <Input
          id="share-tag-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search members by name, city, or company"
          disabled={disabled || atLimit}
          autoComplete="off"
        />
      </FormField>

      {query.trim() && !atLimit ? (
        <ul
          className="grid max-h-60 gap-0.5 overflow-y-auto rounded-container border border-border bg-surface p-1"
          aria-label="Member results"
        >
          {searching && options.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-muted">Searching...</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-muted">
              No members match this search.
            </li>
          ) : (
            options.map((option) => {
              const added = selectedIds.has(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={added || disabled}
                    onClick={() => {
                      onChange([...selected, option]);
                      setQuery("");
                      setOptions([]);
                    }}
                    className={cx(
                      "flex min-h-tap w-full cursor-pointer items-center justify-between gap-2 rounded-control px-3 py-1.5 text-left hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {option.name}
                      </span>
                      {option.detail ? (
                        <span className="block truncate text-xs text-ink-muted">
                          {option.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex-none text-xs text-ink-muted">
                      {added ? "Added" : "Add"}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Tagged members">
          {selected.map((member) => (
            <Tag key={member.id} selected className="gap-1.5 py-1">
              {member.name}
              <button
                type="button"
                onClick={() =>
                  onChange(selected.filter((m) => m.id !== member.id))
                }
                disabled={disabled}
                aria-label={`Remove ${member.name}`}
                className="relative grid size-5 cursor-pointer place-items-center rounded-full after:absolute after:-inset-3 hover:bg-navy/10"
              >
                <span aria-hidden="true">×</span>
              </button>
            </Tag>
          ))}
        </div>
      ) : null}

      {selected.map((member) => (
        <input
          key={member.id}
          type="hidden"
          name="taggedUserIds"
          value={member.id}
        />
      ))}
    </div>
  );
}

export function Composer({ enabledTypes, acceptMimes, maxBytes }: ComposerProps) {
  const [state, dispatch, pending] = useActionState<ShareFormState, FormData>(
    publishShareAction,
    SHARE_IDLE,
  );
  const [type, setType] = useState<PostTypeName | "">("");
  const [tagged, setTagged] = useState<MemberOption[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [clientFieldErrors, setClientFieldErrors] = useState<
    Record<string, string[]>
  >({});

  const fieldErrors = {
    ...(state.status === "error" ? (state.fieldErrors ?? {}) : {}),
    ...clientFieldErrors,
  };
  const errFor = (key: string): string | undefined => fieldErrors[key]?.[0];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fileError) return;
    const formData = new FormData(event.currentTarget);
    if (type === "opportunity") {
      const errors = mandateFieldErrors(formData);
      if (Object.keys(errors).length > 0) {
        setClientFieldErrors(errors);
        return;
      }
    }
    setClientFieldErrors({});
    startTransition(() => dispatch(formData));
  }

  const attachmentError = fileError ?? errFor("attachment");

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 block text-[13px] font-medium text-ink">
          What are you sharing?
        </legend>
        <div className="flex flex-wrap gap-2">
          {enabledTypes.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              disabled={pending}
              className={cx(
                "inline-flex min-h-tap cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                type === t
                  ? "border-navy bg-navy text-white"
                  : "border-border-strong bg-surface text-ink-secondary hover:bg-surface-subtle",
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <small className="text-xs text-ink-muted">
          Nothing is preselected. Only sections enabled for you are shown.
        </small>
        <FieldError>{errFor("type")}</FieldError>
        {type ? <input type="hidden" name="type" value={type} /> : null}
      </fieldset>

      {type ? (
        <>
          <FormField
            label="Title (required)"
            htmlFor="share-title"
            error={errFor("title")}
          >
            <Input
              id="share-title"
              name="title"
              maxLength={160}
              disabled={pending}
              aria-invalid={errFor("title") ? "true" : undefined}
              aria-describedby={errFor("title") ? "share-title-error" : undefined}
            />
          </FormField>

          {type === "opportunity" ? (
            <OpportunityFields
              disabled={pending}
              fieldErrors={fieldErrors}
              prefix="share"
            />
          ) : null}

          {type === "event" ? (
            <>
              <FormField
                label="Date and time (required)"
                htmlFor="share-starts-at"
                error={errFor("metadata.startsAt")}
              >
                <Input
                  id="share-starts-at"
                  name="startsAt"
                  type="datetime-local"
                  disabled={pending}
                  aria-invalid={
                    errFor("metadata.startsAt") ? "true" : undefined
                  }
                  aria-describedby={
                    errFor("metadata.startsAt")
                      ? "share-starts-at-error"
                      : undefined
                  }
                />
              </FormField>
              <FormField
                label="Location (required)"
                htmlFor="share-location"
                error={errFor("metadata.location")}
              >
                <Input
                  id="share-location"
                  name="location"
                  disabled={pending}
                  aria-invalid={
                    errFor("metadata.location") ? "true" : undefined
                  }
                  aria-describedby={
                    errFor("metadata.location")
                      ? "share-location-error"
                      : undefined
                  }
                />
              </FormField>
              <FormField
                label="Mode (required)"
                htmlFor="share-mode"
                error={errFor("metadata.mode")}
              >
                <Select id="share-mode" name="mode" disabled={pending}>
                  <option value="in_person">In person</option>
                  <option value="virtual">Virtual</option>
                </Select>
              </FormField>
            </>
          ) : null}

          {type === "job" ? (
            <FormField
              label="Location (required)"
              htmlFor="share-location"
              error={errFor("metadata.location")}
            >
              <Input
                id="share-location"
                name="location"
                disabled={pending}
                aria-invalid={errFor("metadata.location") ? "true" : undefined}
                aria-describedby={
                  errFor("metadata.location")
                    ? "share-location-error"
                    : undefined
                }
              />
            </FormField>
          ) : null}

          {type === "job" ? (
            <FormField
              label="Industry (optional)"
              htmlFor="share-industry"
              error={errFor("metadata.industry")}
            >
              <Input
                id="share-industry"
                name="industry"
                disabled={pending}
                aria-invalid={errFor("metadata.industry") ? "true" : undefined}
                aria-describedby={
                  errFor("metadata.industry")
                    ? "share-industry-error"
                    : undefined
                }
              />
            </FormField>
          ) : null}

          {type === "opportunity" ? (
            <FormField
              label="Your role in the opportunity (required)"
              htmlFor="share-opportunity-role"
              error={errFor("metadata.roleInOpportunity")}
            >
              <Select
                id="share-opportunity-role"
                name="roleInOpportunity"
                defaultValue=""
                required
                disabled={pending}
                aria-invalid={
                  errFor("metadata.roleInOpportunity") ? "true" : undefined
                }
                aria-describedby={
                  errFor("metadata.roleInOpportunity")
                    ? "share-opportunity-role-error"
                    : undefined
                }
              >
                <option value="" disabled>
                  Select your role
                </option>
                {OPPORTUNITY_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {type === "knowledge" ? (
            <FormField
              label="Category (optional)"
              htmlFor="share-category"
              error={errFor("metadata.category")}
            >
              <Input
                id="share-category"
                name="category"
                disabled={pending}
                aria-invalid={errFor("metadata.category") ? "true" : undefined}
                aria-describedby={
                  errFor("metadata.category")
                    ? "share-category-error"
                    : undefined
                }
              />
            </FormField>
          ) : null}

          <FormField
            label={
              type === "opportunity"
                ? "Brief (required)"
                : type === "job"
                  ? "Description (required)"
                  : type === "knowledge"
                    ? "Content (required)"
                    : "Description (required)"
            }
            htmlFor="share-body"
            error={errFor("body")}
          >
            <Textarea
              id="share-body"
              name="body"
              rows={6}
              maxLength={5000}
              disabled={pending}
              aria-invalid={errFor("body") ? "true" : undefined}
              aria-describedby={errFor("body") ? "share-body-error" : undefined}
            />
          </FormField>

          <TagPicker selected={tagged} onChange={setTagged} disabled={pending} />
          <FieldError>{errFor("taggedUserIds")}</FieldError>

          <FormField
            label="Attachment (optional)"
            htmlFor="share-attachment"
            hint={`PDF, PNG, JPEG, WebP, XLSX, or DOCX · up to ${formatBytes(maxBytes)}.`}
            error={attachmentError}
          >
            <input
              id="share-attachment"
              name="attachment"
              type="file"
              accept={acceptMimes.join(",")}
              disabled={pending}
              aria-invalid={attachmentError ? "true" : undefined}
              aria-describedby={
                attachmentError ? "share-attachment-error" : undefined
              }
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && file.size > maxBytes) {
                  setFileError(
                    `This file is ${formatBytes(file.size)}. Attachments are limited to ${formatBytes(maxBytes)}.`,
                  );
                  e.target.value = "";
                  return;
                }
                setFileError(null);
              }}
              className="block w-full min-h-tap cursor-pointer rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-surface-subtle file:px-3 file:py-1.5 file:font-medium"
            />
          </FormField>
        </>
      ) : (
        <p className="rounded-container border border-border bg-surface px-4 py-5 text-sm text-ink-secondary">
          Choose a type to continue. Nothing is silently preselected.
        </p>
      )}

      {state.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.code === "section_disabled"
            ? "This share type is not available for your account. Choose another type."
            : state.message}
        </p>
      ) : null}

      {state.status === "attachment_failed" ? (
        <p role="alert" className="text-sm font-medium text-warning">
          {state.message}{" "}
          <a
            href={`/posts/${state.postId}`}
            className="font-semibold underline"
          >
            View the published post
          </a>
        </p>
      ) : null}

      <div className="grid gap-2">
        <Button type="submit" disabled={pending || !type} size="lg">
          {pending ? "Publishing..." : "Publish"}
        </Button>
        <small className="text-xs text-ink-muted">
          Phase 1 boundary: payment collection, automated WhatsApp messages,
          and AI-assisted tagging are not part of sharing.
        </small>
      </div>
    </form>
  );
}
