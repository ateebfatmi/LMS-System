import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3005",
    trace: "on-first-retry",
    headless: true,
  },
  webServer: {
    command: "npm run build --workspace @prepzii-b2b/web && npm run start --workspace @prepzii-b2b/web -- -p 3005",
    url: "http://localhost:3005/api/health",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      DEPLOYMENT_ENV: "development",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      ALLOW_INSECURE_DEV_AUTH: "false",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
