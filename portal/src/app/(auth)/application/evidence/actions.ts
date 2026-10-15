"use server";

import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import {
  hasCurrentConsent,
  submitApplicationEvidence,
} from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";
import { scheduleOutboxDelivery } from "@/lib/notifications/delivery";
import { DEFAULT_COUNTRY_CODE, toE164 } from "@/lib/phone";

export type EvidenceValues = {
  name: string;
  city: string;
  /** Raw national-number input, retained for form re-render on failure. */
  phone: string;
  /** Selected country code, retained for form re-render on failure. */
  countryCode: string;
  tagIds: string[];
  company: string;
  title: string;
  profession: string;
  bio: string;
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
    countryCode: String(formData.get("countryCode") ?? DEFAULT_COUNTRY_CODE),
    tagIds: formData.getAll("tagIds").map(String),
    company: String(formData.get("company") ?? ""),
    title: String(formData.get("title") ?? ""),
    profession: String(formData.get("profession") ?? ""),
    bio: String(formData.get("bio") ?? ""),
  };

  // Store E.164 (issue #82); the schema validates the combined value while
  // the raw inputs are retained above for form re-render on failure.
  // linkedinUrl is intentionally not sent (issue #83): registration no
  // longer asks for it, and submitApplicationEvidence leaves the stored
  // value untouched when it is absent.
  const result = await submitApplicationEvidence(
    viewer,
    { ...values, phone: toE164(values.countryCode, values.phone) },
    scheduleOutboxDelivery,
  );
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
