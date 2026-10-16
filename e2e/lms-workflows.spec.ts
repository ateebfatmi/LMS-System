import { test, expect } from "@playwright/test";

test.describe("PrepZii LMS Core Workflows", () => {
  test("1. Landing page renders branding, features, and accepts demo requests", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PrepZii/i);

    // Verify key sections and value proposition
    await expect(page.locator("text=PrepZii for Institutes")).toBeVisible();
    await expect(page.locator("text=JEE & NEET")).toBeVisible();
    await expect(page.locator("text=Schedule a Leadership Demo")).toBeVisible();

    // Fill demo request form
    const form = page.locator("form").first();
    await page.fill('input[placeholder*="Name"], input[name="name"]', "Director Sharma");
    await page.fill('input[placeholder*="Academy"], input[name="instituteName"]', "Sharma IIT Academy");
    await page.fill('input[placeholder*="email"], input[type="email"]', "director@sharmaacademy.in");
    await page.fill('input[placeholder*="phone"], input[type="tel"]', "9876543210");
    await page.fill('input[placeholder*="Kota"], input[name="city"]', "Kota");

    await form.locator('button[type="submit"]').click();

    // Verify submission result
    await expect(page.locator("text=Demo Request Received")).toBeVisible({ timeout: 10000 });
  });

  test("2. Institute Onboarding page displays multi-step wizard", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.locator("text=Register Your Coaching Institute")).toBeVisible();
    await expect(page.locator("text=Institute Name")).toBeVisible();
    await expect(page.locator("text=Primary Focus")).toBeVisible();
  });

  test("3. Executive Dashboard renders metrics and navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Executive Command Center")).toBeVisible();
    await expect(page.locator("text=Active Students")).toBeVisible();
    await expect(page.locator("text=Fee Realization")).toBeVisible();

    // Verify sidebar navigation links
    await expect(page.locator('a[href="/dashboard/crm"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/assessments"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/fees"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/attendance"]')).toBeVisible();
  });

  test("4. Admissions CRM displays pipeline and lead stages", async ({ page }) => {
    await page.goto("/dashboard/crm");
    await expect(page.locator("text=Admissions Pipeline & Lead Tracker")).toBeVisible();
    await expect(page.locator("text=New Leads")).toBeVisible();
    await expect(page.locator("text=Counselling")).toBeVisible();
    await expect(page.locator("text=Enrolled")).toBeVisible();
  });

  test("5. Academic Management (Batches, Courses, Campuses)", async ({ page }) => {
    // Batches
    await page.goto("/dashboard/batches");
    await expect(page.locator("text=Batch Planner")).toBeVisible();

    // Courses
    await page.goto("/dashboard/courses");
    await expect(page.locator("text=Course Catalog")).toBeVisible();

    // Campuses
    await page.goto("/dashboard/campuses");
    await expect(page.locator("text=Multi-Campus Operations")).toBeVisible();
  });

  test("6. CBT Mock Exam Simulator", async ({ page }) => {
    await page.goto("/dashboard/assessments");
    await expect(page.locator("text=Online Test Center")).toBeVisible();
    await expect(page.locator("text=JEE Main Full Mock")).toBeVisible();
    await expect(page.locator("text=Start Mock Test")).toBeVisible();

    // Launch simulation
    await page.click("text=Start Mock Test");
    await expect(page.locator("text=Question 1 of")).toBeVisible();
    await expect(page.locator("text=Question Palette")).toBeVisible();

    // Select an option and save
    const firstOption = page.locator('input[type="radio"]').first();
    if (await firstOption.isVisible()) {
      await firstOption.check();
      await page.click("text=Save & Next");
    }
  });

  test("7. Attendance Counter and Records", async ({ page }) => {
    await page.goto("/dashboard/attendance");
    await expect(page.locator("text=Daily Attendance Ledger")).toBeVisible();
    await expect(page.locator("text=Roster")).toBeVisible();
  });

  test("8. Fee Management & Invoicing", async ({ page }) => {
    await page.goto("/dashboard/fees");
    await expect(page.locator("text=Fee Schedules & Overdue Ledger")).toBeVisible();
    await expect(page.locator("text=Collection Rate")).toBeVisible();
    await expect(page.locator("text=Installment Schedules")).toBeVisible();
  });

  test("9. Back-Office & Front Desk Cashier", async ({ page }) => {
    await page.goto("/office");
    await expect(page.locator("text=Front Desk & Back-Office Operations")).toBeVisible();
    await expect(page.locator("text=Instant Student & Fee Dues Lookup")).toBeVisible();
    await expect(page.locator("text=Generate Official Fee Receipt")).toBeVisible();

    // Generate receipt
    await page.click("text=Print / Issue Official Receipt");
    await expect(page.locator("text=Receipt Generated Successfully")).toBeVisible();
  });

  test("10. Subscription & SaaS Quota Controls", async ({ page }) => {
    await page.goto("/dashboard/billing");
    await expect(page.locator("text=Subscription & Usage Quotas")).toBeVisible();
    await expect(page.locator("text=Student Enrolment Quota")).toBeVisible();
    await expect(page.locator("text=Campus Locations")).toBeVisible();
    await expect(page.locator("text=AI Generation Credits")).toBeVisible();
  });

  test("11. Question Bank with Latex Solutions", async ({ page }) => {
    await page.goto("/dashboard/question-bank");
    await expect(page.locator("text=Question Bank & PYQ Repository")).toBeVisible();
    await expect(page.locator("text=Physics")).toBeVisible();
    await expect(page.locator("text=Chemistry")).toBeVisible();
  });

  test("12. Platform Super Admin Control Room", async ({ page }) => {
    await page.goto("/super-admin");
    await expect(page.locator("text=Platform Super Admin")).toBeVisible();
    await expect(page.locator("text=MRR")).toBeVisible();
    await expect(page.locator("text=Registered Coaching Institutes")).toBeVisible();
  });
});
