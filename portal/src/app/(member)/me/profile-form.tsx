"use client";

import { useActionState } from "react";
import {
  Button,
  FieldError,
  FormField,
  Input,
  Textarea,
  cx,
} from "@/components/ui";
import type { ActionResult } from "@/lib/contracts/result";
import { saveProfile } from "./actions";

// HOME-04 profile editor. Submits through submitApplicationEvidence (the
// shared authorized path), rendering its fieldErrors inline and a success
// line.

export type ProfileDefaults = {
  name: string;
  city: string;
  phone: string;
  company: string;
  title: string;
  bio: string;
  linkedinUrl: string;
  tagIds: string[];
};

export function ProfileForm({
  defaults,
  allTags,
}: {
  defaults: ProfileDefaults;
  allTags: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(saveProfile, null);
  const fieldError = (name: string) =>
    state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;

  return (
    <form action={formAction} className="grid gap-4">
      {state?.ok ? (
        <p
          role="status"
          className="rounded-control border border-success/25 bg-success-bg px-3.5 py-2.5 font-medium text-success"
        >
          Profile saved.
        </p>
      ) : null}
      {state && !state.ok ? (
        <p
          role="alert"
          className="rounded-control border border-danger/25 bg-danger-bg px-3.5 py-2.5 font-medium text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <FormField label="Full name" htmlFor="me-name" error={fieldError("name")}>
        <Input
          id="me-name"
          name="name"
          autoComplete="name"
          defaultValue={defaults.name}
          required
          aria-invalid={fieldError("name") ? "true" : undefined}
          aria-describedby={fieldError("name") ? "me-name-error" : undefined}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="City" htmlFor="me-city" error={fieldError("city")}>
          <Input
            id="me-city"
            name="city"
            defaultValue={defaults.city}
            required
            aria-invalid={fieldError("city") ? "true" : undefined}
            aria-describedby={fieldError("city") ? "me-city-error" : undefined}
          />
        </FormField>
        <FormField label="Phone" htmlFor="me-phone" error={fieldError("phone")}>
          <Input
            id="me-phone"
            name="phone"
            type="tel"
            defaultValue={defaults.phone}
            required
            aria-invalid={fieldError("phone") ? "true" : undefined}
            aria-describedby={
              fieldError("phone") ? "me-phone-error" : undefined
            }
          />
        </FormField>
        <FormField
          label="Company"
          htmlFor="me-company"
          error={fieldError("company")}
        >
          <Input
            id="me-company"
            name="company"
            defaultValue={defaults.company}
            required
            aria-invalid={fieldError("company") ? "true" : undefined}
            aria-describedby={
              fieldError("company") ? "me-company-error" : undefined
            }
          />
        </FormField>
        <FormField label="Title" htmlFor="me-title" error={fieldError("title")}>
          <Input
            id="me-title"
            name="title"
            defaultValue={defaults.title}
            required
            aria-invalid={fieldError("title") ? "true" : undefined}
            aria-describedby={fieldError("title") ? "me-title-error" : undefined}
          />
        </FormField>
      </div>

      <FormField
        label="LinkedIn URL (optional)"
        htmlFor="me-linkedin"
        hint="Shown according to your LinkedIn visibility choice."
        error={fieldError("linkedinUrl")}
      >
        <Input
          id="me-linkedin"
          name="linkedinUrl"
          type="url"
          defaultValue={defaults.linkedinUrl}
          placeholder="https://www.linkedin.com/in/your-profile"
          aria-invalid={fieldError("linkedinUrl") ? "true" : undefined}
          aria-describedby={
            fieldError("linkedinUrl") ? "me-linkedin-error" : undefined
          }
        />
      </FormField>

      <FormField label="About" htmlFor="me-bio" error={fieldError("bio")}>
        <Textarea id="me-bio" name="bio" defaultValue={defaults.bio} />
      </FormField>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 block p-0 text-[13px] font-medium text-ink">
          Expertise areas (choose at least one)
        </legend>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <label
              key={tag.id}
              className={cx(
                "inline-flex min-h-tap cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink",
                "has-checked:border-navy has-checked:bg-navy-tint has-checked:text-navy-text",
              )}
            >
              <input
                type="checkbox"
                name="tagIds"
                value={tag.id}
                defaultChecked={defaults.tagIds.includes(tag.id)}
                className="size-[18px] accent-navy"
              />
              {tag.label}
            </label>
          ))}
        </div>
        <FieldError>{fieldError("tagIds")}</FieldError>
      </fieldset>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving profile..." : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
