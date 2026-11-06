import { expect, test } from "@playwright/test";

test("creating a batch resets the form after success and preserves input after rejection", async ({ page }) => {
  const organization = { id: "test-institute", name: "Test Academy", slug: "test-academy" };
  const data = {
    academicYears: [], campuses: [], subjects: [], courses: [], rooms: [], schedules: [], students: [], faculty: [],
    batches: [] as { id: string; name: string; target_exam: string; is_active: boolean }[],
  };
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route("**/api/organizations", (route) => route.fulfill({ json: { organizations: [organization] } }));
  await page.route("**/api/organizations/active", (route) => route.fulfill({ json: { organization, role: "OWNER" } }));
  let rejectFirstSave = true;
  await page.route("**/api/organizations/test-academy/academic", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: data });
      return;
    }

    expect(route.request().postDataJSON()).toMatchObject({
      action: "CREATE_BATCH",
      payload: { name: "Evening Physics", gradeLevel: "Class 12", targetExam: "JEE_ADVANCED" },
    });
    if (rejectFirstSave) {
      rejectFirstSave = false;
      await route.fulfill({ status: 409, json: { error: "Academic record conflicts with existing data." } });
      return;
    }

    data.batches.push({ id: "batch-1", name: "Evening Physics", target_exam: "JEE_ADVANCED", is_active: true });
    await route.fulfill({ status: 201, json: { result: { id: "batch-1" } } });
  });

  await page.goto("/dashboard/batches/workspace");
  await expect(page.getByText("No records yet.", { exact: false })).toBeVisible();
  const name = page.getByPlaceholder("JEE 12A — Titans");
  const grade = page.getByPlaceholder("Class 12");
  const create = page.getByRole("button", { name: "Create batch" });
  await name.fill("Evening Physics");
  await grade.fill("Class 12");
  await create.click();
  await expect(page.getByRole("alert").filter({ hasText: "Academic record conflicts with existing data." })).toBeVisible();
  await expect(name).toHaveValue("Evening Physics");
  await expect(grade).toHaveValue("Class 12");

  await create.click();
  await expect(page.getByText("Evening Physics", { exact: true })).toBeVisible();
  await expect(name).toHaveValue("");
  await expect(grade).toHaveValue("");
  await expect(create).toBeEnabled();
  expect(pageErrors).toEqual([]);
});
