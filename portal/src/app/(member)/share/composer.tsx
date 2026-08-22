"use client";

import {
  startTransition,
  useActionState,
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
  cx,
} from "@/components/ui";
import {
  containsMemberMention,
  InlineMemberMentionTextarea,
} from "@/components/inline-member-mention-textarea";
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

const PUBLISHING_LABELS: Record<PostTypeName, string> = {
  opportunity: "Publishing opportunity…",
  job: "Publishing job…",
  knowledge: "Publishing knowledge post…",
  event: "Publishing event…",
};

function SubmissionMask({ type }: { type: PostTypeName | "" }) {
  const label = type ? PUBLISHING_LABELS[type] : "Publishing post…";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="share-processing-mask"
      className="fixed inset-0 z-50 grid place-items-center bg-navy/35 px-4"
    >
      <div className="grid w-full max-w-sm justify-items-center gap-3 rounded-container border border-border bg-surface px-5 py-6 text-center shadow-[0_18px_55px_oklch(0.2_0.03_256/0.22)]">
        <span
          aria-hidden="true"
          className="size-7 animate-spin rounded-full border-[3px] border-navy/20 border-r-navy motion-reduce:animate-none"
        />
        <div>
          <p className="font-semibold text-ink">{label}</p>
          <p className="mt-1 text-sm text-ink-secondary">
            Keep this page open while MCAC saves your post and any attachment.
          </p>
        </div>
      </div>
    </div>
  );
}

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

export function Composer({ enabledTypes, acceptMimes, maxBytes }: ComposerProps) {
  const [state, dispatch, pending] = useActionState<ShareFormState, FormData>(
    publishShareAction,
    SHARE_IDLE,
  );
  const [type, setType] = useState<PostTypeName | "">("");
  const [body, setBody] = useState("");
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
    <form
      onSubmit={onSubmit}
      className="grid gap-5"
      aria-busy={pending}
      noValidate
    >
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
          Select a type to see the right fields.
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
            hint="Type @ and a member's name to tag them. Tagged members receive a notification."
            error={errFor("body")}
          >
            <InlineMemberMentionTextarea
              id="share-body"
              name="body"
              value={body}
              selected={tagged}
              onChange={(nextBody) => {
                setBody(nextBody);
                setTagged((members) =>
                  members.filter((member) =>
                    containsMemberMention(nextBody, member.name),
                  ),
                );
              }}
              onMention={(member, nextBody) => {
                setBody(nextBody);
                setTagged((members) =>
                  members.some((item) => item.id === member.id)
                    ? members
                    : [...members, member]
                );
              }}
              searchMembers={searchMembersAction}
              maxMentions={MAX_TAGGED}
              rows={6}
              maxLength={5000}
              disabled={pending}
              invalid={Boolean(errFor("body"))}
              describedBy={errFor("body") ? "share-body-error" : undefined}
              placeholder="Write your post. Type @ to tag a member"
            />
          </FormField>

          {tagged.map((member) => (
            <input
              key={member.id}
              type="hidden"
              name="taggedUserIds"
              value={member.id}
            />
          ))}
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
          Choose what you want to share to continue.
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

      <div>
        <Button type="submit" disabled={pending || !type} size="lg">
          {pending ? "Publishing…" : "Publish"}
        </Button>
      </div>

      {pending ? <SubmissionMask type={type} /> : null}
    </form>
  );
}
