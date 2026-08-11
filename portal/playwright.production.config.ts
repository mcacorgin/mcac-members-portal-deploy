import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3112";

export default defineConfig({
  testDir: "./regression",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start --port 3112",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...(process.env as Record<string, string>),
      AUTH_URL: baseURL,
      AUTH_LINKEDIN_ID: "production-runtime-placeholder",
      AUTH_LINKEDIN_SECRET: "production-runtime-placeholder",
      RESEND_API_KEY: "production-runtime-placeholder",
      EMAIL_FROM: "MCAC Regression <regression@example.invalid>",
      SUPABASE_URL: "https://regression.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "production-runtime-placeholder",
      SUPABASE_BUCKET: "attachments",
      STORAGE_DRIVER: "local",
      MCAC_UI_PREVIEW: "",
      MCAC_DEMO_MEDIA: "1",
    },
  },
  projects: [
    {
      name: "optimized-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
