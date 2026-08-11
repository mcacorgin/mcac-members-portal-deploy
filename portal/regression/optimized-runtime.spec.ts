import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("mcac-dev-password");
  await page.getByRole("button", { name: "Continue with email" }).click();
}

test("optimized bundle serves public pages without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle(/MCAC Members Portal/);
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Start your application" }),
  ).toBeVisible();
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Continue to MCAC" }),
  ).toBeVisible();
  await expect(page.getByText("AUTH-01", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("production health check fails closed for the local-safe test profile", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toEqual({
    status: "error",
    database: "connected",
    configuration: "invalid",
    referenceData: "unknown",
  });
});

test("approved member can navigate the optimized member experience", async ({
  page,
}) => {
  await signIn(page, "member@example.com");
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

  await expect(page.getByText("HOME-04", { exact: true })).toHaveCount(0);
  await page.goto("/share");
  await expect(page.getByText(/Phase 1 boundary/i)).toHaveCount(0);
});

test("opportunity Server Action persists the mandatory role in the optimized runtime", async ({
  page,
}) => {
  const title = `Production runtime opportunity ${Date.now()}`;
  const sql = postgres(databaseUrl, { max: 1 });
  let postId: string | undefined;

  try {
    await signIn(page, "member@example.com");
    await page.waitForURL("**/home");
    await page.goto("/share");
    await page.getByRole("button", { name: "Opportunity" }).click();
    await page.getByLabel("Title (required)").fill(title);
    await page
      .getByLabel("Opportunity type (required)")
      .selectOption("sell_side");
    await page.getByLabel("Primary industry (required)").fill("Regression testing");
    await page.getByLabel("Business geography (required)").fill("Mumbai");
    await page
      .getByLabel("Mandate basis (required)")
      .selectOption("exclusive");
    await page.getByLabel("Mandate start month (required)").fill("2026-08");
    await page.getByLabel("Full sale").check();
    await page.getByLabel("Asking range from (required)").fill("10");
    await page.getByLabel("Asking range to (required)").fill("20");
    await page.getByLabel("Business location (required)").fill("Mumbai");
    await page
      .getByLabel("Your role in the opportunity (required)")
      .selectOption("mandate_holder");
    await page
      .getByLabel("Brief (required)")
      .fill("Optimized runtime Server Action regression check.");
    await page
      .getByLabel("What do you need from members? (required)")
      .fill("No human action is required.");
    await page
      .getByLabel(/I confirm I am authorised to share this mandate/)
      .check();
    await page.getByRole("button", { name: "Publish" }).click();
    await page.waitForURL(/\/posts\/[0-9a-f-]+/);
    postId = page.url().split("/posts/")[1]?.split(/[?#]/)[0];

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mandate details" }),
    ).toBeVisible();
    await expect(page.getByText("Sell-side mandate", { exact: true })).toBeVisible();
    await expect(page.getByText("Regression testing", { exact: true })).toBeVisible();
    await expect(page.getByText("I have the mandate")).toBeVisible();

    const [row] = await sql<
      { opportunity_role: string }[]
    >`select metadata ->> 'roleInOpportunity' as opportunity_role
      from posts where id = ${postId}`;
    expect(row?.opportunity_role).toBe("mandate_holder");
  } finally {
    if (postId) {
      await sql`delete from notifications where payload ->> 'postId' = ${postId}`;
      await sql`delete from outbox_events where payload ->> 'postId' = ${postId}`;
      await sql`delete from posts where id = ${postId}`;
    }
    await sql.end();
  }
});

test("admin and pending authorization boundaries survive the optimized build", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, "admin@example.com");
  await adminPage.waitForURL("**/home");
  await adminPage.goto("/admin");
  await expect(
    adminPage.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await adminPage.goto("/admin/members");
  await expect(
    adminPage.getByRole("heading", { name: "Members", exact: true }),
  ).toBeVisible();
  await adminContext.close();

  const pendingContext = await browser.newContext();
  const pendingPage = await pendingContext.newPage();
  await signIn(pendingPage, "pending@example.com");
  await pendingPage.waitForURL("**/application/pending");
  await pendingPage.goto("/home");
  await pendingPage.waitForURL("**/application/pending");
  await expect(
    pendingPage.getByText("No member content is available while pending."),
  ).toBeVisible();
  await pendingContext.close();
});
