"use server";

import { signOut } from "@/lib/auth";

/** Shared sign-out for every lifecycle screen. Always lands on AUTH-01. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/sign-in" });
}
