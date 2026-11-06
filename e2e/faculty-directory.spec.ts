import { expect, test, type Page } from "@playwright/test";
import type { FacultyTeacher } from "@prepzii/contracts";

const organization = { id: "institute-a", slug: "academy-a", name: "Apex Academy", logoUrl: null };
const batches = [
  { id: "10000000-0000-0000-0000-000000000001", name: "Morning Physics" },
  { id: "10000000-0000-0000-0000-000000000002", name: "Evening Physics" },
];
const memberId = "10000000-0000-0000-0000-000000000003";
const endpoint = `**/api/organizations/${organization.slug}/faculty`;
const teacherProfile = {
  id: memberId, displayName: "Mira Shah", email: "mira@example.invalid", phone: "9876543210",
  subjectSpecialization: "Physics", emailEditable: true, qualification: null, joinedOn: null, status: "PENDING",
  batches: [], schedule: [],
} satisfies FacultyTeacher;

async function mockWorkspace(page: Page, role = "OWNER") {
  await page.route("**/api/organizations", (route) => route.fulfill({ json: { organizations: [organization] } }));
  await page.route("**/api/organizations/active", (route) => route.fulfill({ json: { organization, role } }));
}

test("adds a pending teacher, assigns two batches, and recovers the secure invitation", async ({ page }) => {
  await mockWorkspace(page);
  let teacher: FacultyTeacher | null = null;
  let inviteRequests = 0;
  await page.route(`${endpoint}**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/invite")) {
      expect(request.postDataJSON()).toEqual({ memberId, sendEmail: inviteRequests === 0 });
      inviteRequests += 1;
      if (teacher) teacher = { ...teacher, status: "INVITED" };
      await route.fulfill({ json: { acceptPath: "/invite/test-secure-link", emailSent: false } });
      return;
    }
    if (request.method() === "GET") {
      const search = url.searchParams.get("search") ?? "";
      const visible = teacher && teacher.displayName.toLowerCase().includes(search.toLowerCase()) ? [teacher] : [];
      await route.fulfill({ json: { teachers: visible, total: visible.length, batches, page: 1, pageSize: 25 } });
      return;
    }
    const value = request.postDataJSON();
    if (value.action === "add") {
      expect(value.profile).toEqual({
        displayName: "Mira Shah", email: "mira@example.invalid", phone: "9876543210", subjectSpecialization: "Physics",
      });
      expect(value.batchIds).toEqual([batches[0].id]);
      teacher = { ...teacherProfile, batches: [batches[0]] };
      await route.fulfill({ status: 201, json: { memberId } });
    } else {
      expect(value).toMatchObject({ action: "assign", memberId, batchIds: batches.map(({ id }) => id) });
      teacher = { ...teacherProfile, batches };
      await route.fulfill({ json: { memberId } });
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/teachers");
  await expect(page.locator(".mobile-brand")).toContainText(organization.name);
  await expect(page.getByRole("heading", { name: "No teachers added yet." })).toBeVisible();
  await page.getByRole("button", { name: "Add Your First Teacher" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Mira Shah");
  await dialog.getByLabel("Email", { exact: true }).fill("mira@example.invalid");
  await dialog.getByLabel("Phone").fill("9876543210");
  await dialog.getByLabel("Subject or specialization").fill("Physics");
  await dialog.getByRole("checkbox", { name: "Morning Physics" }).check();
  await dialog.getByRole("button", { name: "Add Teacher" }).click();
  const row = page.getByRole("row", { name: /Mira Shah/ });
  await expect(row).toContainText("Pending");

  await row.getByRole("button", { name: "Assign Batch" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox", { name: "Morning Physics" })).toBeChecked();
  await dialog.getByRole("checkbox", { name: "Evening Physics" }).check();
  await dialog.getByRole("button", { name: "Save assignments" }).click();
  await expect(row).toContainText("Evening Physics");

  await row.getByRole("button", { name: "Invite", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Email invitation" }).click();
  await expect(dialog.getByText(/Email delivery was unavailable/)).toBeVisible();
  await expect(dialog.getByLabel("Secure invitation link")).toHaveValue(/\/invite\/test-secure-link$/);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(row).toContainText("Invited");
  await row.getByRole("button", { name: "Invitation", exact: true }).click();
  await dialog.getByRole("button", { name: "Get secure link" }).click();
  await expect(dialog.getByLabel("Secure invitation link")).toHaveValue(/\/invite\/test-secure-link$/);
  await dialog.getByRole("button", { name: "Close dialog" }).click();

  await row.getByRole("button", { name: "View" }).click();
  await expect(dialog.getByRole("heading", { name: "Teaching responsibilities" })).toBeVisible();
  await expect(dialog.getByText("Evening Physics")).toBeVisible();
  await expect(dialog.getByText("No scheduled teaching slots.")).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.getByRole("textbox", { name: "Search teachers" }).fill("Unmatched name");
  await expect(page.getByRole("heading", { name: "No teachers match your filters." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Your First Teacher" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(row).toBeVisible();
});

test("a coordinator can view faculty but cannot manage them", async ({ page }) => {
  await mockWorkspace(page, "ACADEMIC_COORDINATOR");
  await page.route(`${endpoint}?*`, (route) => route.fulfill({
    json: { teachers: [teacherProfile], total: 1, batches, page: 1, pageSize: 25 },
  }));
  await page.goto("/dashboard/teachers");
  await expect(page.getByRole("button", { name: "View", exact: true })).toBeVisible();
  for (const name of ["Add Teacher", "Import CSV", "Assign Batch", "Edit", "Invite"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
});

test("CSV import explains the errors and shows the committed profile count", async ({ page }) => {
  await mockWorkspace(page);
  await page.route(`${endpoint}?*`, (route) => route.fulfill({
    json: { teachers: [], total: 0, batches, page: 1, pageSize: 25 },
  }));
  await page.route("**/api/organizations/academy-a/member-imports", (route) => {
    const invalid = route.request().postDataJSON().fileName === "invalid.csv";
    return route.fulfill({ json: {
      import: { import_id: "import-a", import_status: invalid ? "INVALID" : "VALIDATED",
        total_rows: 1, valid_rows: invalid ? 0 : 1, invalid_rows: invalid ? 1 : 0 },
      rows: [{ row_number: 2, normalized_data: { displayName: "Mira Shah" }, errors: invalid ? ["Email is invalid."] : [] }],
    } });
  });
  await page.route("**/member-imports/import-a/commit", (route) => route.fulfill({ json: { result: { committed_rows: 1 } } }));

  await page.goto("/dashboard/teachers");
  await page.getByRole("button", { name: "Import CSV" }).click();
  const dialog = page.getByRole("dialog");
  const file = dialog.locator('input[type="file"]');
  await file.setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from("name,email\nMira Shah,invalid") });
  await dialog.getByRole("button", { name: "Validate CSV" }).click();
  await expect(dialog.getByText("Email is invalid.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Import records" })).toBeDisabled();
  await file.setInputFiles({ name: "corrected.csv", mimeType: "text/csv", buffer: Buffer.from("name,email\nMira Shah,mira@example.invalid") });
  await dialog.getByRole("button", { name: "Validate CSV" }).click();
  await dialog.getByRole("button", { name: "Import records" }).click();
  await expect(dialog.getByText(/1 profile imported/)).toBeVisible();
});
