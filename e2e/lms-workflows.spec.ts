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

  test("one mobile-friendly sign-in is shared by institute users", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "Your institute workspace" })).toBeVisible();
    await expect(page.locator('a[href^="/sign-up"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /platform|faculty|institute admin/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });

  test("legacy institute sign-in URLs preserve invitation return links", async ({ page }) => {
    const invitation = `/invite/${"a".repeat(43)}`;
    for (const path of ["/institute/login", "/portal/login"]) {
      await page.goto(`${path}?return_to=${encodeURIComponent(invitation)}`);
      await expect(page).toHaveURL((url) =>
        url.pathname === "/sign-in" && url.searchParams.get("return_to") === invitation,
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
    await expect(page).toHaveURL(/\/dashboard\/admissions$/);
    await expect(page.getByRole("heading", { name: "Institute access required" })).toBeVisible();

    await page.goto("/dashboard/assessments");
    await expect(page).toHaveURL(/\/dashboard\/assessments\/workspace$/);
  });

  test("accounts without an institute see setup guidance instead of tenant tools", async ({ page }) => {
    await page.goto("/dashboard/workspace");
    await expect(page.getByRole("heading", { name: "Institute access required" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create institute" })).toHaveCount(0);
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

test("assessment authors can filter and page through live question bank subjects", async ({ page }) => {
  const organization = { id: "academy-id", slug: "academy", name: "Academy" };
  await page.route("**/api/organizations/active", (route) => route.fulfill({
    json: { organization, role: "TEACHER" },
  }));
  const workspaceRequests: string[] = [];
  await page.route("**/api/organizations/academy/assessments?*", (route) => {
    workspaceRequests.push(route.request().url());
    return route.fulfill({ json: {
      role: "TEACHER", tests: [], schedules: [], attempts: [], descriptiveSubmissions: [], batches: [], testQuestions: [],
    } });
  });
  await page.route("**/api/organizations/academy/question-bank?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("view") === "subjects") {
      return route.fulfill({ json: { subjects: ["Geography"] } });
    }
    const subject = params.get("subject");
    const search = params.get("q");
    const pageNumber = params.get("page");
    const question = { id: "q", exam: "OTHER", chapter: "Rivers", difficulty: "medium", marks: 2 };
    return route.fulfill({ json: {
      questions: [{ ...question, question_text: search ? "Search match" : subject ? `Geography result ${pageNumber}` : "Initial result" }],
      total: search ? 1 : 41,
    } });
  });

  await page.goto("/dashboard/assessments/workspace");
  await expect(page.getByText("Initial result")).toBeVisible();
  await page.getByLabel("Question bank subject").click();
  await page.getByRole("option", { name: "Geography" }).click();
  await expect(page.getByText("Geography result 1")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Geography result 2")).toBeVisible();
  await page.getByRole("textbox", { name: "Search questions" }).fill("rivers");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Search match")).toBeVisible();
  expect(workspaceRequests).toHaveLength(1);
  expect(new URL(workspaceRequests[0]).searchParams.get("includeBank")).toBe("0");
});

test("new attendance sessions require explicit marks and existing sessions load their own records", async ({ page }) => {
  const organization = { id: "attendance-org", slug: "attendance-test", name: "Attendance Academy" };
  await page.route("**/api/organizations/active", (route) => route.fulfill({ json: { organization, role: "TEACHER" } }));
  let submitted: object | undefined;
  await page.route("**/api/organizations/attendance-test/attendance**", (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { result: { sessionId: "new", changeCount: 1 } } });
    }
    const date = new URL(route.request().url()).searchParams.get("date");
    const sessions = [
      { id: "first", session_label: "Morning", starts_at: "08:00", ends_at: "09:00" },
      { id: "second", session_label: "Afternoon", starts_at: "15:00", ends_at: "16:00" },
      ...(submitted ? [{ id: "new", session_label: "Workshop", starts_at: null, ends_at: null }] : []),
    ].map((session) => ({ ...session, session_date: date, finalized_at: date, batch_id: "batch" }));
    return route.fulfill({ json: {
      role: "TEACHER", selectedBatchId: "batch", batches: [{ id: "batch", name: "Batch" }],
      students: [{ user_id: "student", display_name: "Student One" }], sessions, corrections: [],
      records: [
        { id: "r1", session_id: "first", student_id: "student", status: "ABSENT" },
        { id: "r2", session_id: "second", student_id: "student", status: "LATE" },
      ],
    } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/attendance/workspace");
  const status = page.getByRole("button", { name: "Attendance for Student One" });
  const session = page.getByRole("button", { name: "Attendance session" });
  const save = page.getByRole("button", { name: "Save register" });
  await expect(status).toHaveText("ABSENT");
  await session.click();
  await page.getByRole("option", { name: /Afternoon/ }).click();
  await expect(status).toHaveText("LATE");
  await expect(session).toHaveAttribute("aria-expanded", "false");
  await session.click();
  await page.getByRole("option", { name: "New session" }).click();
  await expect(status).toHaveText("Unmarked");
  await page.getByRole("textbox", { name: "Session name" }).fill("Workshop");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Mark all present" }).click();
  await save.click();
  await expect(page.getByText("1 attendance entries saved.")).toBeVisible();
  expect(submitted).toMatchObject({
    sessionLabel: "Workshop", startsAt: null, endsAt: null,
    records: [{ studentId: "student", status: "PRESENT" }],
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
