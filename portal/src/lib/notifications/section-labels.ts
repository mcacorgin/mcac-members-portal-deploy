import type { PostTypeName } from "@/lib/posts/types";

// Shared post-type -> plural display label map. The single source of truth
// for "Opportunities / Jobs / Knowledge / Events" copy: used by the outbox
// worker (account.approved email) and the notifications page (in-app detail
// line) so those surfaces never drift, and re-exported by
// src/app/(member)/posts/display.ts for the feed's type filter chips (lib
// must not import from app/, so the dependency runs the other way).
// Record<PostTypeName, string> is exhaustive - adding a PostTypeName without
// updating this map is a compile error, not a silent fallback to the raw key.
export const SECTION_LABELS: Record<PostTypeName, string> = {
  opportunity: "Opportunities",
  job: "Jobs",
  knowledge: "Knowledge",
  event: "Events",
};

/** Payload sections arrive as loosely-typed JSON (string[]); anything outside
 * PostTypeName falls back to the raw value rather than throwing. */
export function enabledSectionsSentence(sections: string[]): string {
  return sections.length
    ? `You can post in: ${sections
        .map((s) => SECTION_LABELS[s as PostTypeName] ?? s)
        .join(", ")}.`
    : "Posting sections will be enabled by an admin.";
}
