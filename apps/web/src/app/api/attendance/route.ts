import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError, getErrorMessage } from "@/lib/dal/auth-context";
import { AttendanceRepository } from "@/lib/dal/attendance-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER"], orgId);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "LOGS") {
      const logs = await AttendanceRepository.listNotificationLogs(auth.organizationId);
      return NextResponse.json({ logs });
    }

    const batchId = searchParams.get("batchId") || "batch-1";
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const register = await AttendanceRepository.getRegister(auth.organizationId, batchId, date);
    return NextResponse.json(register);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER"], orgId);
    const body = await req.json();

    if (!body.batchId || !body.sessionDate || !Array.isArray(body.records)) {
      return NextResponse.json({ error: "batchId, sessionDate, and records array are required." }, { status: 400 });
    }

    const result = await AttendanceRepository.saveRegister({
      organizationId: auth.organizationId,
      batchId: body.batchId,
      sessionDate: body.sessionDate,
      markedByUserId: auth.userId,
      records: body.records,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to save attendance") }, { status: 500 });
  }
}
