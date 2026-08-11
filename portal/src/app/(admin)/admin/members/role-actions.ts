"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { setMemberRole } from "@/lib/admin/mutations";
import type { ActionResult } from "@/lib/contracts/result";

export async function setMemberRoleAction(
  userId: string,
  role: "member" | "admin",
): Promise<ActionResult> {
  const result = await setMemberRole(await requireViewer(), userId, role);
  if (result.ok) revalidatePath("/admin/members");
  return result;
}
