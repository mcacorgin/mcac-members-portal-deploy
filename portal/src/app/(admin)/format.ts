// Shared date formatting for the admin surface. Fixed locale so server
// rendering is deterministic.

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date): string {
  return dateFormat.format(value);
}

export function formatDateTime(value: Date): string {
  return dateTimeFormat.format(value);
}
