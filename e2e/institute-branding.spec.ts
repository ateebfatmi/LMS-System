import { expect, test, type Page } from "@playwright/test";

const first = { id: "institute-a", slug: "academy-a", name: "Apex Academy", logoUrl: null, accentColor: null };
const second = { id: "institute-b", slug: "academy-b", name: "Summit Institute", logoUrl: null, accentColor: "#2563EB" };

function analytics(role: string, batchName: string) {
  return {
    role,
    summary: { students: null, activeBatches: 1, attendanceRate: null, assessmentAverage: null, assignments: 0, submittedAssignments: 0 },
    batches: [{ id: batchName, name: batchName, target_exam: "JEE", grade_level: null, student_count: 10 }],
    attendanceTrend: [], attempts: [], assignments: [],
  };
}

async function mockDashboard(page: Page, role: string) {
  await page.route("**/api/organizations", (route) => route.fulfill({ json: { organizations: [first, second] } }));
  await page.route("**/api/organizations/active", (route) => route.fulfill({ json: { organization: first, role } }));
  await page.route("**/api/organizations/*/invitations", (route) => route.fulfill({ json: { invitations: [] } }));
  await page.route("**/api/organizations/*/analytics", (route) => route.fulfill({ json: analytics(role, "Apex batch") }));
}

for (const [role, navigation] of [
  ["OWNER", "Overview"],
  ["COACHING_ADMIN", "Overview"],
  ["TEACHER", "My Overview"],
  ["STUDENT", "Home"],
  ["PARENT", "Home"],
]) {
  test(`${role} sees the institute identity and their existing navigation`, async ({ page }) => {
    await mockDashboard(page, role);
    await page.goto("/dashboard/workspace");
    const identity = page.getByRole("link", { name: "Apex Academy overview" });
    await expect(identity).toBeVisible();
    await expect(identity.locator(".institute-mark")).toHaveText("AA");
    await expect(page.getByRole("heading", { name: "Welcome to Apex Academy" })).toBeVisible();
    await expect(page.getByText("Powered by Prepzii", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Dashboard navigation" }).getByRole("link", { name: navigation, exact: true })).toBeVisible();

    if (role !== "OWNER") {
      await page.goto("/dashboard/members");
      await expect(page.getByRole("heading", { name: "Settings & access" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Institute Branding" })).toHaveCount(0);
    }
  });
}

test("owner saves branding and sees it across settings and overview on mobile", async ({ page }) => {
  await mockDashboard(page, "OWNER");
  let organization: { id: string; slug: string; name: string; logoUrl: string | null; accentColor: string | null } = first;
  await page.route("**/api/organizations/active", (route) => route.fulfill({ json: { organization, role: "OWNER" } }));
  await page.route("**/api/organizations/academy-a/branding", async (route) => {
    const body = route.request().postData() ?? "";
    expect(body).toContain("Apex Learning Centre");
    expect(body).toContain("#2563EB");
    expect(body).toContain('filename="logo.png"');
    organization = { ...first, name: "Apex Learning Centre", accentColor: "#2563EB", logoUrl: "/api/organizations/academy-a/branding/logo?v=new" };
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/organizations/academy-a/branding/logo?*", (route) => route.fulfill({
    contentType: "image/png", body: logoPng,
  }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/members");
  await page.getByLabel("Institute name").fill("Apex Learning Centre");
  await page.getByLabel("Accent color").fill("#2563EB");
  await page.getByLabel("Institute logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logoPng });
  await page.getByRole("button", { name: "Save branding" }).click();
  await expect(page.getByText("Institute branding saved.")).toBeVisible();
  await expect(page.locator(".mobile-brand")).toContainText("Apex Learning Centre");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto("/dashboard/workspace");
  const welcome = page.getByRole("region", { name: "Welcome to Apex Learning Centre" });
  await expect(welcome).toBeVisible();
  await expect(welcome.locator("img")).toHaveJSProperty("naturalWidth", 1);
  await expect(welcome).toHaveCSS("border-inline-start-color", "rgb(37, 99, 235)");
});

test("switching institutes clears the previous identity and data while the request is pending", async ({ page }) => {
  await mockDashboard(page, "TEACHER");
  let switched = false;
  let finishSwitch!: () => void;
  const pending = new Promise<void>((resolve) => { finishSwitch = resolve; });
  await page.route("**/api/organizations/active", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ slug: second.slug });
      await pending;
      switched = true;
    }
    await route.fulfill({ json: switched
      ? { organization: second, role: "COACHING_ADMIN" }
      : { organization: first, role: "TEACHER" } });
  });
  await page.route("**/api/organizations/academy-b/analytics", (route) => route.fulfill({ json: analytics("COACHING_ADMIN", "Summit batch") }));

  await page.goto("/dashboard/workspace");
  await expect(page.getByText("Apex batch", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch institute workspace" }).click();
  await page.getByRole("option", { name: /Summit Institute/ }).click();
  try {
    await expect(page.getByText("Switching institute…", { exact: true })).toBeVisible();
    await expect(page.getByText("Apex batch", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Welcome to Apex Academy" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Apex Academy overview" })).toHaveCount(0);
  } finally {
    finishSwitch();
  }
  await expect(page.getByRole("heading", { name: "Welcome to Summit Institute" })).toBeVisible();
  await expect(page.getByText("Summit batch", { exact: true })).toBeVisible();
  await expect(page.getByText("Apex batch", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

const logoPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNQTX79HwAElwJzdIqk6AAAAABJRU5ErkJggg==", "base64");
