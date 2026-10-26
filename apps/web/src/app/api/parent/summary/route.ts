import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError, getErrorMessage } from "@/lib/dal/auth-context";
import { ParentRepository } from "@/lib/dal/parent-repository";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(["PARENT", "OWNER", "COACHING_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId") || "std-1";

    const profile = await ParentRepository.getChildAcademicSummary(auth.organizationId, auth.userId, studentId);
    return NextResponse.json(profile);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load child profile") }, { status: 500 });
  }
}
