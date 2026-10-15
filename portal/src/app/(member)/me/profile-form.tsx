"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  Button,
  FieldError,
  FormField,
  Input,
  Textarea,
  cx,
} from "@/components/ui";
import type { ActionResult } from "@/lib/contracts/result";
import { PhoneInput } from "@/components/phone-input";
import { splitE164 } from "@/lib/phone";
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
  profession: string;
  bio: string;
  linkedinUrl: string;
  tagIds: string[];
};

export function ProfileForm({
  defaults,
  allTags,
  professionOptions,
}: {
  defaults: ProfileDefaults;
  allTags: { id: string; label: string }[];
  /** Existing member professions, for the profession field's typeahead. */
  professionOptions: string[];
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(saveProfile, null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state) {
      messageRef.current?.focus();
    }
  }, [state]);
  // The "Add" links on /me point at a field here (#me-phone, #me-linkedin).
  // The router's own hash scroll can run while /me/edit's loading.tsx is
  // still showing, before this form exists, and then it is lost. So once
  // the form mounts, bring that field's label into view and focus the field.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const form = formRef.current;
    if (!id || !form) return;
    const field = form.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!field) return;
    const label = form.querySelector(`label[for="${CSS.escape(id)}"]`);
    (label ?? field).scrollIntoView({ block: "start" });
    field.focus({ preventScroll: true });
  }, []);
  const storedPhone = splitE164(defaults.phone);
  const fieldError = (name: string) =>
    state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
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
            autoComplete="address-level2"
            defaultValue={defaults.city}
            required
            aria-invalid={fieldError("city") ? "true" : undefined}
            aria-describedby={fieldError("city") ? "me-city-error" : undefined}
          />
        </FormField>
        <FormField label="Phone" htmlFor="me-phone" error={fieldError("phone")}>
          <PhoneInput
            phoneId="me-phone"
            countryCodeId="me-country-code"
            defaultNational={storedPhone.national}
            defaultCountryCode={storedPhone.countryCode}
            required
            phoneInvalid={Boolean(fieldError("phone"))}
            phoneDescribedBy={
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
            autoComplete="organization"
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
            autoComplete="organization-title"
            defaultValue={defaults.title}
            required
            aria-invalid={fieldError("title") ? "true" : undefined}
            aria-describedby={fieldError("title") ? "me-title-error" : undefined}
          />
        </FormField>
      </div>

      <FormField
        label="Profession"
        htmlFor="me-profession"
        hint="What you do, in a few words. For example Chartered Accountant or M&A Advisor. Members can search for it."
        error={fieldError("profession")}
      >
        <Input
          id="me-profession"
          name="profession"
          list="me-profession-options"
          defaultValue={defaults.profession}
          required
          aria-invalid={fieldError("profession") ? "true" : undefined}
          aria-describedby={
            fieldError("profession") ? "me-profession-error" : undefined
          }
        />
        <datalist id="me-profession-options">
          {professionOptions.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </FormField>

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

      <FormField label="Professional summary" htmlFor="me-bio" error={fieldError("bio")}>
        <Textarea
          id="me-bio"
          name="bio"
          defaultValue={defaults.bio}
          required
          aria-invalid={fieldError("bio") ? "true" : undefined}
          aria-describedby={fieldError("bio") ? "me-bio-error" : undefined}
        />
      </FormField>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 block p-0 text-[0.8125rem] font-medium text-ink">
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

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving profile…" : "Save profile"}
        </Button>
        {state?.ok ? (
          <p
            ref={messageRef}
            role="status"
            tabIndex={-1}
            className="text-sm font-medium text-success"
          >
            Profile saved.
          </p>
        ) : null}
        {state && !state.ok ? (
          <p
            ref={messageRef}
            role="alert"
            tabIndex={-1}
            className="text-sm font-medium text-danger"
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
