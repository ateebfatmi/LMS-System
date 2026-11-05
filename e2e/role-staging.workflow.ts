import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { expect, test } from "@playwright/test";

const expected = {
  OWNER: ["Institute overview", "Overview"],
  COACHING_ADMIN: ["Institute overview", "Overview"],
  TEACHER: ["My teaching overview", "My Batches"],
  STUDENT: ["My learning overview", "My Courses"],
} as const;

type Role = keyof typeof expected;
type Workspace = { slug: string; userRole: Role };
type Actor = { storageState: string; workspace: string; secondaryWorkspace?: Workspace };
type Fixtures = {
  origin: string;
  accounts: Record<Role, Actor>;
  forbiddenSlug: string;
  teacherUnassignedBatchId: string;
  suspended: { storageState: string; workspace: string };
};

const file = process.env.PREPZII_ROLE_STAGING_FIXTURES;
if (!file || !isAbsolute(file)) throw new Error("Use an absolute path to the external staging fixture manifest.");
const fixture = JSON.parse(readFileSync(file, "utf8")) as Fixtures;
if (fixture.origin !== new URL(process.env.PREPZII_ROLE_STAGING_URL ?? "").origin) {
  throw new Error("Fixture origin and staging target must match.");
}
const fixtureRoles = Object.keys(expected) as Role[];
for (const actor of [...fixtureRoles.map((role) => fixture.accounts[role]), fixture.suspended]) {
  if (!actor || !isAbsolute(actor.storageState) || !actor.workspace) {
    throw new Error("Each staging account needs an absolute Clerk storage-state path and an institute slug.");
  }
}
if (!fixture.accounts.TEACHER.secondaryWorkspace || !fixture.forbiddenSlug ||
    !fixture.teacherUnassignedBatchId) {
  throw new Error("Missing cross-workspace, or unassigned batch fixtures.");
}

for (const role of fixtureRoles) {
  test.describe(role, () => {
    const actor = fixture.accounts[role];
    test.use({ storageState: actor.storageState });

    test("authenticates, selects the correct workspace, and enforces direct API scope", async ({ page, context }) => {
      const request = context.request;
      const me = await request.get("/api/me");
      expect(me.status()).toBe(200);
      const workspaces = (await me.json()).workspaces as Workspace[];
      expect(workspaces).toContainEqual(expect.objectContaining({ slug: actor.workspace, userRole: role }));

      const select = await request.post("/api/organizations/active", { data: { slug: actor.workspace } });
      expect(select.status()).toBe(200);
      expect((await select.json()).role).toBe(role);

      await page.goto("/dashboard");
      const [heading, sidebar] = expected[role];
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Dashboard navigation" }).getByRole("link", { name: sidebar, exact: true })).toBeVisible();
      if (role !== "TEACHER") {
        expect(workspaces).not.toContainEqual(expect.objectContaining({ slug: fixture.forbiddenSlug }));
        expect((await request.get(`/api/organizations/${encodeURIComponent(fixture.forbiddenSlug)}/academic`)).status()).toBe(403);
        expect((await request.post("/api/organizations/active", {
          data: { slug: fixture.forbiddenSlug, role: "OWNER" },
        })).status()).toBe(403);
      }
      expect((await (await request.get("/api/me")).json()).activeWorkspace.slug).toBe(actor.workspace);

      const api = `/api/organizations/${encodeURIComponent(actor.workspace)}`;
      expect((await request.get(`${api}/subscription`)).status()).toBe(role === "OWNER" ? 200 : 403);
      if (role === "TEACHER") {
        expect((await request.get(`${api}/attendance?batchId=${encodeURIComponent(fixture.teacherUnassignedBatchId)}`)).status()).toBe(403);
        const second = actor.secondaryWorkspace!;
        expect(second.userRole).toBe("COACHING_ADMIN");
        expect(workspaces).toContainEqual(expect.objectContaining(second));
        const switched = await request.post("/api/organizations/active", { data: { slug: second.slug } });
        expect(switched.status()).toBe(200);
        expect((await switched.json()).role).toBe("COACHING_ADMIN");
        await page.reload();
        await expect(page.getByRole("heading", { name: "Institute overview" })).toBeVisible();
      }
    });
  });
}

test.describe("suspended membership", () => {
  test.use({ storageState: fixture.suspended.storageState });
  test("Clerk session survives but institute access is revoked", async ({ context }) => {
    const me = await context.request.get("/api/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).workspaces).not.toContainEqual(expect.objectContaining({ slug: fixture.suspended.workspace }));
    expect((await context.request.post("/api/organizations/active", {
      data: { slug: fixture.suspended.workspace },
    })).status()).toBe(403);
  });
});
