import { expect, test } from "@playwright/test";

const forgedIdentity = {
  "x-authenticated-user": "user-forged-owner",
  "x-organization-id": "10000000-0000-0000-0000-000000000001",
};

test("protected APIs reject a forged identity even when institute and role are supplied", async ({ request }) => {
  for (const path of [
    "/api/me", "/api/organizations", "/api/organizations/active",
    "/api/organizations/example/attendance", "/api/platform",
    "/api/organizations/example/admissions", "/api/organizations/example/fees",
    "/api/organizations/example/guardians", "/api/organizations/example/question-bank",
  ]) {
    const response = await request.get(path, { headers: forgedIdentity, maxRedirects: 0 });
    expect([401, 503], path).toContain(response.status());
    expect(response.headers()["content-type"]).toContain("application/json");
  }

  for (const path of [
    "/api/invitations/accept", "/api/organizations/active", "/api/platform",
    "/api/organizations/example/admissions", "/api/organizations/example/fees",
    "/api/organizations/example/invitations", "/api/organizations/example/members", "/api/organizations/example/guardians",
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
    await expect(page.getByRole("heading", { name: /your institute workspace/i })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Institute access required" })).toBeVisible();
  }
});

test("platform administration stays protected behind the common sign-in", async ({ request }) => {
  const denied = await request.get("/super-admin", {
    headers: { ...forgedIdentity, accept: "text/html" },
    maxRedirects: 0,
  });
  expect([307, 503]).toContain(denied.status());
  if (denied.status() === 307) {
    expect(new URL(denied.headers().location, denied.url()).pathname).toBe("/sign-in");
  }
});
