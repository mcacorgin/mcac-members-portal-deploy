"use server";

import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  hasCurrentConsent,
  submitApplicationEvidence,
} from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";

export type EvidenceValues = {
  name: string;
  city: string;
  phone: string;
  tagIds: string[];
  company: string;
  title: string;
  bio: string;
  linkedinUrl: string;
};

export type EvidenceState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Submitted values, returned so a failed submit does not clear the form. */
  values?: EvidenceValues;
};

export async function submitEvidenceAction(
  _prev: EvidenceState,
  formData: FormData,
): Promise<EvidenceState> {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");
  // If the privacy notice version changed while this form was open, the
  // refreshed consent gate comes first - never proceed past it silently.
  if (!(await hasCurrentConsent(viewer.id))) redirect("/register/privacy");

  const values: EvidenceValues = {
    name: String(formData.get("name") ?? ""),
    city: String(formData.get("city") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    tagIds: formData.getAll("tagIds").map(String),
    company: String(formData.get("company") ?? ""),
    title: String(formData.get("title") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
  };

  const result = await submitApplicationEvidence(viewer, values);
  if (!result.ok)
    return {
      message: result.message,
      fieldErrors: result.fieldErrors,
      values,
    };

  // Re-resolve AFTER the write: pending stays pending, needs_changes just
  // became pending, and approved always lands on /home.
  const refreshedViewer = await requireViewer();
  redirect(await resolveLandingPath(refreshedViewer));
}
