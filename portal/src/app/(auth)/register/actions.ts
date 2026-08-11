"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { registerWithEmail } from "@/lib/account/registration";

export type RegisterState = {
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  /** Submitted values, returned so a failed submit does not clear the form. */
  values?: { name: string; email: string };
};

/**
 * Create the account, then sign the new applicant in and hand off to "/"
 * (the root resolves the landing path, which will be the privacy notice).
 */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const result = await registerWithEmail({ name, email, password });
  if (!result.ok) {
    return {
      message: result.message,
      code: result.code,
      fieldErrors: result.fieldErrors,
      values: { name, email },
    };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    // The account exists; if the immediate sign-in fails for any auth
    // reason, fall back to the sign-in screen rather than erroring.
    if (error instanceof AuthError) redirect("/sign-in");
    throw error;
  }
  return {};
}
