import { cx } from "@/components/ui";
import { ADMIN_EMAIL } from "@/lib/contact";

/**
 * "Trouble applying? Email admin@mcac.org.in" for the public entry pages.
 * The address may break at any character, so a 320px screen at 200% text
 * size wraps it instead of scrolling sideways.
 */
export function AdminContactLine({
  lead = "Trouble applying?",
  className,
}: {
  lead?: string;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "flex min-h-tap flex-wrap items-center gap-x-1 text-ink-secondary",
        className,
      )}
    >
      {lead} Email{" "}
      <a
        href={`mailto:${ADMIN_EMAIL}`}
        className="inline-flex min-h-tap min-w-0 items-center font-medium text-navy-text underline decoration-border-strong underline-offset-4 wrap-anywhere transition-colors duration-150 ease-out-strong hover:decoration-navy-text"
      >
        {ADMIN_EMAIL}
      </a>
    </p>
  );
}
