"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  clearPreferredContactEmail,
  requestPreferredContactEmail,
  verifyPreferredContactEmail,
} from "@/lib/account/preferred-contact-email";
import type { ActionResult } from "@/lib/contracts/result";

function refreshEmailSurfaces(): void {
  revalidatePath("/me");
  revalidatePath("/me/edit");
  revalidatePath("/application/pending");
}

export async function requestPreferredContactEmailAction(
  _previous: ActionResult<{ pendingEmail: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ pendingEmail: string }>> {
  const viewer = await requireViewer();
  const result = await requestPreferredContactEmail(
    viewer,
    String(formData.get("email") ?? ""),
  );
  if (result.ok) refreshEmailSurfaces();
  return result;
}

export async function clearPreferredContactEmailAction(
  previous: ActionResult | null,
): Promise<ActionResult> {
  void previous;
  const viewer = await requireViewer();
  const result = await clearPreferredContactEmail(viewer);
  if (result.ok) refreshEmailSurfaces();
  return result;
}

export async function verifyPreferredContactEmailAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const result = await verifyPreferredContactEmail(
    viewer,
    String(formData.get("token") ?? ""),
  );
  if (!result.ok) return result;
  refreshEmailSurfaces();
  redirect("/verify-contact-email/complete");
}
