import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import type { Viewer } from "@/lib/authz";
import {
  hasCurrentConsent,
  getApplicationState,
} from "@/lib/account/registration";

// Single source of truth for "where does this account belong right now".
// Every shell guard and post-sign-in redirect resolves through here so the
// lifecycle gating (consent -> contact visibility -> evidence -> pending ->
// approval) is identical on every path.

export async function resolveLandingPath(
  viewer: Viewer | null,
): Promise<string> {
  if (!viewer) return "/sign-in";

  if (!(await hasCurrentConsent(viewer.id))) return "/register/privacy";

  // AUTH-03 is a required, explicit step: no default visibility applies
  // silently until the member has recorded a choice.
  const profile = await db.query.profiles.findFirst({
    where: eq(tables.profiles.userId, viewer.id),
    columns: { contactChoicesAt: true },
  });
  if (!profile?.contactChoicesAt) return "/register/contact-visibility";

  switch (viewer.status) {
    case "pending": {
      const state = await getApplicationState(viewer);
      return state.evidenceComplete
        ? "/application/pending"
        : "/application/evidence";
    }
    case "needs_changes":
    case "rejected":
    case "suspended":
      return "/application/status";
    case "approved":
      return "/home";
  }
}
