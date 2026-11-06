import { expect, test } from "@playwright/test";

test.describe("PrepZii LMS release smoke tests", () => {
  test("public landing page exposes the product and contact form", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PrepZii/i);
    await expect(page.getByText("PrepZii for Institutes", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Manage Your Entire Coaching Institute in One Place." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Everything You Need to Run Your Institute" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Request a 1-on-1 Walkthrough" })).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Dr. Rajesh Agrawal")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Apex IIT Academy")).toBeVisible();
  });

  test("public CBT demo keeps answers when navigating between questions", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Try the CBT demo" }).click();
    await expect(page.getByRole("heading", { name: "Try the CBT Demo" })).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Save & Next" }).click();
    await page.getByRole("button", { name: /1\. Physics/ }).click();
    await expect(page.getByRole("radio").first()).toBeChecked();
    await page.getByRole("button", { name: "Show Solution" }).click();
    await expect(page.getByText(/For a harmonic potential/)).toBeVisible();
  });

  test("institute onboarding renders its required identity fields", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Create your institute workspace" })).toBeVisible();
    await expect(page.getByLabel("Institute name")).toBeVisible();
    await expect(page.getByLabel("Workspace URL")).toBeVisible();
    await expect(page.getByRole("button", { name: /Create institute workspace/ })).toBeVisible();
  });

  test("one mobile-friendly sign-in is shared by institute users", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "Your institute workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Own a coaching institute? Create your workspace." })).toHaveAttribute("href", "/sign-up");
    await expect(page.getByRole("link", { name: /platform|faculty|institute admin/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });

  test("legacy institute sign-in URLs preserve invitation return links", async ({ page }) => {
    for (const path of ["/institute/login", "/portal/login"]) {
      await page.goto(`${path}?return_to=%2Finvite%2Fexample`);
      await expect(page).toHaveURL((url) =>
        url.pathname === "/sign-in" && url.searchParams.get("return_to") === "/invite/example",
      );
    }
  });

  test("unconfigured dependencies fail readiness without failing liveness", async ({ request }) => {
    const live = await request.get("/api/health");
    expect(live.status()).toBe(200);
    await expect(live.json()).resolves.toMatchObject({ status: "ok" });

    const ready = await request.get("/api/ready");
    expect(ready.status()).toBe(503);
    await expect(ready.json()).resolves.toMatchObject({
      status: "not_ready",
      checks: { configuration: "failed", database: "not_checked" },
    });
  });

  test("legacy dashboard URLs resolve to canonical workspaces", async ({ page }) => {
    await page.goto("/dashboard/admissions");
    await expect(page).toHaveURL(/\/dashboard\/workspace$/);
    await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();

    await page.goto("/dashboard/assessments");
    await expect(page).toHaveURL(/\/dashboard\/assessments\/workspace$/);
  });

  test("accounts without an institute see setup guidance instead of tenant tools", async ({ page }) => {
    await page.goto("/dashboard/workspace");
    await expect(page.getByRole("heading", { name: "Create your institute to open the workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create institute" })).toHaveAttribute("href", "/onboarding");
    await expect(page.locator('a[href="/dashboard/crm"]')).toHaveCount(0);
    await expect(page.locator('a[href="/dashboard/fees/workspace"]')).toHaveCount(0);
    await expect(page.locator('a[href="/dashboard/omr"]')).toHaveCount(0);
  });

  test("dashboard navigation is accessible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/workspace");
    const open = page.getByRole("button", { name: "Open dashboard navigation" });
    await expect(open).toBeVisible();
    await open.click();
    await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toBeVisible();
    await expect(page.getByRole("complementary").getByRole("button", { name: "Close dashboard navigation" })).toBeVisible();
  });

  test("security headers and same-origin mutation protection are active", async ({ request }) => {
    const pageResponse = await request.get("/");
    expect(pageResponse.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(pageResponse.headers()["x-content-type-options"]).toBe("nosniff");

    const rejected = await request.post("/api/demo-request", {
      headers: { origin: "https://attacker.invalid", "sec-fetch-site": "cross-site" },
      data: {},
    });
    expect(rejected.status()).toBe(403);

    const forgedAdmin = await request.get("/api/platform", {
      headers: { cookie: "prepzii_superadmin_session=sa_forged" },
    });
    expect([401, 503]).toContain(forgedAdmin.status());
  });
});
