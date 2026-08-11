import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PRODUCTION_BASE_URL ?? "https://members.mcac.org.in";
const httpCredentials =
  process.env.LIVE_BASIC_AUTH_USERNAME && process.env.LIVE_BASIC_AUTH_PASSWORD
    ? {
        username: process.env.LIVE_BASIC_AUTH_USERNAME,
        password: process.env.LIVE_BASIC_AUTH_PASSWORD,
      }
    : undefined;

export default defineConfig({
  testDir: "./live",
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: "line",
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL,
    httpCredentials,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "live-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
