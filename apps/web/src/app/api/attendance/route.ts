import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";
import { AttendanceRepository } from "@/lib/dal/attendance-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(undefined, orgId);
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
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "TEACHER"], orgId);
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
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Failed to save attendance" }, { status: 500 });
  }
}
