import { db, tables, type DbOrTx } from "@/db";
import { eq, and } from "drizzle-orm";
import { getConfig, type ConfigKey } from "@/lib/config";
import type { ErrorCode } from "@/lib/contracts/result";
import { POST_TYPE_NAMES, type PostTypeName } from "@/lib/posts/types";

// Central authorization API (frozen contract: docs/build/permission-matrix.md).
// EVERY server action and data query authorizes through this module - never
// through middleware or UI checks alone. Pending and restricted accounts fail
// closed here (AUTH-06).

export type Viewer = {
  id: string;
  name: string;
  email: string;
  role: "member" | "admin";
  status: "pending" | "approved" | "rejected" | "needs_changes" | "suspended";
};

/**
 * Load the viewer FRESH from the database. Session tokens only prove
 * identity; permissions always come from the current row, so approval
 * revocation or suspension takes effect on the next request.
 */
export async function getViewer(userId: string): Promise<Viewer | null> {
  const row = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
    columns: { id: true, name: true, email: true, role: true, status: true },
  });
  return row ?? null;
}

/** Null when the viewer may access approved-member content; error code otherwise. */
export function memberAccessError(viewer: Viewer | null): ErrorCode | null {
  if (!viewer) return "unauthorized";
  if (viewer.status === "approved") return null;
  if (viewer.status === "pending") return "pending_approval";
  return "account_restricted";
}

/** Null when the viewer is an approved administrator; error code otherwise. */
export function adminAccessError(viewer: Viewer | null): ErrorCode | null {
  const memberErr = memberAccessError(viewer);
  if (memberErr) return memberErr;
  return viewer!.role === "admin" ? null : "forbidden";
}

// ---------------------------------------------------------------------------
// Account lifecycle state machine (docs/build/state-machines.md)
// ---------------------------------------------------------------------------

export const ACCOUNT_TRANSITIONS: Record<Viewer["status"], Viewer["status"][]> =
  {
    pending: ["approved", "rejected", "needs_changes"],
    needs_changes: ["pending", "approved", "rejected"],
    rejected: ["pending"], // re-application, admin initiated
    approved: ["suspended"],
    suspended: ["approved"],
  };

export function canTransitionAccount(
  from: Viewer["status"],
  to: Viewer["status"],
): boolean {
  return ACCOUNT_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Contact-visibility projection (MEMB-02/03, PEOPLE-02)
// ---------------------------------------------------------------------------

type ContactFields = {
  phone: string;
  email: string;
  linkedinUrl: string;
  phoneVisibility: "visible" | "hidden" | "admin_only";
  emailVisibility: "visible" | "hidden" | "admin_only";
  linkedinVisibility: "visible" | "hidden" | "admin_only";
};

export type ProjectedContact = {
  // undefined = viewer is not permitted to see the field at all.
  phone?: string;
  email?: string;
  linkedin?: string;
};

/**
 * Project a member's contact fields for a viewer. Call/WhatsApp/email actions
 * must be derived from this projection only - if a field is undefined the
 * action does not exist for this viewer.
 */
export function projectContact(
  viewer: Viewer,
  subject: ContactFields & { userId: string },
): ProjectedContact {
  const isSelf = viewer.id === subject.userId;
  const isAdmin = viewer.role === "admin" && viewer.status === "approved";
  const permitted = (vis: ContactFields["phoneVisibility"]) => {
    if (isSelf || isAdmin) return true;
    if (viewer.status !== "approved") return false;
    return vis === "visible";
  };
  return {
    phone:
      permitted(subject.phoneVisibility) && subject.phone
        ? subject.phone
        : undefined,
    email:
      permitted(subject.emailVisibility) && subject.email
        ? subject.email
        : undefined,
    linkedin:
      permitted(subject.linkedinVisibility) && subject.linkedinUrl
        ? subject.linkedinUrl
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Section availability (CONT-04): global toggle AND per-member override
// ---------------------------------------------------------------------------

export type Section = "opportunity" | "job" | "knowledge" | "event";

export async function sectionEnabledFor(
  section: Section,
  userId: string,
  dbOrTx: DbOrTx = db,
): Promise<boolean> {
  const globallyEnabled = await getConfig(
    `sections.${section}` as ConfigKey,
    dbOrTx,
  );
  if (!globallyEnabled) return false;
  const [override] = await dbOrTx
    .select()
    .from(tables.memberSectionOverrides)
    .where(
      and(
        eq(tables.memberSectionOverrides.userId, userId),
        eq(tables.memberSectionOverrides.section, section),
      ),
    )
    .limit(1);
  return override ? override.enabled : true;
}

/** Sections effectively enabled for this member (global AND override). */
export async function enabledSections(
  userId: string,
  dbOrTx: DbOrTx = db,
): Promise<PostTypeName[]> {
  const out: PostTypeName[] = [];
  for (const section of POST_TYPE_NAMES) {
    if (await sectionEnabledFor(section, userId, dbOrTx)) out.push(section);
  }
  return out;
}
