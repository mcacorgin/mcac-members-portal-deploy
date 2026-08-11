import assert from "node:assert/strict";
import test from "node:test";
import { productionConfigErrors } from "./production-readiness";

const baseEnvironment = {
  NODE_ENV: "production",
  AUTH_SECRET: "a".repeat(40),
  AUTH_URL: "https://mcac.org.in",
  AUTH_LINKEDIN_ID: "linkedin-id",
  AUTH_LINKEDIN_SECRET: "linkedin-secret",
  RESEND_API_KEY: "resend-key",
  EMAIL_FROM: "MCAC <admin@mcac.org.in>",
  DATABASE_URL: "postgres://example.invalid/mcac",
  STORAGE_DRIVER: "supabase",
  SUPABASE_URL: "https://example.supabase.co",
  JOBS_SECRET: "j".repeat(40),
};

test("accepts the current MCAC Supabase secret and bucket variable names", () => {
  assert.deepEqual(
    productionConfigErrors({
      ...baseEnvironment,
      SUPABASE_SECRET_KEY: "sb_secret_example",
      SUPABASE_STORAGE_BUCKET: "attachments",
    }),
    [],
  );
});

test("accepts the alternate Supabase service-role and bucket variable names", () => {
  assert.deepEqual(
    productionConfigErrors({
      ...baseEnvironment,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-token",
      SUPABASE_BUCKET: "attachments",
    }),
    [],
  );
});

test("rejects production when both credential or bucket variants are missing", () => {
  const errors = productionConfigErrors(baseEnvironment);
  assert.ok(errors.some((error) => error.includes("SUPABASE_SECRET_KEY")));
  assert.ok(errors.some((error) => error.includes("SUPABASE_STORAGE_BUCKET")));
});
