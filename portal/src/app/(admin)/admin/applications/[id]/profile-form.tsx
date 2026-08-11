"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Checkbox,
  FieldError,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import {
  createTagAction,
  updateProfileAction,
  type AdminProfileInput,
} from "./actions";

const VISIBILITY_OPTIONS = [
  { value: "visible", label: "Visible to members" },
  { value: "hidden", label: "Hidden from everyone" },
  { value: "admin_only", label: "Administrators only" },
] as const;

type TagOption = { id: string; label: string };

export function ProfileForm({
  userId,
  name,
  profile,
  allTags,
  memberTagIds,
}: {
  userId: string;
  name: string;
  profile: {
    city: string;
    phone: string;
    company: string;
    title: string;
    bio: string;
    linkedinUrl: string;
    phoneVisibility: string;
    emailVisibility: string;
    linkedinVisibility: string;
  };
  allTags: TagOption[];
  memberTagIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Tags created inline appear immediately, pre-checked.
  const [extraTags, setExtraTags] = useState<TagOption[]>([]);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [tagPending, startTagTransition] = useTransition();
  const [tagError, setTagError] = useState<string | null>(null);

  // After router.refresh() a newly created tag also arrives via allTags;
  // drop the local copy so keys and checkboxes stay unique.
  const tags = [
    ...allTags,
    ...extraTags.filter((t) => !allTags.some((a) => a.id === t.id)),
  ];

  function fieldError(key: string): string | undefined {
    return fieldErrors[key]?.[0];
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: AdminProfileInput = {
      name: String(form.get("name") ?? ""),
      city: String(form.get("city") ?? ""),
      phone: String(form.get("phone") ?? ""),
      company: String(form.get("company") ?? ""),
      title: String(form.get("title") ?? ""),
      bio: String(form.get("bio") ?? ""),
      linkedinUrl: String(form.get("linkedinUrl") ?? ""),
      phoneVisibility: String(
        form.get("phoneVisibility"),
      ) as AdminProfileInput["phoneVisibility"],
      emailVisibility: String(
        form.get("emailVisibility"),
      ) as AdminProfileInput["emailVisibility"],
      linkedinVisibility: String(
        form.get("linkedinVisibility"),
      ) as AdminProfileInput["linkedinVisibility"],
      tagIds: [...new Set(form.getAll("tagIds").map(String))],
    };
    setError(null);
    setFieldErrors({});
    setSuccess(false);
    startTransition(async () => {
      const result = await updateProfileAction(userId, input);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.message);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  function handleCreateTag() {
    const label = newTagLabel.trim();
    if (!label) {
      setTagError("Enter a tag label first.");
      return;
    }
    setTagError(null);
    startTagTransition(async () => {
      const result = await createTagAction(label);
      if (!result.ok) {
        setTagError(result.message);
        return;
      }
      setExtraTags((prev) => [...prev, { id: result.data.id, label }]);
      setNewTagLabel("");
    });
  }

  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-ink">Profile</h3>
      <p className="mb-4 text-sm text-ink-secondary">
        Changes save directly to the member record and are audit logged.
        Visibility choices control what other members can see.
      </p>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="pf-name" error={fieldError("name")}>
            <Input
              id="pf-name"
              name="name"
              defaultValue={name}
              aria-invalid={fieldError("name") ? "true" : undefined}
              aria-describedby={fieldError("name") ? "pf-name-error" : undefined}
            />
          </FormField>
          <FormField label="City" htmlFor="pf-city" error={fieldError("city")}>
            <Input id="pf-city" name="city" defaultValue={profile.city} />
          </FormField>
          <FormField label="Company" htmlFor="pf-company" error={fieldError("company")}>
            <Input id="pf-company" name="company" defaultValue={profile.company} />
          </FormField>
          <FormField label="Title" htmlFor="pf-title" error={fieldError("title")}>
            <Input id="pf-title" name="title" defaultValue={profile.title} />
          </FormField>
        </div>
        <FormField label="Bio" htmlFor="pf-bio" error={fieldError("bio")}>
          <Textarea id="pf-bio" name="bio" defaultValue={profile.bio} rows={4} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Phone"
            htmlFor="pf-phone"
            error={fieldError("phone")}
          >
            <Input id="pf-phone" name="phone" defaultValue={profile.phone} />
          </FormField>
          <FormField
            label="Phone visibility"
            htmlFor="pf-phone-vis"
            error={fieldError("phoneVisibility")}
          >
            <Select
              id="pf-phone-vis"
              name="phoneVisibility"
              defaultValue={profile.phoneVisibility}
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="LinkedIn URL"
            htmlFor="pf-linkedin"
            error={fieldError("linkedinUrl")}
          >
            <Input
              id="pf-linkedin"
              name="linkedinUrl"
              defaultValue={profile.linkedinUrl}
              aria-invalid={fieldError("linkedinUrl") ? "true" : undefined}
              aria-describedby={
                fieldError("linkedinUrl") ? "pf-linkedin-error" : undefined
              }
            />
          </FormField>
          <FormField
            label="LinkedIn visibility"
            htmlFor="pf-linkedin-vis"
            error={fieldError("linkedinVisibility")}
          >
            <Select
              id="pf-linkedin-vis"
              name="linkedinVisibility"
              defaultValue={profile.linkedinVisibility}
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Email visibility"
            htmlFor="pf-email-vis"
            hint="The email address itself comes from the account and is not editable here."
            error={fieldError("emailVisibility")}
          >
            <Select
              id="pf-email-vis"
              name="emailVisibility"
              defaultValue={profile.emailVisibility}
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <fieldset>
          <legend className="block text-[13px] font-medium text-ink">
            Expertise areas
          </legend>
          {fieldError("tagIds") ? (
            <FieldError>{fieldError("tagIds")}</FieldError>
          ) : null}
          <div className="mt-1 grid gap-0 sm:grid-cols-2">
            {tags.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No expertise tags exist yet. Add one below.
              </p>
            ) : (
              tags.map((tag) => (
                <Checkbox
                  key={tag.id}
                  name="tagIds"
                  value={tag.id}
                  label={tag.label}
                  defaultChecked={
                    memberTagIds.includes(tag.id) ||
                    extraTags.some((t) => t.id === tag.id)
                  }
                />
              ))
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <Input
                aria-label="New expertise tag"
                placeholder="Add a new expertise tag"
                value={newTagLabel}
                onChange={(event) => setNewTagLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
              <FieldError className="mt-1">{tagError}</FieldError>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCreateTag}
              disabled={tagPending}
            >
              {tagPending ? "Adding..." : "Add tag"}
            </Button>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="submit" disabled={pending} data-testid="save-profile">
            {pending ? "Saving..." : "Save profile"}
          </Button>
          {error ? <FieldError role="alert">{error}</FieldError> : null}
          {success ? (
            <p className="text-sm font-medium text-success" role="status">
              Profile saved.
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
