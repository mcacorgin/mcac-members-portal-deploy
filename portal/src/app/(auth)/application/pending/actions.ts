"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { resolveLandingPath } from "@/lib/account/routing";

/**
 * Re-check the application status. If an administrator has acted, the
 * landing-path resolver routes to the new state (status screen, home);
 * otherwise the pending screen re-renders fresh.
 */
export async function checkStatusAction(): Promise<void> {
  const viewer = await requireViewer();
  if (!viewer) redirect("/sign-in");
  revalidatePath("/application/pending");
  redirect(await resolveLandingPath(viewer));
}
