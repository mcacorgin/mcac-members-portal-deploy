"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { transitionAccount } from "@/lib/account/lifecycle";
import {
  adminCreateExpertiseTag,
  adminUpdateMemberProfile,
  setMemberSectionOverride,
} from "@/lib/admin/mutations";
import type { Section, Viewer } from "@/lib/authz";
import { err, type ActionResult } from "@/lib/contracts/result";
import { scheduleOutboxDelivery } from "@/lib/notifications/delivery";

// Server actions for ADMIN-02 (and the ADMIN-04 suspend quick action).
// Authorization happens inside the lib functions; these wrappers only load
// the fresh viewer and revalidate the admin surface after success.

const SECTIONS: Section[] = ["opportunity", "job", "knowledge", "event"];

function revalidateAdmin(userId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath(`/admin/applications/${userId}`);
}

export async function decideAction(
  userId: string,
  to: Viewer["status"],
  reason?: string,
): Promise<ActionResult<{ status: Viewer["status"] }>> {
  const viewer = await requireViewer();
  const result = await transitionAccount(
    viewer,
    { userId, to, reason },
    scheduleOutboxDelivery,
  );
  if (result.ok) revalidateAdmin(userId);
  return result;
}

export type AdminProfileInput = {
  name: string;
  city: string;
  phone: string;
  company: string;
  title: string;
  bio: string;
  linkedinUrl: string;
  phoneVisibility: "visible" | "hidden" | "admin_only";
  emailVisibility: "visible" | "hidden" | "admin_only";
  linkedinVisibility: "visible" | "hidden" | "admin_only";
  tagIds: string[];
};

export async function updateProfileAction(
  userId: string,
  input: AdminProfileInput,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const result = await adminUpdateMemberProfile(viewer, userId, input);
  if (result.ok) revalidateAdmin(userId);
  return result;
}

export async function createTagAction(
  label: string,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  return adminCreateExpertiseTag(viewer, label);
}

export async function setSectionOverrideAction(
  userId: string,
  section: Section,
  enabled: boolean | null,
): Promise<ActionResult> {
  // Server-action arguments are untrusted at runtime.
  if (!SECTIONS.includes(section))
    return err("validation", "Unknown section.");
  if (enabled !== null && typeof enabled !== "boolean")
    return err("validation", "Override must be enabled, disabled, or inherit.");
  const viewer = await requireViewer();
  try {
    const result = await setMemberSectionOverride(
      viewer,
      userId,
      section,
      enabled,
      scheduleOutboxDelivery,
    );
    if (result.ok) revalidateAdmin(userId);
    return result;
  } catch {
    // e.g. foreign-key violation for a nonexistent user id
    return err("not_found", "Account not found.");
  }
}
