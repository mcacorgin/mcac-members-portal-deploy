// Shared date formatting for the admin surface. Fixed locale and a fixed
// time zone so server rendering is deterministic. MCAC admins work in India,
// so every admin date and time is shown in IST (Asia/Kolkata) whatever the
// server's own zone is (Vercel functions run in UTC).

export const ADMIN_TIME_ZONE = "Asia/Kolkata";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ADMIN_TIME_ZONE,
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ADMIN_TIME_ZONE,
});

const isoDateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ADMIN_TIME_ZONE,
});

export function formatDate(value: Date): string {
  return dateFormat.format(value);
}

/** Date and time in IST, labelled so nobody mistakes it for local time. */
export function formatDateTime(value: Date): string {
  return `${dateTimeFormat.format(value)} IST`;
}

/** YYYY-MM-DD of the IST calendar day, for exports. */
export function formatIsoDateIst(value: Date): string {
  return isoDateFormat.format(value);
}
