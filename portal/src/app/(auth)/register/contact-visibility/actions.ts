"use server";

import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { updateContactVisibility } from "@/lib/account/registration";

export type Choice = "visible" | "hidden" | "admin_only";

export type VisibilityState = {
  error?: string;
  /** Submitted choices, returned so a failed save does not clear them. */
  values?: { phone: Choice; email: Choice; linkedin: Choice };
};

function choice(value: FormDataEntryValue | null): Choice {
  const v = String(value ?? "");
  return v === "visible" || v === "hidden" || v === "admin_only"
    ? v
    : "hidden";
}

export async function saveVisibilityAction(
  _prev: VisibilityState,
  formData: FormData,
): Promise<VisibilityState> {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");

  const values = {
    phone: choice(formData.get("phone")),
    email: choice(formData.get("email")),
    linkedin: choice(formData.get("linkedin")),
  };
  const result = await updateContactVisibility(viewer, values);
  if (!result.ok) return { error: result.message, values };
  redirect("/");
}
