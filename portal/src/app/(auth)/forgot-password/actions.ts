"use server";

import { requestPasswordReset } from "@/lib/account/registration";
import { getConfig } from "@/lib/config";

export type ForgotPasswordState = { sent?: boolean; error?: string };

/**
 * Always resolves to the same confirmation whether or not the address has
 * an account; only an empty input is surfaced as a validation error.
 */
export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  if (!(await getConfig("auth.emailFallbackEnabled"))) return { sent: true };
  const email = String(formData.get("email") ?? "").trim();
  const result = await requestPasswordReset(email);
  if (!result.ok && result.code === "validation")
    return { error: result.message };
  return { sent: true };
}
