import { expect, test } from "@playwright/test";

test.describe("PrepZii LMS release smoke tests", () => {
  test("public landing page exposes the product and contact form", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PrepZii/i);
    await expect(page.getByText("PrepZii for Institutes", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("JEE & NEET", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Request a 1-on-1 Walkthrough" })).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Dr. Rajesh Agrawal")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Apex IIT Academy")).toBeVisible();
  });

  test("institute onboarding renders its required identity fields", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Create your institute workspace" })).toBeVisible();
    await expect(page.getByLabel("Institute name")).toBeVisible();
    await expect(page.getByLabel("Workspace URL")).toBeVisible();
    await expect(page.getByRole("button", { name: /Create institute workspace/ })).toBeVisible();
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
    await expect(page).toHaveURL(/\/dashboard\/crm$/);
    await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();

    await page.goto("/dashboard/assessments");
    await expect(page).toHaveURL(/\/dashboard\/assessments\/workspace$/);
  });

  test("accounts without an institute see setup guidance instead of tenant tools", async ({ page }) => {
    await page.goto("/dashboard/workspace");
    await expect(page.getByRole("heading", { name: "Create your institute to open the workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create institute" })).toHaveAttribute("href", "/onboarding");
    await expect(page.locator('a[href="/dashboard/crm"]')).toHaveCount(0);
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
  });
});
