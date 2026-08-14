"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { acceptCurrentNotice } from "@/lib/account/registration";
import { resolveLandingPath } from "@/lib/account/routing";

export type AcceptNoticeState = { conflict?: boolean; error?: string };

/**
 * Record affirmative acceptance of the exact notice version the applicant
 * read. A version conflict reloads the notice (revalidate) and surfaces a
 * banner instead of silently accepting different wording.
 */
export async function acceptNoticeAction(
  _prev: AcceptNoticeState,
  formData: FormData,
): Promise<AcceptNoticeState> {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");

  // Affirmative acceptance is verified server-side too - a consent record
  // must never be creatable without the checkbox actually selected.
  if (formData.get("accept") !== "on")
    return { error: "Select the checkbox to continue." };

  const version = Number(formData.get("version"));
  if (!Number.isInteger(version))
    return { error: "Reload the page and try again." };

  const result = await acceptCurrentNotice(viewer, version, {
    communications: formData.get("communications") === "on",
    directory: formData.get("directory") === "on",
  });
  if (!result.ok) {
    if (result.code === "conflict") {
      revalidatePath("/register/privacy");
      return { conflict: true };
    }
    return { error: result.message };
  }

  // Route through the lifecycle resolver rather than hard-coding the next
  // step: a member re-accepting a NEW notice version has already recorded
  // contact choices, and sending them back through that form would offer
  // default values over the choices they made.
  redirect(await resolveLandingPath(viewer));
}
