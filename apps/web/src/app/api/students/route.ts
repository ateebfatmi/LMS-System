import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError, getErrorMessage } from "@/lib/dal/auth-context";
import { BatchRepository } from "@/lib/dal/batch-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER"], orgId);
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId") || undefined;

    const students = await BatchRepository.listStudents(auth.organizationId, batchId);
    return NextResponse.json({ students });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN"], orgId);
    const body = await req.json();

    if (!body.name || !body.batchId || !body.phone) {
      return NextResponse.json({ error: "Student name, batch allocation, and contact phone are required." }, { status: 400 });
    }

    const enrolled = await BatchRepository.enrollStudent({
      organizationId: auth.organizationId,
      batchId: body.batchId,
      name: body.name,
      phone: body.phone,
      parentPhone: body.parentPhone || body.phone,
      rollNumber: body.rollNumber,
    });

    return NextResponse.json({ student: enrolled }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to enroll student") }, { status: 500 });
  }
}
