import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { expect, test } from "@playwright/test";

const expected = {
  OWNER: ["Institute overview", "Overview"],
  COACHING_ADMIN: ["Manager overview", "Overview"],
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
  founders?: [Actor, Actor];
  platformProvisioning?: { approvedTestInbox: string };
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
      const canManage = role === "OWNER" || role === "COACHING_ADMIN";
      expect((await request.get(`${api}/admissions`)).status()).toBe(canManage ? 200 : 403);
      expect((await request.get(`${api}/fees`)).status()).toBe(canManage || role === "STUDENT" ? 200 : 403);
      expect((await request.get(`${api}/fees?options=1`)).status()).toBe(canManage ? 200 : 403);
      expect((await request.get(`${api}/guardians`)).status()).toBe(role === "OWNER" || role === "PARENT" ? 200 : 403);
      expect((await request.get(`${api}/question-bank`)).status()).toBe(role === "STUDENT" || role === "PARENT" ? 403 : 200);
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
        await expect(page.getByRole("heading", { name: "Manager overview" })).toBeVisible();
      }
    });
  });
}

test.describe("suspended membership", () => {
  test.use({ storageState: fixture.suspended.storageState });
  test("Clerk session survives but institute access is revoked", async ({ context, page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Institute access required" })).toBeVisible();
    await expect(page.getByRole("button", { name: /create (institute|workspace)/i })).toHaveCount(0);
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

  test("preserves valid invitation paths and blocks retired or external destinations", async ({ context }) => {
    for (const path of [`/invite/${"a".repeat(43)}`]) {
      const response = await context.request.get(`/auth/resolve?return_to=${encodeURIComponent(new URL(path, fixture.origin).href)}`, { maxRedirects: 0 });
      expect(new URL(response.headers().location, fixture.origin).pathname).toBe(path);
    }
    const external = await context.request.get("/auth/resolve?return_to=https%3A%2F%2Fexample.com%2Fdashboard", { maxRedirects: 0 });
    expect(new URL(external.headers().location, fixture.origin).href).toBe(new URL("/dashboard/workspace", fixture.origin).href);
    expect((await context.request.get("/super-admin", { maxRedirects: 0 })).status()).toBe(404);
    expect((await context.request.post("/api/onboarding/institute", { data: {} })).status()).toBe(410);
    expect((await context.request.post("/api/platform", { data: { action: "CREATE_INSTITUTE", payload: {} } })).status()).toBe(403);
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


test("founder sessions land in platform administration despite a remembered institute", async ({ browser }) => {
  test.skip(fixture.founders?.length !== 2, "Requires two authorized Clerk founder storage states.");
  const founderUserIds = new Set<string>();
  for (const founder of fixture.founders ?? []) {
    expect(isAbsolute(founder.storageState)).toBe(true);
    const context = await browser.newContext({ storageState: founder.storageState, baseURL: fixture.origin });
    try {
      await context.addCookies([{
        name: "prepzii_active_organization",
        value: founder.workspace || fixture.accounts.OWNER.workspace,
        url: fixture.origin,
        httpOnly: true,
      }]);
      const me = await context.request.get("/api/me");
      expect(me.status()).toBe(200);
      const { userId } = await me.json() as { userId: string };
      expect(Boolean(userId)).toBe(true);
      founderUserIds.add(userId);
      for (const path of [
        "/auth/resolve",
        "/auth/resolve?return_to=%2Fdashboard%2Fworkspace",
        `/auth/resolve?return_to=${encodeURIComponent(`/invite/${"a".repeat(43)}`)}`,
        "/dashboard/workspace",
      ]) {
        const landing = await context.request.get(path, { maxRedirects: 0 });
        expect(landing.status()).toBe(307);
        expect(new URL(landing.headers().location, fixture.origin).pathname).toBe("/super-admin");
      }
      const page = await context.newPage();
      await page.goto("/sign-in?workspace=choose");
      await expect(page).toHaveURL(/\/super-admin$/);
      const navigation = page.getByRole("navigation", { name: "Super Admin navigation" });
      for (const [label, heading] of [
        ["Overview", "Overview"], ["Institutes", "Institutes"], ["Invitations", "Owner invitations"],
        ["Subscriptions", "Subscriptions"], ["Demo Leads & Sales", "Demo Leads & B2B Sales"],
        ["Platform Settings", "Platform Settings"], ["System Broadcasts", "System Broadcasts"],
        ["Support Access", "Support Access"], ["Audit Logs", "Audit Logs"],
      ]) {
        await navigation.getByRole("link", { name: label }).click();
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      }
      expect((await context.request.get("/super-admin")).status()).toBe(200);
      const platform = await context.request.get("/api/platform");
      expect(platform.status()).toBe(200);
      const platformData = await platform.json();
      for (const collection of ["institutes", "subscriptions", "plans", "demoRequests", "flags",
        "overrides", "supportRequests", "audits", "counts", "brandings", "ownerInvitations"]) {
        expect(Array.isArray(platformData[collection]), collection).toBe(true);
      }
      expect(platformData.ownerProvisioningReady).toBe(true);
      const workspace = (await me.json()).workspaces.find(({ slug }: Workspace) => slug === founder.workspace);
      if (workspace) {
        expect((await context.request.post("/api/organizations/active", {
          data: { slug: workspace.slug, fromPlatform: true },
        })).status()).toBe(200);
        const institute = await context.request.get("/dashboard/workspace", { maxRedirects: 0 });
        expect(institute.status()).toBe(200);
        const resolved = await context.request.get("/auth/resolve", { maxRedirects: 0 });
        expect(new URL(resolved.headers().location, fixture.origin).pathname).toBe("/super-admin");
      }
    } finally {
      await context.close();
    }
  }
  expect(founderUserIds.size).toBe(2);
});

test("staging registration persists an institute, trial, owner invite and audit", async ({ browser }) => {
  const inbox = fixture.platformProvisioning?.approvedTestInbox;
  const founder = fixture.founders?.[0];
  test.skip(!inbox || !founder, "Requires a founder Clerk session and an approved test inbox for one Clerk invitation.");
  if (!inbox || !founder) return;
  const context = await browser.newContext({ storageState: founder.storageState, baseURL: fixture.origin });
  try {
    const slug = `platform-qa-${randomUUID()}`;
    const registration = await context.request.post("/api/platform", { data: {
      action: "CREATE_INSTITUTE",
      payload: { name: "Platform QA institute", slug, ownerEmail: inbox, planId: "basic", subscriptionStatus: "TRIAL" },
    } });
    expect(registration.status()).toBe(201);
    const { result } = await registration.json();
    const platform = await context.request.get("/api/platform");
    expect(platform.status()).toBe(200);
    const snapshot = await platform.json();
    expect(snapshot.institutes.some((row: { id: string; slug: string }) =>
      row.id === result.organizationId && row.slug === slug)).toBe(true);
    expect(snapshot.subscriptions.some((row: { organization_id: string; status: string }) =>
      row.organization_id === result.organizationId && row.status === "TRIAL")).toBe(true);
    expect(snapshot.ownerInvitations.some((row: { organization_id: string; status: string; delivered: boolean }) =>
      row.organization_id === result.organizationId && row.status === "PENDING" && row.delivered)).toBe(true);
    expect(snapshot.audits.some((row: { target_organization_id: string; action: string }) =>
      row.target_organization_id === result.organizationId && row.action === "create_organization")).toBe(true);
    expect(result.emailSent).toBe(true);
  } finally {
    await context.close();
  }
});
