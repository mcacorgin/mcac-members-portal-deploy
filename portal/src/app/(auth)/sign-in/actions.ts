"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/lib/auth";
import { getCurrentNotice } from "@/lib/account/registration";

export type SignInState = { error?: string; email?: string };

/** Bad credentials arrive as CredentialsSignin, either directly or wrapped
 *  in a CallbackRouteError when authorize() throws. Anything else (config,
 *  database, provider failures) must propagate, not masquerade as a typo. */
function isBadCredentials(error: AuthError): boolean {
  if (error.type === "CredentialsSignin") return true;
  return (
    error.type === "CallbackRouteError" &&
    error.cause?.err instanceof CredentialsSignin
  );
}

/**
 * Credentials sign-in. On success next-auth redirects to "/" where the root
 * page resolves the correct landing path for the account's lifecycle state.
 */
export async function signInWithEmail(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password)
    return { error: "Enter your email and password.", email };

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    // The framework redirect on success must be rethrown.
    if (error instanceof AuthError && isBadCredentials(error)) {
      return { error: "Email or password is incorrect.", email };
    }
    throw error;
  }
  return {};
}

/** LinkedIn OAuth entry; rendered only when the provider is configured. */
export async function signInWithLinkedIn(): Promise<void> {
  if (!(await getCurrentNotice())) {
    throw new Error(
      "Member registration is unavailable until MCAC publishes its privacy notice.",
    );
  }
  await signIn("linkedin", { redirectTo: "/" });
}
