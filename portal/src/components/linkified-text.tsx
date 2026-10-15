import type { ReactNode } from "react";

// Render-time URL linkification for post and comment bodies (issue #68).
// Only http/https URLs with a scheme become links; bare domains stay plain
// text. React escapes all text content, so no user HTML can render and the
// CSP stays untouched. Links open in a new tab with noopener/noreferrer.

/** Matches http/https URLs only. */
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

/** Trailing characters that may belong to the sentence, not the URL. */
const TRAILING_CHARS = new Set([",", ".", ";", ":", "!", "?", "'", '"', "’", "”"]);
const CLOSER_TO_OPENER: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

export type LinkToken =
  | { type: "text"; text: string }
  | { type: "link"; url: string };

function splitTrailing(match: string): { url: string; trailing: string } {
  // Strip trailing sentence punctuation, but keep a closing bracket/paren
  // when it balances an opener inside the URL (e.g. Wikipedia
  // "_(disambiguation)" links), instead of blindly cutting it off.
  let end = match.length;
  while (end > 0) {
    const ch = match[end - 1];
    if (TRAILING_CHARS.has(ch)) {
      end--;
      continue;
    }
    const opener = CLOSER_TO_OPENER[ch];
    if (opener) {
      const body = match.slice(0, end - 1);
      const opens = body.split(opener).length - 1;
      const closes = body.split(ch).length; // +1 for the candidate itself
      if (closes <= opens) break; // balanced: the bracket belongs to the URL
      end--;
      continue;
    }
    break;
  }
  return { url: match.slice(0, end), trailing: match.slice(end) };
}

/** Pure tokenizer: split plain text into text/link tokens. Unit-tested. */
export function tokenizeUrls(text: string): LinkToken[] {
  const tokens: LinkToken[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, start) });
    }
    const { url, trailing } = splitTrailing(match[0]);
    if (url) tokens.push({ type: "link", url });
    if (trailing) tokens.push({ type: "text", text: trailing });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) });
  }
  return tokens;
}

/** Render tokens as escaped text with external links. */
export function renderLinkTokens(tokens: LinkToken[]): ReactNode[] {
  return tokens.map((token, index) =>
    token.type === "link" ? (
      <a
        key={`link-${index}`}
        href={token.url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-navy-text underline hover:no-underline"
      >
        {token.url}
      </a>
    ) : (
      <span key={`text-${index}`}>{token.text}</span>
    ),
  );
}

/** Drop-in replacement for rendering a plain-text body with linkified URLs. */
export function LinkifiedText({ text }: { text: string }) {
  return <>{renderLinkTokens(tokenizeUrls(text))}</>;
}
