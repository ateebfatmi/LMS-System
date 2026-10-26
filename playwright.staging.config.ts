import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.STAGING_BASE_URL;
const storageState = process.env.STAGING_STORAGE_STATE;

if (!baseURL || !storageState) {
  throw new Error("STAGING_BASE_URL and STAGING_STORAGE_STATE are required for staging acceptance tests.");
}

export default defineConfig({
  testDir: "./staging-e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  reporter: "list",
  use: {
    baseURL,
    storageState,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "staging-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
