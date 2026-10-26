import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError, getErrorMessage } from "@/lib/dal/auth-context";
import { BatchRepository } from "@/lib/dal/batch-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER"], orgId);
    const batches = await BatchRepository.listBatches(auth.organizationId);
    return NextResponse.json({ batches });
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

    if (!body.name || !body.targetExam) {
      return NextResponse.json({ error: "Batch name and target exam are required." }, { status: 400 });
    }

    const created = await BatchRepository.createBatch({
      organizationId: auth.organizationId,
      name: body.name,
      targetExam: body.targetExam,
      gradeLevel: body.gradeLevel,
      roomNumber: body.roomNumber,
      facultyName: body.facultyName,
    });

    return NextResponse.json({ batch: created }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create batch") }, { status: 500 });
  }
}
