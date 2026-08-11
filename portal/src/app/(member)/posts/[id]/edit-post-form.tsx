"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { type PostTypeName } from "@/lib/posts/types";
import {
  OPPORTUNITY_ROLE_OPTIONS,
  isMandateOpportunityMetadata,
  legacyOpportunityMetadataFromForm,
  mandateOpportunityMetadataFromForm,
  mandateOpportunityMetadataSchema,
} from "@/lib/posts/opportunity";
import {
  Button,
  Card,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { editPostAction } from "../actions";
import { OpportunityFields } from "../../share/opportunity-fields";

// HOME-02 edit control: collapsed behind "Edit post", prefilled from the
// current post, submits through editPostAction. Field markup mirrors the
// share composer's per-type inputs and ActionResult.fieldErrors rendering
// exactly, so editing feels like the same form the member already knows.

export type EditPostFormProps = {
  postId: string;
  type: PostTypeName;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
};

function str(metadata: Record<string, unknown>, key: string): string {
  const v = metadata[key];
  return typeof v === "string" ? v : "";
}

/** ISO datetime -> value usable in <input type="datetime-local">. */
function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildMetadata(
  type: PostTypeName,
  formData: FormData,
  isMandateOpportunity: boolean,
  previousMetadata: Record<string, unknown>,
):
  | { metadata: Record<string, unknown> }
  | { fieldErrors: Record<string, string[]> } {
  switch (type) {
    case "opportunity":
      return {
        metadata: isMandateOpportunity
          ? mandateOpportunityMetadataFromForm(formData)
          : legacyOpportunityMetadataFromForm(formData, previousMetadata),
      };
    case "job": {
      const industry = text(formData, "industry");
      return {
        metadata: {
          location: text(formData, "location"),
          ...(industry ? { industry } : {}),
        },
      };
    }
    case "knowledge": {
      const category = text(formData, "category");
      return { metadata: category ? { category } : {} };
    }
    case "event": {
      const raw = text(formData, "startsAt");
      const parsed = raw ? new Date(raw) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) {
        return {
          fieldErrors: {
            "metadata.startsAt": ["Enter the event date and time."],
          },
        };
      }
      return {
        metadata: {
          startsAt: parsed.toISOString(),
          location: text(formData, "location"),
          mode: text(formData, "mode"),
        },
      };
    }
  }
}

export function EditPostForm({
  postId,
  type,
  title,
  body,
  metadata,
}: EditPostFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const errFor = (key: string): string | undefined => fieldErrors[key]?.[0];
  const isMandateOpportunity =
    type === "opportunity" && isMandateOpportunityMetadata(metadata);

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Edit post
      </Button>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const built = buildMetadata(
      type,
      formData,
      isMandateOpportunity,
      metadata,
    );
    if ("fieldErrors" in built) {
      setFieldErrors(built.fieldErrors);
      setError(null);
      return;
    }
    if (isMandateOpportunity) {
      const parsed = mandateOpportunityMetadataSchema.safeParse(
        built.metadata,
      );
      if (!parsed.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const key = ["metadata", ...issue.path.map(String)].join(".");
          (errors[key] ??= []).push(issue.message);
        }
        setFieldErrors(errors);
        setError(null);
        return;
      }
    }
    setFieldErrors({});
    setError(null);
    startTransition(async () => {
      const result = await editPostAction({
        postId,
        title: text(formData, "title"),
        body: text(formData, "body"),
        metadata: built.metadata,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="grid gap-4">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormField
          label="Title (required)"
          htmlFor="edit-title"
          error={errFor("title")}
        >
          <Input
            id="edit-title"
            name="title"
            defaultValue={title}
            maxLength={160}
            disabled={pending}
            aria-invalid={errFor("title") ? "true" : undefined}
            aria-describedby={errFor("title") ? "edit-title-error" : undefined}
          />
        </FormField>

        {isMandateOpportunity ? (
          <OpportunityFields
            disabled={pending}
            fieldErrors={fieldErrors}
            metadata={metadata}
            prefix="edit"
          />
        ) : null}

        {type === "event" ? (
          <>
            <FormField
              label="Date and time (required)"
              htmlFor="edit-starts-at"
              error={errFor("metadata.startsAt")}
            >
              <Input
                id="edit-starts-at"
                name="startsAt"
                type="datetime-local"
                defaultValue={toLocalInputValue(str(metadata, "startsAt"))}
                disabled={pending}
                aria-invalid={
                  errFor("metadata.startsAt") ? "true" : undefined
                }
                aria-describedby={
                  errFor("metadata.startsAt")
                    ? "edit-starts-at-error"
                    : undefined
                }
              />
            </FormField>
            <FormField
              label="Location (required)"
              htmlFor="edit-location"
              error={errFor("metadata.location")}
            >
              <Input
                id="edit-location"
                name="location"
                defaultValue={str(metadata, "location")}
                disabled={pending}
                aria-invalid={
                  errFor("metadata.location") ? "true" : undefined
                }
                aria-describedby={
                  errFor("metadata.location")
                    ? "edit-location-error"
                    : undefined
                }
              />
            </FormField>
            <FormField
              label="Mode (required)"
              htmlFor="edit-mode"
              error={errFor("metadata.mode")}
            >
              <Select
                id="edit-mode"
                name="mode"
                defaultValue={str(metadata, "mode") || "in_person"}
                disabled={pending}
              >
                <option value="in_person">In person</option>
                <option value="virtual">Virtual</option>
              </Select>
            </FormField>
          </>
        ) : null}

        {type === "job" ? (
          <FormField
            label="Location (required)"
            htmlFor="edit-location"
            error={errFor("metadata.location")}
          >
            <Input
              id="edit-location"
              name="location"
              defaultValue={str(metadata, "location")}
              disabled={pending}
              aria-invalid={errFor("metadata.location") ? "true" : undefined}
              aria-describedby={
                errFor("metadata.location") ? "edit-location-error" : undefined
              }
            />
          </FormField>
        ) : null}

        {type === "job" || (type === "opportunity" && !isMandateOpportunity) ? (
          <FormField
            label={
              type === "opportunity"
                ? "Industry (required)"
                : "Industry (optional)"
            }
            htmlFor="edit-industry"
            error={errFor("metadata.industry")}
          >
            <Input
              id="edit-industry"
              name="industry"
              defaultValue={str(metadata, "industry")}
              disabled={pending}
              aria-invalid={errFor("metadata.industry") ? "true" : undefined}
              aria-describedby={
                errFor("metadata.industry") ? "edit-industry-error" : undefined
              }
            />
          </FormField>
        ) : null}

        {type === "opportunity" ? (
          <FormField
            label="Your role in the opportunity (required)"
            htmlFor="edit-opportunity-role"
            error={errFor("metadata.roleInOpportunity")}
          >
            <Select
              id="edit-opportunity-role"
              name="roleInOpportunity"
              defaultValue={str(metadata, "roleInOpportunity")}
              required={isMandateOpportunity}
              disabled={pending}
              aria-invalid={
                errFor("metadata.roleInOpportunity") ? "true" : undefined
              }
              aria-describedby={
                errFor("metadata.roleInOpportunity")
                  ? "edit-opportunity-role-error"
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
            htmlFor="edit-category"
            error={errFor("metadata.category")}
          >
            <Input
              id="edit-category"
              name="category"
              defaultValue={str(metadata, "category")}
              disabled={pending}
              aria-invalid={errFor("metadata.category") ? "true" : undefined}
              aria-describedby={
                errFor("metadata.category") ? "edit-category-error" : undefined
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
          htmlFor="edit-body"
          error={errFor("body")}
        >
          <Textarea
            id="edit-body"
            name="body"
            rows={6}
            maxLength={5000}
            defaultValue={body}
            disabled={pending}
            aria-invalid={errFor("body") ? "true" : undefined}
            aria-describedby={errFor("body") ? "edit-body-error" : undefined}
          />
        </FormField>

        {type === "opportunity" && !isMandateOpportunity ? (
          <FormField
            label="Action needed (required)"
            htmlFor="edit-requested-action"
            hint="What do you need from the network?"
            error={errFor("metadata.requestedAction")}
          >
            <Textarea
              id="edit-requested-action"
              name="requestedAction"
              rows={3}
              defaultValue={str(metadata, "requestedAction")}
              disabled={pending}
              aria-invalid={
                errFor("metadata.requestedAction") ? "true" : undefined
              }
              aria-describedby={
                errFor("metadata.requestedAction")
                  ? "edit-requested-action-error"
                  : undefined
              }
            />
          </FormField>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
