"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import {
  setCommunicationsOptIn,
  setDirectoryListed,
} from "@/lib/account/registration";
import { err, type ActionResult } from "@/lib/contracts/result";

/**
 * Shared writer for the notice's two OPTIONAL consents, used by every
 * lifecycle screen. Section 10 promises a withdrawal mechanism comparable to
 * the one that took the consent, so this is reachable from the member profile
 * and from the pending / status screens - anywhere a signed-in account can be.
 */
export async function saveOptionalConsentsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!viewer) return err("unauthorized", "Sign in to continue.");

  const communications = await setCommunicationsOptIn(
    viewer,
    formData.get("communications") === "on",
  );
  if (!communications.ok) return communications;

  const directory = await setDirectoryListed(
    viewer,
    formData.get("directory") === "on",
  );
  if (!directory.ok) return directory;

  revalidatePath("/me");
  revalidatePath("/me/edit");
  revalidatePath("/people");
  revalidatePath("/application/pending");
  revalidatePath("/application/status");
  return directory;
}
