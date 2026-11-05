import { defineConfig } from "@playwright/test";

const target = process.env.PREPZII_ROLE_STAGING_URL;
if (!target || !process.env.PREPZII_ROLE_STAGING_FIXTURES) {
  throw new Error("Set PREPZII_ROLE_STAGING_URL and PREPZII_ROLE_STAGING_FIXTURES for an authorized staging deployment.");
}

const url = new URL(target);
const local = ["localhost", "127.0.0.1"].includes(url.hostname);
if ((!local && url.protocol !== "https:") || url.pathname !== "/" || url.username || url.password ||
    url.search || url.hash || ["prepzii.com", "www.prepzii.com", "institutes.prepzii.com"].includes(url.hostname)) {
  throw new Error("Use an isolated staging origin or loopback. Production origins are excluded.");
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "role-staging.workflow.ts",
  workers: 1,
  use: { baseURL: url.origin, trace: "off", screenshot: "off", video: "off" },
});
