import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError, getErrorMessage } from "@/lib/dal/auth-context";
import { AnalyticsRepository } from "@/lib/dal/analytics-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "TEACHER"], orgId);
    const analytics = await AnalyticsRepository.getInstituteAnalytics(auth.organizationId);
    return NextResponse.json(analytics);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load analytics") }, { status: 500 });
  }
}
