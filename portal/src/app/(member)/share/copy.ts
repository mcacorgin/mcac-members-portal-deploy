import type { PostTypeName } from "@/lib/posts/types";

// Composer wording the council may change. Kept in one file so a rewording
// touches nothing else.

/** One line under the type chips saying what each type is for. */
export const TYPE_PURPOSES: Record<PostTypeName, string> = {
  opportunity:
    "A mandate to buy, sell or raise money for a business, shared with members who can help.",
  job: "A role you are hiring for, or one you know of.",
  knowledge: "An article, idea or lesson worth sharing with members.",
  event: "A meeting, talk or gathering members can join.",
};

/** Shown under the chips until a type is chosen; also why Publish is off. */
export const CHOOSE_TYPE_CUE =
  "Choose a type to see the right fields. You can publish after that.";

/** Added to the attachment hint on Business Opportunity posts. */
export const CONFIDENTIAL_ATTACHMENT_NOTE =
  "Do not upload confidential client documents, such as an information memorandum or financials. Share those privately after an NDA.";
