"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, tables } from "@/db";
import { linkedInConfigured, requireViewer, signIn, signOut } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import {
  submitApplicationEvidence,
  updateContactVisibility,
} from "@/lib/account/registration";
import { scheduleOutboxDelivery } from "@/lib/notifications/delivery";
import {
  createLinkIntent,
  isLinkedInLinked,
  LINK_INTENT_COOKIE,
} from "@/lib/account/linked-accounts";
import {
  clearFailures,
  isLockedOut,
  recordFailure,
} from "@/lib/auth-rate-limit";
import { err, ok, type ActionResult } from "@/lib/contracts/result";

// HOME-04 server actions. Profile editing reuses submitApplicationEvidence
// and visibility editing reuses updateContactVisibility - the same
// authorized paths as registration, never direct table writes from the UI
// lane.

export async function saveProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!viewer) return err("unauthorized", "Sign in to continue.");

  const res = await submitApplicationEvidence(viewer, {
    name: String(formData.get("name") ?? ""),
    city: String(formData.get("city") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    company: String(formData.get("company") ?? ""),
    title: String(formData.get("title") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    tagIds: formData.getAll("tagIds").map(String),
  }, scheduleOutboxDelivery);
  if (!res.ok) return res;
  revalidatePath("/me");
  revalidatePath("/me/edit");
  return ok(undefined);
}

const VISIBILITY_CHOICES = ["visible", "hidden", "admin_only"] as const;
type Visibility = (typeof VISIBILITY_CHOICES)[number];

function visibilityOf(value: FormDataEntryValue | null): Visibility | null {
  return VISIBILITY_CHOICES.includes(value as Visibility)
    ? (value as Visibility)
    : null;
}

export async function saveVisibility(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!viewer) return err("unauthorized", "Sign in to continue.");

  const phone = visibilityOf(formData.get("phone"));
  const email = visibilityOf(formData.get("email"));
  const linkedin = visibilityOf(formData.get("linkedin"));
  if (!phone || !email || !linkedin)
    return err("validation", "Choose a visibility for each field.");

  const res = await updateContactVisibility(viewer, {
    phone,
    email,
    linkedin,
  });
  if (res.ok) {
    revalidatePath("/me");
    revalidatePath("/me/edit");
  }
  return res;
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/sign-in" });
}

/**
 * Start LinkedIn linking. The password is re-entered here because a live
 * session alone must not be enough to mint a second, permanent credential.
 * Proof of that check travels to the callback as a single-use intent.
 */
export async function connectLinkedIn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied || !viewer)
    return err(denied ?? "unauthorized", "Sign in as an approved member.");
  if (!linkedInConfigured)
    return err("forbidden", "LinkedIn sign-in is not available yet.");
  if (await isLinkedInLinked(viewer.id))
    return err("conflict", "LinkedIn is already connected to this account.");

  const password = String(formData.get("password") ?? "");
  if (!password)
    return err("validation", "Enter your password to continue.", {
      password: ["Enter your password to continue."],
    });
  if (await isLockedOut(viewer.email))
    return err("rate_limited", "Too many attempts. Try again in 15 minutes.");

  const row = await db.query.users.findFirst({
    where: eq(tables.users.id, viewer.id),
    columns: { passwordHash: true },
  });
  if (!row?.passwordHash || !(await bcrypt.compare(password, row.passwordHash))) {
    await recordFailure(viewer.email);
    return err("validation", "That password is not correct.", {
      password: ["That password is not correct."],
    });
  }
  await clearFailures(viewer.email);

  const token = await createLinkIntent(viewer.id);
  const store = await cookies();
  store.set(LINK_INTENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax", // must survive the top-level redirect back from LinkedIn
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  });

  // Throws a redirect to LinkedIn. Nothing below runs; do not catch it.
  await signIn("linkedin", { redirectTo: "/me" });
  return ok(undefined);
}
