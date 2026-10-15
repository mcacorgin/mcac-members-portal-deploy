import type { PostTypeName } from "@/lib/posts/types";
import { mandateOpportunityMetadataFromForm } from "@/lib/posts/opportunity";

// Switching post type unmounts the old type's fields. Just before that, the
// composer copies what the member typed into a draft for that type, and the
// fields read it back as default values when the type is chosen again. Only
// the chosen type's fields are ever in the form, so only they are validated
// and sent.

export type TypeDraft = Record<string, unknown>;
export type TypeDrafts = Partial<Record<PostTypeName, TypeDraft>>;

export function draftFromForm(
  type: PostTypeName,
  formData: FormData,
): TypeDraft {
  // OpportunityFields takes its defaults in metadata shape (numbers, lists,
  // true/false), the same shape the edit page passes it.
  if (type === "opportunity") {
    return mandateOpportunityMetadataFromForm(formData);
  }
  const draft: TypeDraft = {};
  for (const [name, value] of formData) {
    if (typeof value === "string") draft[name] = value;
  }
  return draft;
}

export function draftText(draft: TypeDraft | undefined, key: string): string {
  const value = draft?.[key];
  return typeof value === "string" ? value : "";
}
