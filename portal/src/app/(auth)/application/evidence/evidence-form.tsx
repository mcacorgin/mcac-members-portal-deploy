"use client";

import { useActionState } from "react";
import {
  Avatar,
  Button,
  Checkbox,
  FieldError,
  FormField,
  Input,
  Textarea,
} from "@/components/ui";
import type { EvidenceInput } from "@/lib/account/registration";
import { submitEvidenceAction, type EvidenceState } from "./actions";

const initialState: EvidenceState = {};

export function EvidenceForm({
  professionTags,
  verticalTags,
  defaults,
  identity,
  submitLabel = "Submit application",
}: {
  professionTags: { id: string; label: string }[];
  verticalTags: { id: string; label: string }[];
  defaults: Partial<EvidenceInput> & { tagIds?: string[] };
  identity: { name: string; email: string; image: string | null };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitEvidenceAction,
    initialState,
  );
  const fieldErrors = state.fieldErrors ?? {};
  // React resets the form after the action settles; feed the submitted
  // values back through defaultValue so a validation failure retains them.
  const values = state.values;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Avatar
          src={identity.image ?? undefined}
          name={identity.name}
          size="lg"
        />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{identity.email}</p>
          <p className="text-[13px] text-ink-secondary">
            Signed in as {identity.email}.
          </p>
        </div>
      </div>
      <form action={formAction} className="grid gap-4">
        {state.message ? (
          <p
            role="alert"
            className="rounded-control bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
          >
            {state.message} Your entries are retained below.
          </p>
        ) : null}
        <FormField label="Full name" htmlFor="name" error={fieldErrors.name?.[0]}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={values?.name ?? defaults.name}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
          />
        </FormField>
        <FormField label="City" htmlFor="city" error={fieldErrors.city?.[0]}>
          <Input
            id="city"
            name="city"
            autoComplete="address-level2"
            required
            defaultValue={values?.city ?? defaults.city}
            aria-invalid={fieldErrors.city ? true : undefined}
            aria-describedby={fieldErrors.city ? "city-error" : undefined}
          />
        </FormField>
        <FormField
          label="WhatsApp phone"
          htmlFor="phone"
          hint="Administrators need a reachable number; members see it only per your visibility choice."
          error={fieldErrors.phone?.[0]}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            defaultValue={values?.phone ?? defaults.phone}
            aria-invalid={fieldErrors.phone ? true : undefined}
            aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
          />
        </FormField>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 block text-[13px] font-medium text-ink">
            Profession
          </legend>
          <p className="text-xs text-ink-muted">
            Select the professional roles that best describe your work.
          </p>
          <div className="grid gap-0.5 rounded-control border border-border-strong bg-surface px-3 py-1 sm:grid-cols-2">
            {professionTags.map((tag) => (
              <Checkbox
                key={tag.id}
                name="tagIds"
                value={tag.id}
                label={tag.label}
                defaultChecked={(values?.tagIds ?? defaults.tagIds)?.includes(
                  tag.id,
                )}
                aria-describedby={
                  fieldErrors.tagIds ? "expertise-error" : undefined
                }
                className="py-1.5"
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 block text-[13px] font-medium text-ink">
            Verticals of interest
          </legend>
          <p className="text-xs text-ink-muted">
            Select the industries and business areas you want to follow.
          </p>
          <div className="grid gap-0.5 rounded-control border border-border-strong bg-surface px-3 py-1 sm:grid-cols-2">
            {verticalTags.map((tag) => (
              <Checkbox
                key={tag.id}
                name="tagIds"
                value={tag.id}
                label={tag.label}
                defaultChecked={(values?.tagIds ?? defaults.tagIds)?.includes(
                  tag.id,
                )}
                aria-describedby={
                  fieldErrors.tagIds ? "expertise-error" : undefined
                }
                className="py-1.5"
              />
            ))}
          </div>
        </fieldset>
        <div>
          <p className="text-xs text-ink-muted">
            Select at least one option across these two panels.
          </p>
          <FieldError id="expertise-error">{fieldErrors.tagIds?.[0]}</FieldError>
        </div>
        <FormField
          label="Company or practice"
          htmlFor="company"
          error={fieldErrors.company?.[0]}
        >
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            required
            defaultValue={values?.company ?? defaults.company}
            aria-invalid={fieldErrors.company ? true : undefined}
            aria-describedby={
              fieldErrors.company ? "company-error" : undefined
            }
          />
        </FormField>
        <FormField label="Title" htmlFor="title" error={fieldErrors.title?.[0]}>
          <Input
            id="title"
            name="title"
            autoComplete="organization-title"
            required
            defaultValue={values?.title ?? defaults.title}
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={fieldErrors.title ? "title-error" : undefined}
          />
        </FormField>
        <FormField
          label="Short bio (optional)"
          htmlFor="bio"
          error={fieldErrors.bio?.[0]}
        >
          <Textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={1000}
            defaultValue={values?.bio ?? defaults.bio}
          />
        </FormField>
        <FormField
          label="LinkedIn URL (optional)"
          htmlFor="linkedinUrl"
          error={fieldErrors.linkedinUrl?.[0]}
        >
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            placeholder="https://linkedin.com/in/your-profile"
            defaultValue={values?.linkedinUrl ?? defaults.linkedinUrl}
            aria-invalid={fieldErrors.linkedinUrl ? true : undefined}
            aria-describedby={
              fieldErrors.linkedinUrl ? "linkedinUrl-error" : undefined
            }
          />
        </FormField>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
      </form>
    </div>
  );
}
