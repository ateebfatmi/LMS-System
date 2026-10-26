import { expect, test } from "@playwright/test";

const organizationSlug = process.env.STAGING_ORGANIZATION_SLUG;
const forbiddenOrganizationSlug = process.env.STAGING_FORBIDDEN_ORGANIZATION_SLUG;

test.beforeAll(() => {
  if (!organizationSlug || !forbiddenOrganizationSlug) {
    throw new Error("STAGING_ORGANIZATION_SLUG and STAGING_FORBIDDEN_ORGANIZATION_SLUG are required.");
  }
  if (organizationSlug === forbiddenOrganizationSlug) {
    throw new Error("The allowed and forbidden staging organization slugs must be different.");
  }
});

test("staging configuration and database are ready", async ({ request }) => {
  const response = await request.get("/api/ready");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    status: "ready",
    checks: { configuration: "ok", database: "ok" },
  });
});

test("authenticated owner can open canonical tenant workspaces", async ({ page }) => {
  await page.goto("/dashboard/workspace");
  await expect(page).not.toHaveURL(/\/sign-in/);
  await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toBeVisible();

  for (const path of ["crm", "batches/workspace", "assessments/workspace", "attendance/workspace", "fees/workspace"]) {
    await page.goto(`/dashboard/${path}`);
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByText(/Forbidden|temporarily unavailable/i)).toHaveCount(0);
  }
});

test("organization APIs work for the authorized tenant", async ({ request }) => {
  for (const resource of ["academic", "crm", "attendance", "finance", "subscription"]) {
    const response = await request.get(`/api/organizations/${organizationSlug}/${resource}`);
    expect(response.status(), `${resource} should be available`).toBe(200);
  }
});

test("the same owner session cannot cross tenant boundaries", async ({ request }) => {
  for (const resource of ["academic", "crm", "attendance", "finance", "subscription"]) {
    const response = await request.get(`/api/organizations/${forbiddenOrganizationSlug}/${resource}`);
    expect(response.status(), `${resource} must reject cross-tenant access`).toBe(403);
  }
});

test("unscoped legacy tenant APIs are retired", async ({ request }) => {
  for (const path of ["admissions", "analytics", "assessments", "attendance", "batches", "fees", "questions", "students"]) {
    const response = await request.get(`/api/${path}`);
    expect(response.status(), `${path} must not expose unscoped production data`).toBe(410);
  }
});
