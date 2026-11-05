import { expect, test } from "@playwright/test";

test("signed-out onboarding requests return JSON", async ({ request }) => {
  const response = await request.post("/api/onboarding/institute", { data: {} });
  // Unconfigured local UI development must also fail before entering the handler.
  expect([401, 503]).toContain(response.status());
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(typeof (await response.json()).error).toBe("string");
});

for (const failure of ["empty", "network", "unauthorized"] as const) {
  test(`onboarding recovers from ${failure} responses`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    // Use the existing development-only page preview to exercise the form.
    // The POST is intercepted, so these tests never create an institute.
    await page.route("**/api/onboarding/institute", async (route) => {
      if (failure === "network") return route.abort("failed");
      if (failure === "unauthorized") {
        return route.fulfill({ status: 401, json: { error: "Please sign in again." } });
      }
      return route.fulfill({ status: 500, body: "" });
    });

    await page.goto("/onboarding");
    await page.getByLabel("Institute name").fill("Onboarding test");
    await page.getByLabel("Contact phone").fill("9876543210");
    await page.getByLabel("City", { exact: true }).fill("Kota");
    await page.getByLabel("State", { exact: true }).fill("Rajasthan");
    const submit = page.getByRole("button", { name: /Create institute workspace/ });
    await submit.click();

    await expect(page.locator("form").getByRole("alert")).toHaveText(
      failure === "network"
        ? "Unable to reach the server. Please check your connection and try again."
        : failure === "unauthorized"
          ? "Please sign in again."
          : "Unable to create the institute. Please try again.",
    );
    await expect(submit).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });
}
