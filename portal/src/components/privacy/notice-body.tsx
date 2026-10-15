import { cx } from "@/components/ui";

/**
 * The stored privacy notice as readable text, shared by the consent screen
 * (/register/privacy) and the public /privacy page so both always show the
 * same words the same way.
 *
 * Blank lines split the body into blocks. The first block is the title, the
 * "Effective Date / Last Updated" block becomes a small date panel, and
 * numbered blocks (plus the closing "Consent and Acceptance") become section
 * headings. Headings start at h2, so the page supplies the h1.
 */
export function NoticeBody({ body }: { body: string }) {
  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="grid gap-4 text-[0.9375rem] leading-relaxed text-ink-secondary">
      {blocks.map((block, index) => {
        if (index === 0) {
          return (
            <h2 key={block} className="text-lg font-semibold text-ink">
              {block}
            </h2>
          );
        }
        if (/^(Effective Date|Last Updated):/m.test(block)) {
          return (
            <div
              key={block}
              className="grid gap-1 rounded-control bg-surface-subtle px-3.5 py-3 text-sm text-ink-secondary sm:grid-cols-2"
            >
              {block.split("\n").map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          );
        }
        if (/^\d+\.\s|^Consent and Acceptance$/i.test(block)) {
          return (
            <h3
              key={block}
              className="border-t border-border pt-4 text-base font-semibold text-ink first:border-0 first:pt-0"
            >
              {block}
            </h3>
          );
        }
        return <p key={`${index}-${block.slice(0, 24)}`}>{block}</p>;
      })}
    </div>
  );
}

/**
 * A draft or interim notice must say so wherever it is shown. Renders
 * nothing for a final notice.
 */
export function NoticeStageBadge({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  const isInterim = /INTERIM PRIVACY DISCLOSURE/i.test(body);
  const isDraft = /DRAFT|PENDING LEGAL REVIEW|\[[^\]]*CONFIRM[^\]]*\]/i.test(
    body,
  );
  if (!isInterim && !isDraft) return null;

  return (
    <span
      className={cx(
        "inline-flex min-h-6 w-fit items-center rounded-full bg-danger-bg px-2.5 py-0.5 text-xs font-semibold tracking-wide text-danger",
        className,
      )}
    >
      {isInterim
        ? "INTERIM - FINAL NOTICE PENDING"
        : "DRAFT - PENDING LEGAL REVIEW"}
    </span>
  );
}
