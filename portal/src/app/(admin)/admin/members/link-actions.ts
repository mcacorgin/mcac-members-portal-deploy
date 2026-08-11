"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { adminAccessError } from "@/lib/authz";
import { unlinkLinkedIn } from "@/lib/account/linked-accounts";
import { recordAudit } from "@/lib/audit";
import { err, ok, type ActionResult } from "@/lib/contracts/result";

/**
 * ADMIN recovery path. There is no self-service disconnect, so this is how a
 * link made from a stolen session gets undone.
 */
export async function unlinkLinkedInAction(
  userId: string,
): Promise<ActionResult> {
  const admin = await requireViewer();
  const denied = adminAccessError(admin);
  if (denied || !admin)
    return err(denied ?? "unauthorized", "Administrator access is required.");

  const removed = await unlinkLinkedIn(userId);
  if (!removed) return err("not_found", "That member has no LinkedIn connected.");

  await recordAudit({
    actorId: admin.id,
    action: "account.linkedin.unlink",
    subjectType: "user",
    subjectId: userId,
  });
  revalidatePath("/admin/members");
  return ok(undefined);
}
