import { expect, test } from "@playwright/test";

const forgedIdentity = {
  "x-authenticated-user": "user-forged-owner",
  "x-organization-id": "10000000-0000-0000-0000-000000000001",
};

test("protected APIs reject a forged identity even when institute and role are supplied", async ({ request }) => {
  for (const path of [
    "/api/me", "/api/organizations", "/api/organizations/active",
    "/api/organizations/example/attendance", "/api/platform",
  ]) {
    const response = await request.get(path, { headers: forgedIdentity, maxRedirects: 0 });
    expect([401, 503], path).toContain(response.status());
    expect(response.headers()["content-type"]).toContain("application/json");
  }

  for (const path of [
    "/api/onboarding/institute", "/api/invitations/accept", "/api/organizations/active",
  ]) {
    const response = await request.post(path, {
      headers: forgedIdentity,
      maxRedirects: 0,
      data: { slug: "example", role: "OWNER", userId: "user-forged-owner" },
    });
    expect([401, 503], path).toContain(response.status());
  }
});

test("a signed-out mobile visitor cannot open a dashboard by supplying a role", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/dashboard?role=DIRECTOR");
  if (response?.status() === 503) {
    await expect(page.getByText("Authentication is not configured.", { exact: false })).toBeVisible();
  } else if (page.url().includes("/sign-in")) {
    await expect(page.getByRole("heading", { name: /choose your sign-in portal/i })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Create your institute to open the workspace" })).toBeVisible();
  }
});
