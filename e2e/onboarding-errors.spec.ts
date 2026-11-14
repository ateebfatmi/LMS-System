import { expect, test } from "@playwright/test";

test("the retired onboarding API cannot create an institute", async ({ request }) => {
  const response = await request.post("/api/onboarding/institute", {
    data: { slug: "unauthorized", ownerUserId: "user_injected" },
  });
  expect(response.status()).toBe(410);
  expect(response.headers()["content-type"]).toContain("application/json");
});

test("public provisioning pages redirect to common sign-in", async ({ page }) => {
  for (const path of ["/onboarding", "/sign-up", "/sign-up?invite=forged&__clerk_ticket=forged", "/admin/login"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Your institute workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: /create (account|institute|workspace)|sign up/i })).toHaveCount(0);
  }
});
