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
import { PhoneInput } from "@/components/phone-input";
import { splitE164 } from "@/lib/phone";
import type { EvidenceInput } from "@/lib/account/registration";
import { submitEvidenceAction, type EvidenceState } from "./actions";

const initialState: EvidenceState = {};

export function EvidenceForm({
  professionTags,
  verticalTags,
  professionOptions,
  defaults,
  identity,
  submitLabel = "Submit application",
}: {
  professionTags: { id: string; label: string }[];
  verticalTags: { id: string; label: string }[];
  /** Existing member professions, for the profession field's typeahead. */
  professionOptions: string[];
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
  // The stored phone is E.164; split it so the country-code dropdown and
  // the national-number input prefill separately.
  const storedPhone = splitE164(defaults.phone ?? "");

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
          <p className="text-[0.8125rem] text-ink-secondary">
            Your sign-in account
          </p>
        </div>
      </div>
      <form action={formAction} className="grid gap-4">
        {state.message ? (
          <p
            role="alert"
            className="rounded-control bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
          >
            {state.message} Your answers are still filled in below.
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
          hint="Admins use this to reach you. Members see it only if you allow it."
          error={fieldErrors.phone?.[0]}
        >
          <PhoneInput
            phoneId="phone"
            countryCodeId="countryCode"
            defaultNational={values?.phone ?? storedPhone.national}
            defaultCountryCode={values?.countryCode ?? storedPhone.countryCode}
            required
            phoneInvalid={Boolean(fieldErrors.phone)}
            phoneDescribedBy={fieldErrors.phone ? "phone-error" : undefined}
          />
        </FormField>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
            Professional roles
          </legend>
          <p className="text-xs text-ink-muted">
            Tick the kinds of work you do. Pick at least one here or in the
            next list.
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
          <legend className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
            Industries you work with
          </legend>
          <p className="text-xs text-ink-muted">
            Optional if you ticked a role above.
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
        <FieldError id="expertise-error">{fieldErrors.tagIds?.[0]}</FieldError>
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
          label="Profession"
          htmlFor="profession"
          hint="Your job as members would search for it. For example: Chartered Accountant."
          error={fieldErrors.profession?.[0]}
        >
          <Input
            id="profession"
            name="profession"
            list="profession-options"
            required
            maxLength={120}
            defaultValue={values?.profession ?? defaults.profession}
            aria-invalid={fieldErrors.profession ? true : undefined}
            aria-describedby={
              fieldErrors.profession ? "profession-error" : undefined
            }
          />
          <datalist id="profession-options">
            {professionOptions.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </FormField>
        <FormField
          label="Professional summary"
          htmlFor="bio"
          hint="Two or three lines on what you do and who you help."
          error={fieldErrors.bio?.[0]}
        >
          <Textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={1000}
            required
            defaultValue={values?.bio ?? defaults.bio}
            aria-invalid={fieldErrors.bio ? true : undefined}
            aria-describedby={fieldErrors.bio ? "bio-error" : undefined}
          />
        </FormField>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
      </form>
    </div>
  );
}
