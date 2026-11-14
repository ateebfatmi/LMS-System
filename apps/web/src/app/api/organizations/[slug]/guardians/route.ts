import { z } from "zod";
import { getOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";
import { guardRateLimit } from "@/lib/rate-limit";

type Context = { params: Promise<{ slug: string }> };
type Member = { id: string; user_id: string; role: string; email: string; status: string };

const review = z.object({
  guardianId: z.uuid(),
  studentId: z.uuid(),
  relationship: z.enum(["FATHER", "MOTHER", "LEGAL_GUARDIAN", "OTHER"]),
  approved: z.boolean(),
});
const headers = { "cache-control": "private, no-store" };

export async function GET(_request: Request, { params }: Context) {
  const workspace = await getOrganizationContext((await params).slug, ["OWNER", "PARENT"]);
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  const { organizationId, userId, role } = workspace.context;
  const db = getPrepziiAdmin();

  if (role === "PARENT") {
    const { data, error } = await db.rpc("lms_guardian_dashboard", { p_org: organizationId, p_guardian: userId });
    if (error) return Response.json({ error: "Unable to load guardian access." }, { status: 503, headers });
    return Response.json({ links: data }, { headers });
  }

  const links = db.from("organization_guardian_links").select("id,guardian_user_id,student_user_id,relationship,status")
    .eq("organization_id", organizationId);
  const { data, error } = await links.order("created_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Unable to load guardian access." }, { status: 503, headers });
  if (!data.length) return Response.json({ links: [] }, { headers });

  const memberIds = [...new Set(data.flatMap((link) => [link.guardian_user_id, link.student_user_id]))];
  const members = await db.from("institute_members").select("id,user_id,role,email,status")
    .eq("institute_id", organizationId).in("user_id", memberIds).in("role", ["PARENT", "STUDENT"])
    .returns<Member[]>();
  if (members.error) return Response.json({ error: "Unable to load guardian access." }, { status: 503, headers });
  const activeStudents = new Map(members.data.filter((member) => member.role === "STUDENT" && member.status === "ACTIVE")
    .map((member) => [member.user_id, member]));
  const guardians = new Map(members.data.filter((member) => member.role === "PARENT").map((member) => [member.user_id, member]));
  const profiles = activeStudents.size
    ? await db.from("organization_member_profiles").select("membership_id,display_name")
      .eq("organization_id", organizationId).in("membership_id", [...activeStudents.values()].map((member) => member.id))
    : { data: [], error: null };
  if (profiles.error) return Response.json({ error: "Unable to load guardian access." }, { status: 503, headers });
  const names = new Map(profiles.data.map((profile) => [profile.membership_id, profile.display_name]));
  return Response.json({ links: data.flatMap((link) => {
    const student = activeStudents.get(link.student_user_id);
    const guardian = guardians.get(link.guardian_user_id);
    if (!student || !guardian) return [];
    return [{
      id: link.id, studentId: student.id, studentName: names.get(student.id) || student.email,
      guardianId: guardian?.id, guardianEmail: guardian?.email,
      relationship: link.relationship, status: link.status,
    }];
  }) }, { headers });
}

export async function POST(request: Request, { params }: Context) {
  const workspace = await getOrganizationContext((await params).slug, ["OWNER"]);
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  const parsed = review.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid guardian review." }, { status: 400, headers });

  const { organizationId, userId } = workspace.context;
  const limited = await guardRateLimit({ request, scope: "guardian-review", subject: userId, limit: 60, windowSeconds: 3600 });
  if (limited) return limited;
  const value = parsed.data;
  const { data, error } = await getPrepziiAdmin().rpc("lms_review_invited_guardian", {
    p_org: organizationId, p_actor: userId, p_guardian: value.guardianId, p_student: value.studentId,
    p_relationship: value.relationship, p_approved: value.approved,
  });
  if (error) return Response.json({ error: "Unable to review guardian access." }, {
    status: error.code === "42501" ? 403 : 503, headers,
  });
  return Response.json({ id: data }, { headers });
}
