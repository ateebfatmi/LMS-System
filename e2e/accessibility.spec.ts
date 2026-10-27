import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/onboarding", "/sign-in", "/sign-up", "/dashboard/workspace"];

for (const route of publicRoutes) {
  test(`${route} has no serious or critical WCAG violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: "load" });
    await expect(page.locator("h1").first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((violation) =>
      violation.impact === "critical" || violation.impact === "serious",
    );

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

test("keyboard focus remains visible on primary navigation", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

  for (let attempt = 0; attempt < 10 && (await page.locator(":focus-visible").count()) === 0; attempt += 1) {
    await page.keyboard.press("Tab");
  }

  const focused = page.locator(":focus-visible");
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.outlineStyle}:${style.outlineWidth}:${style.boxShadow}`;
  });
  expect(outline).not.toBe("none:0px:none");
});
