import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { expect, test } from "@playwright/test";

const expected = {
  OWNER: ["Institute overview", "Overview"],
  COACHING_ADMIN: ["Institute overview", "Overview"],
  TEACHER: ["My teaching overview", "My Batches"],
  STUDENT: ["My learning overview", "My Courses"],
  PARENT: ["Parent overview", "Announcements"],
} as const;

type Role = keyof typeof expected;
type Workspace = { slug: string; userRole: Role };
type Branding = { name: string; accentColor: string | null; logoUrl: string | null };
type Actor = { storageState: string; workspace: string; secondaryWorkspace?: Workspace };
type Fixtures = {
  origin: string;
  allowBrandingWrites?: boolean;
  facultyOnboarding?: {
    email: string;
    storageState: string;
    batchName: string;
    unassignedBatchId: string;
    unassignedBatchName: string;
  };
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

      if (role === "TEACHER") {
        // A remembered selection must still prompt users with multiple memberships.
        expect((await request.post("/api/organizations/active", { data: { slug: actor.workspace } })).status()).toBe(200);
      }

      await page.goto("/sign-in");
      if (role === "TEACHER") {
        await expect(page.getByRole("heading", { name: "Choose your workspace" })).toBeVisible();
        expect((await (await request.get("/api/me")).json()).activeWorkspace).toBeNull();
        await page.getByRole("button", { name: /select a workspace/i }).click();
        await page.getByRole("option").filter({ has: page.getByText(actor.workspace, { exact: true }) }).click();
      }

      await expect(page).toHaveURL(/\/dashboard\/workspace$/);
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
      const active = (await (await request.get("/api/organizations/active")).json()).organization as Branding;
      await expect(page.getByRole("heading", { name: `Welcome to ${active.name}`, exact: true })).toBeVisible();

      expect((await request.get("/api/platform")).status()).toBe(403);

      const api = `/api/organizations/${encodeURIComponent(actor.workspace)}`;
      expect((await request.get(`${api}/subscription`)).status()).toBe(role === "OWNER" ? 200 : 403);
      if (role !== "OWNER") {
        expect((await request.post(`${api}/branding`, {
          multipart: { name: "Forbidden branding write", accentColor: "#2563EB", logoAction: "keep" },
        })).status()).toBe(403);
      }
      if (role === "TEACHER") {
        expect((await request.get(`${api}/attendance?batchId=${encodeURIComponent(fixture.teacherUnassignedBatchId)}`)).status()).toBe(403);
        const second = actor.secondaryWorkspace!;
        expect(second.userRole).toBe("COACHING_ADMIN");
        expect(workspaces).toContainEqual(expect.objectContaining(second));
        await page.getByRole("button", { name: "Switch institute workspace" }).click();
        const switchedResponse = page.waitForResponse((response) =>
          response.url().endsWith("/api/organizations/active") && response.request().method() === "POST");
        await page.getByRole("option").filter({ has: page.getByText(second.slug, { exact: true }) }).click();
        const switched = await switchedResponse;
        expect(switched.status()).toBe(200);
        const result = await switched.json() as { role: Role; organization: Branding };
        expect(result.role).toBe("COACHING_ADMIN");
        expect(result.organization.name).not.toBe(active.name);
        await expect(page.getByRole("heading", { name: `Welcome to ${result.organization.name}` })).toBeVisible();
        await expect(page.getByRole("heading", { name: `Welcome to ${active.name}` })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Institute overview" })).toBeVisible();
      }
    });
  });
}

test.describe("suspended membership", () => {
  test.use({ storageState: fixture.suspended.storageState });
  test("Clerk session survives but institute access is revoked", async ({ context, page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "No active workspace" })).toBeVisible();
    const me = await context.request.get("/api/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).workspaces).not.toContainEqual(expect.objectContaining({ slug: fixture.suspended.workspace }));
    expect((await context.request.post("/api/organizations/active", {
      data: { slug: fixture.suspended.workspace },
    })).status()).toBe(403);
  });
});

test.describe("sign-in return paths", () => {
  test.use({ storageState: fixture.accounts.OWNER.storageState });

  test("returns to invitations and onboarding, blocks external return URLs and platform access", async ({ context }) => {
    for (const path of ["/invite/example", "/onboarding"]) {
      const response = await context.request.get(`/auth/resolve?return_to=${encodeURIComponent(new URL(path, fixture.origin).href)}`, { maxRedirects: 0 });
      expect(new URL(response.headers().location, fixture.origin).pathname).toBe(path);
    }
    const external = await context.request.get("/auth/resolve?return_to=https%3A%2F%2Fexample.com%2Fdashboard", { maxRedirects: 0 });
    expect(new URL(external.headers().location, fixture.origin).href).toBe(new URL("/dashboard/workspace", fixture.origin).href);
    expect((await context.request.get("/super-admin", { maxRedirects: 0 })).status()).toBe(404);
  });
});

test.describe("owner branding writes", () => {
  test.use({ storageState: fixture.accounts.OWNER.storageState });

  test("validates uploads, updates the shared workspace, and restricts logo access", async ({ browser, context, page }) => {
    test.skip(fixture.allowBrandingWrites !== true, "Requires a disposable institute fixture with no logo.");
    const request = context.request;
    const slug = fixture.accounts.OWNER.workspace;
    const api = `/api/organizations/${encodeURIComponent(slug)}/branding`;
    expect((await request.post("/api/organizations/active", { data: { slug } })).status()).toBe(200);
    const original = (await (await request.get("/api/organizations/active")).json()).organization as Branding;
    expect(original.logoUrl).toBeNull();
    const name = `Branding rehearsal ${Date.now()}`;
    const logo = {
      name: "rehearsal.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNQTX79HwAElwJzdIqk6AAAAABJRU5ErkJggg==", "base64"),
    };

    expect((await request.post(api, { multipart: {
      name, accentColor: "#2563EB", logoAction: "replace", logo: { ...logo, buffer: Buffer.from("not an image") },
    } })).status()).toBe(400);
    expect((await request.post(`/api/organizations/${encodeURIComponent(fixture.forbiddenSlug)}/branding`, {
      multipart: { name, accentColor: "#2563EB", logoAction: "keep" },
    })).status()).toBe(403);

    try {
      await page.goto("/dashboard/members");
      await page.getByLabel("Institute name").fill(name);
      await page.getByLabel("Accent color").fill("#2563EB");
      await page.getByLabel("Institute logo").setInputFiles(logo);
      await page.getByRole("button", { name: "Save branding" }).click();
      await expect(page.getByText("Institute branding saved.")).toBeVisible();

      const updated = (await (await request.get("/api/organizations/active")).json()).organization as Branding;
      expect(updated).toMatchObject({ name, accentColor: "#2563EB" });
      expect(updated.logoUrl).toContain(`${api}/logo?v=`);
      const image = await request.get(updated.logoUrl!);
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"]).toBe("image/webp");
      expect(image.headers()["cache-control"]).toContain("private, no-store");

      const student = await browser.newContext({ storageState: fixture.accounts.STUDENT.storageState });
      const outsider = await browser.newContext({ storageState: fixture.suspended.storageState });
      try {
        expect((await student.request.get(new URL(updated.logoUrl!, fixture.origin).href)).status()).toBe(200);
        expect((await outsider.request.get(new URL(updated.logoUrl!, fixture.origin).href)).status()).toBe(403);
      } finally {
        await Promise.all([student.close(), outsider.close()]);
      }

      await page.getByRole("button", { name: "Remove logo" }).click();
      await page.getByRole("button", { name: "Save branding" }).click();
      await expect(page.getByText("Institute branding saved.")).toBeVisible();
      expect((await request.get(updated.logoUrl!)).status()).toBe(404);
    } finally {
      expect((await request.post(api, { multipart: {
        name: original.name, accentColor: original.accentColor ?? "", logoAction: "remove",
      } })).status()).toBe(204);
    }
  });
});

test.describe("faculty onboarding with real Clerk and Supabase", () => {
  test.use({ storageState: fixture.accounts.OWNER.storageState });

  test("adds, assigns, and activates a teacher with scoped batch access", async ({ browser, context, page }) => {
    const teacherFixture = fixture.facultyOnboarding;
    test.skip(!teacherFixture, "Requires a verified Clerk teacher fixture with no institute membership.");
    if (!teacherFixture) return;
    test.setTimeout(90_000);
    const slug = fixture.accounts.OWNER.workspace;
    const endpoint = `/api/organizations/${encodeURIComponent(slug)}`;
    expect((await context.request.post("/api/organizations/active", { data: { slug } })).status()).toBe(200);

    const teacher = await browser.newContext({ storageState: teacherFixture.storageState });
    const otherAccount = await browser.newContext({ storageState: fixture.accounts.STUDENT.storageState });
    try {
      const teacherApi = (path: string) => new URL(path, fixture.origin).href;
      expect((await teacher.request.get(teacherApi(`${endpoint}/academic`))).status()).toBe(403);

      await page.goto("/dashboard/teachers");
      const displayName = `Staging Faculty ${Date.now()}`;
      await page.getByRole("button", { name: "Add Teacher", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Full name").fill(displayName);
      await dialog.getByLabel("Email", { exact: true }).fill(teacherFixture.email);
      await dialog.getByLabel("Subject or specialization").fill("Physics");
      await dialog.getByRole("button", { name: "Add Teacher", exact: true }).click();
      await page.getByRole("textbox", { name: "Search teachers" }).fill(teacherFixture.email);
      const row = page.getByRole("row").filter({ hasText: displayName });
      await expect(row).toContainText("Pending");
      await row.getByRole("button", { name: "Assign Batch" }).click();
      await dialog.getByRole("checkbox", { name: teacherFixture.batchName, exact: true }).check();
      await dialog.getByRole("button", { name: "Save assignments" }).click();
      await expect(row).toContainText(teacherFixture.batchName);

      const faculty = await context.request.get(`${endpoint}/faculty`, { params: { search: teacherFixture.email } });
      expect(faculty.status()).toBe(200);
      const [record] = (await faculty.json()).teachers as { id: string; status: string }[];
      expect(record.status).toBe("PENDING");
      expect((await context.request.post(`${endpoint}/faculty`, { data: {
        action: "add", profile: { displayName, email: teacherFixture.email, phone: null, subjectSpecialization: null }, batchIds: [],
      } })).status()).toBe(409);
      expect((await otherAccount.request.post(teacherApi(`${endpoint}/faculty`), {
        data: { action: "assign", memberId: record.id, batchIds: [] },
      })).status()).toBe(403);
      expect((await otherAccount.request.post(teacherApi(`${endpoint}/faculty/invite`), {
        data: { memberId: record.id, sendEmail: false },
      })).status()).toBe(403);
      expect((await context.request.get(`/api/organizations/${encodeURIComponent(fixture.forbiddenSlug)}/faculty`)).status()).toBe(403);

      await row.getByRole("button", { name: "Invite", exact: true }).click();
      await dialog.getByRole("button", { name: "Get secure link" }).click();
      const link = dialog.getByLabel("Secure invitation link");
      await expect(link).toBeVisible();
      const inviteUrl = new URL(await link.inputValue());
      expect(inviteUrl.origin).toBe(fixture.origin);
      const duplicate = await context.request.post(`${endpoint}/faculty/invite`, {
        data: { memberId: record.id, sendEmail: false },
      });
      expect(duplicate.status()).toBe(200);
      expect((await duplicate.json()).acceptPath).toBe(inviteUrl.pathname);
      await dialog.getByRole("button", { name: "Close dialog" }).click();
      await expect(row).toContainText("Invited");

      const wrongAccount = await otherAccount.request.post(teacherApi("/api/invitations/accept"), {
        data: { token: decodeURIComponent(inviteUrl.pathname.split("/").at(-1)!) },
      });
      expect(wrongAccount.status()).toBe(404);

      const teacherPage = await teacher.newPage();
      await teacherPage.goto(inviteUrl.href);
      await teacherPage.getByRole("button", { name: /Accept invitation/ }).click();
      await expect(teacherPage.getByRole("link", { name: "My Batches", exact: true })).toBeVisible();
      await teacherPage.getByRole("link", { name: "My Batches", exact: true }).click();
      await expect(teacherPage.getByRole("heading", { name: "Assigned batches" })).toBeVisible();
      await expect(teacherPage.getByText(teacherFixture.batchName, { exact: true })).toBeVisible();
      await expect(teacherPage.getByText(teacherFixture.unassignedBatchName, { exact: true })).toHaveCount(0);
      expect((await teacher.request.get(teacherApi(`${endpoint}/attendance`), {
        params: { batchId: teacherFixture.unassignedBatchId },
      })).status()).toBe(403);

      await page.reload();
      await page.getByRole("textbox", { name: "Search teachers" }).fill(teacherFixture.email);
      await expect(row).toContainText("Active");
      await expect(row.getByRole("button", { name: "Invite", exact: true })).toHaveCount(0);
    } finally {
      await Promise.all([teacher.close(), otherAccount.close()]);
    }
  });
});
