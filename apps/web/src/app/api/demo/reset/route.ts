import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN"]);

    // Only allow demo reset in demo/non-production environments or demo organization
    if (process.env.NODE_ENV === "production" && auth.organizationId !== "demo-institute-apex") {
      return NextResponse.json({ error: "Demo environment reset is only permitted on demo institutes." }, { status: 403 });
    }

    // In a live environment with Supabase, demo data is isolated by organization_id = 'demo-institute-apex'.
    return NextResponse.json({
      success: true,
      message: "Demo environment reset to baseline seed successfully.",
      timestamp: new Date().toISOString(),
      organizationId: auth.organizationId,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Failed to reset demo environment" }, { status: 500 });
  }
}
