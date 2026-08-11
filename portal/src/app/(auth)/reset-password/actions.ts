"use server";

import { resetPassword } from "@/lib/account/registration";

export type ResetPasswordState = {
  done?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const result = await resetPassword({
    email: String(formData.get("email") ?? ""),
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok)
    return { error: result.message, fieldErrors: result.fieldErrors };
  return { done: true };
}
