type Environment = Record<string, string | undefined>;

const REQUIRED = [
  "AUTH_SECRET",
  "AUTH_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "SUPABASE_URL",
  "SUPABASE_STORAGE_BUCKET",
] as const;

export function productionConfigErrors(env: Environment): string[] {
  if (env.NODE_ENV !== "production") return [];

  const errors = REQUIRED.filter((name) => !usable(env[name])).map(
    (name) => `${name} is not configured`,
  );

  if (!usable(env.DATABASE_URL) || isLocalUrl(env.DATABASE_URL)) {
    errors.push("DATABASE_URL is missing or local");
  }
  if (!usable(env.SUPABASE_SECRET_KEY) && !usable(env.SUPABASE_SERVICE_ROLE_KEY)) {
    errors.push("SUPABASE_SECRET_KEY is not configured");
  }
  if (env.STORAGE_DRIVER !== "supabase") {
    errors.push('STORAGE_DRIVER must be "supabase"');
  }
  if (!strongSecret(env.AUTH_SECRET)) {
    errors.push("AUTH_SECRET must contain at least 32 non-placeholder characters");
  }
  if (!strongSecret(env.CRON_SECRET) && !strongSecret(env.JOBS_SECRET)) {
    errors.push("CRON_SECRET or JOBS_SECRET must contain at least 32 characters");
  }
  if (!isHttpsUrl(env.AUTH_URL)) {
    errors.push("AUTH_URL must be a public HTTPS URL");
  }
  if (!isHttpsUrl(env.SUPABASE_URL)) {
    errors.push("SUPABASE_URL must be an HTTPS URL");
  }
  if (env.EMAIL_FROM?.includes("@localhost")) {
    errors.push("EMAIL_FROM must use a verified production domain");
  }
  if (env.MCAC_UI_PREVIEW === "1") {
    errors.push("MCAC_UI_PREVIEW must be disabled");
  }

  return [...new Set(errors)];
}

function usable(value: string | undefined): boolean {
  return Boolean(value?.trim()) && !value!.includes("generate-");
}

function strongSecret(value: string | undefined): boolean {
  return usable(value) && value!.trim().length >= 32;
}

function isHttpsUrl(value: string | undefined): boolean {
  if (!usable(value)) return false;
  try {
    return new URL(value!).protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalUrl(value: string | undefined): boolean {
  return /localhost|127\.0\.0\.1/.test(value ?? "");
}
