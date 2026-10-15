// Add to calendar for event posts (HOME-01 card link, HOME-02 detail links,
// GET /posts/[id]/calendar). Pure builders only: the route and the pages do
// the access checks.
//
// One contract for event times. The datetime-local value has no zone, and
// only the server ever reads it: the composer (share/actions.ts) and the
// edit form (posts/actions.ts) both send it as typed, and the server parses
// it in its OWN zone. Everything that shows the time back reads it in that
// same zone: the pages (formatDateTime has no timeZone) and the edit field
// (startsAtInputValue below). So the wall clock a member sees always equals
// what the poster typed, while the stored ISO string depends on the server's
// zone: on Vercel (UTC) "18:00" typed is stored as 18:00Z. Members mean
// India time. The calendar therefore reads the wall clock the page shows as
// IST, which is right on UTC hosting and on any developer machine alike.
// Never parse or fill the value in the browser: that stores a different
// instant for the same wall clock.

/** No end time is stored; every calendar entry lasts two hours. */
export const EVENT_LENGTH_MS = 2 * 60 * 60 * 1000;

/** IST is UTC+05:30 all year (India has no daylight saving). */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export type CalendarEvent = {
  /** Stable per post, so a second download updates the same entry. */
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
  /** Absolute link back to the post. */
  url: string;
};

type EventPost = {
  id: string;
  type: string;
  title: string;
  metadata: Record<string, unknown>;
};

function str(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * The wall clock `date` shows in `timeZone`; leave the zone out to use this
 * process's zone, exactly as formatDateTime does.
 */
function wallClock(date: Date, timeZone?: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

/**
 * The real start of an event, from its stored `startsAt`. `shownInTimeZone`
 * is the zone the page renders in; leave it out to use this process's zone,
 * exactly as formatDateTime does. Null when `startsAt` is not a date.
 */
export function eventStartInstant(
  startsAt: string,
  shownInTimeZone?: string,
): Date | null {
  const stored = new Date(startsAt);
  if (Number.isNaN(stored.getTime())) return null;
  const shown = wallClock(stored, shownInTimeZone);
  const wallClockAsUtc = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    shown.second,
  );
  return new Date(wallClockAsUtc - IST_OFFSET_MS);
}

/**
 * The edit form's datetime-local value for an event: the wall clock the page
 * shows, read on the server, so saving without touching the field keeps the
 * same start. "" when there is no `startsAt` or it is not a date.
 */
export function startsAtInputValue(
  metadata: Record<string, unknown>,
  shownInTimeZone?: string,
): string {
  const startsAt = str(metadata, "startsAt");
  const stored = startsAt ? new Date(startsAt) : null;
  if (!stored || Number.isNaN(stored.getTime())) return "";
  const shown = wallClock(stored, shownInTimeZone);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(shown.year, 4)}-${pad(shown.month)}-${pad(shown.day)}T${pad(shown.hour)}:${pad(shown.minute)}`;
}

/** True while the event has not started yet. */
export function isUpcomingEvent(
  metadata: Record<string, unknown>,
  now: Date = new Date(),
  shownInTimeZone?: string,
): boolean {
  const startsAt = str(metadata, "startsAt");
  const start = startsAt ? eventStartInstant(startsAt, shownInTimeZone) : null;
  return start !== null && start.getTime() > now.getTime();
}

/**
 * The origin for links members take away from the portal. AUTH_URL is the
 * exact origin on every hosted environment
 * (docs/operations/dependency-inventory.md); local runs usually leave it
 * unset, so callers fall back to the request's own origin on null.
 */
export function siteOrigin(authUrl: string | undefined): string | null {
  if (!authUrl?.trim()) return null;
  try {
    return new URL(authUrl).origin;
  } catch {
    return null;
  }
}

/** Path of the .ics download for one post. */
export function eventCalendarPath(postId: string): string {
  return `/posts/${encodeURIComponent(postId)}/calendar`;
}

/** Calendar entry for an event post; null for any other post or a bad date. */
export function calendarEventForPost(
  post: EventPost,
  origin: string,
  shownInTimeZone?: string,
): CalendarEvent | null {
  if (post.type !== "event") return null;
  const startsAt = str(post.metadata, "startsAt");
  const start = startsAt ? eventStartInstant(startsAt, shownInTimeZone) : null;
  if (!start) return null;

  const url = `${origin}/posts/${encodeURIComponent(post.id)}`;
  const place = str(post.metadata, "location");
  const online = str(post.metadata, "mode") === "virtual";
  const description = [
    // For an online event the location field holds joining notes such as
    // "Zoom (link shared after registration)"; keep them.
    online && place ? `Online: ${place}` : null,
    `Full details: ${url}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  let host = "mcac";
  try {
    host = new URL(origin).hostname || host;
  } catch {
    // A bad origin only costs the UID its domain part.
  }

  return {
    uid: `post-${post.id}@${host}`,
    title: post.title,
    start,
    end: new Date(start.getTime() + EVENT_LENGTH_MS),
    location: online ? "Online" : (place ?? ""),
    description,
    url,
  };
}

/** RFC 5545 UTC date-time: 20261010T123000Z. */
export function formatIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}

/** Google Calendar "create event" link with the entry filled in. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const query = [
    ["action", "TEMPLATE"],
    ["text", event.title],
    ["details", event.description],
    ["location", event.location],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  const dates = `${formatIcsUtc(event.start)}/${formatIcsUtc(event.end)}`;
  return `https://calendar.google.com/calendar/render?${query}&dates=${dates}`;
}

/**
 * RFC 5545 3.3.11 TEXT escaping: backslash, semicolon, comma and line
 * breaks. Other control characters are not allowed in TEXT, so they go.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
}

function utf8Length(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

/**
 * RFC 5545 3.1 folding: no line longer than 75 octets. Each continuation
 * starts with one space, which counts toward its 75. Never splits a
 * character's UTF-8 bytes.
 */
export function foldIcsLine(line: string): string {
  const lines: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = utf8Length(char);
    const limit = lines.length === 0 ? 75 : 74;
    if (octets + size > limit) {
      lines.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  lines.push(current);
  return lines.join("\r\n ");
}

/** A one-event iCalendar file, CRLF line endings throughout. */
export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MCAC//Members Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsUtc(event.start)}`,
    `DTEND:${formatIcsUtc(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/** "Workshop: AI, in practice" -> "workshop-ai-in-practice.ics". */
export function icsFilename(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${slug || "mcac-event"}.ics`;
}
