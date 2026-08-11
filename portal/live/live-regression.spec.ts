import { expect, test, type Page } from "@playwright/test";

const full = process.env.LIVE_REGRESSION_MODE === "full";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue with email" }).click();
}

test("@public production readiness endpoint is healthy", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    status: "ok",
    database: "connected",
    configuration: "valid",
    referenceData: "ready",
  });
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("@public public entry points render without browser exceptions or mobile overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle(/MCAC Members Portal/);
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Continue to MCAC" }),
  ).toBeVisible();
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Start your application" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(errors).toEqual([]);
});

test("approved member can read every primary production screen", async ({
  page,
}) => {
  test.skip(!full, "full live credentials were not requested");
  await signIn(
    page,
    process.env.LIVE_MEMBER_EMAIL!,
    process.env.LIVE_MEMBER_PASSWORD!,
  );
  await page.waitForURL("**/home");

  for (const [path, heading] of [
    ["/home", "Home"],
    ["/people", "People"],
    ["/share", "Share"],
    ["/saved", "Saved"],
    ["/notifications", "Notifications"],
    ["/me", "Me"],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
});

test("admin can read the production operations screens", async ({ page }) => {
  test.skip(!full, "full live credentials were not requested");
  await signIn(
    page,
    process.env.LIVE_ADMIN_EMAIL!,
    process.env.LIVE_ADMIN_PASSWORD!,
  );
  await page.waitForURL("**/home");

  for (const [path, heading] of [
    ["/admin", "Overview"],
    ["/admin/members", "Members"],
    ["/admin/policy", "Policy"],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
});

test("pending production account remains isolated from member content", async ({
  page,
}) => {
  test.skip(!full, "full live credentials were not requested");
  await signIn(
    page,
    process.env.LIVE_PENDING_EMAIL!,
    process.env.LIVE_PENDING_PASSWORD!,
  );
  await page.waitForURL("**/application/pending");
  await page.goto("/home");
  await page.waitForURL("**/application/pending");
  await expect(
    page.getByText("No member content is available while pending."),
  ).toBeVisible();
});
