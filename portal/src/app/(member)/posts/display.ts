import type { PostTypeName } from "@/lib/posts/types";
import { SECTION_LABELS } from "@/lib/notifications/section-labels";

// Presentation helpers shared by HOME-01 feed cards and HOME-02 detail.
// Pure formatting only - all authorization stays in src/lib.

export const TYPE_LABELS: Record<PostTypeName, string> = {
  opportunity: "Opportunity",
  job: "Job",
  knowledge: "Knowledge",
  event: "Event",
};

// Single source of truth lives in lib/notifications/section-labels.ts (the
// account.approved notice needs the same "Opportunities / Jobs / Knowledge /
// Events" copy); re-exported here under the name this module's callers use.
export const TYPE_PLURAL_LABELS = SECTION_LABELS;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string): string {
  return dateFormat.format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return dateTimeFormat.format(new Date(value));
}

/** Compact relative time for feed meta lines: 5m ago, 3h ago, 2d ago, then a date. */
export function relativeTime(value: Date | string): string {
  const then = new Date(value).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDate(new Date(then));
}

/** Whole days until a future date; null when past or absent. */
export function daysLeft(value: Date | string | null): number | null {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return null;
  return Math.ceil(diff / 86400000);
}

function str(metadata: Record<string, unknown>, key: string): string | null {
  const v = metadata[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export const EVENT_MODE_LABELS: Record<string, string> = {
  in_person: "In person",
  virtual: "Virtual",
};

/**
 * One compact per-type metadata line for a feed card:
 * opportunity industry + requested action, job location (+ industry),
 * knowledge category, event date + location + mode.
 */
export function metadataLine(
  type: PostTypeName,
  metadata: Record<string, unknown>,
): string | null {
  const parts: string[] = [];
  switch (type) {
    case "opportunity": {
      const industry = str(metadata, "industry");
      const action = str(metadata, "requestedAction");
      if (industry) parts.push(industry);
      if (action) parts.push(`Needs: ${action}`);
      break;
    }
    case "job": {
      const location = str(metadata, "location");
      const industry = str(metadata, "industry");
      if (location) parts.push(location);
      if (industry) parts.push(industry);
      break;
    }
    case "knowledge": {
      const category = str(metadata, "category");
      if (category) parts.push(category);
      break;
    }
    case "event": {
      const startsAt = str(metadata, "startsAt");
      const location = str(metadata, "location");
      const mode = str(metadata, "mode");
      if (startsAt) parts.push(formatDateTime(startsAt));
      if (location) parts.push(location);
      if (mode) parts.push(EVENT_MODE_LABELS[mode] ?? mode);
      break;
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Post-edit attribution note: null when never edited, "Edited" when the
 * author edited their own post, "Edited by admin" when an admin edited it.
 * The admin's identity is never rendered.
 */
export function editedNote(item: {
  lastEditedAt: Date | null;
  lastEditedById: string | null;
  author: { id: string };
}): string | null {
  if (!item.lastEditedAt) return null;
  return item.lastEditedById === item.author.id ? "Edited" : "Edited by admin";
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
