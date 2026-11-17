"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const KEY = "mcac.profilePromptDismissed";

// shortcut: dismissal is per browser and permanent, upgrade if it must reset.
function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

export function ProfilePromptBanner() {
  const [dismissed, setDismissed] = useState(false);
  const stored = useSyncExternalStore(subscribe, wasDismissed, () => true);
  // Server snapshot is "dismissed": the banner is never in server HTML, so a
  // member who dismissed it sees no flash. The key is per browser, not per user.
  const hidden = dismissed || stored;
  if (hidden) return null;

  return (
    <div
      role="region"
      aria-label="Complete your profile"
      data-testid="profile-prompt-banner"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-control border border-border-strong bg-surface px-4 py-3 text-sm text-ink"
    >
      <p className="min-w-0 flex-1">
        Add your profession and a short summary so other members can find you.
      </p>
      <Link
        href="/me/edit"
        className="inline-flex min-h-tap items-center font-semibold text-navy-text underline"
      >
        Complete profile
      </Link>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            // Private mode: hide for this visit only.
          }
          setDismissed(true);
        }}
        className="inline-flex min-h-tap items-center px-2 text-ink-muted"
      >
        Dismiss
      </button>
    </div>
  );
}
