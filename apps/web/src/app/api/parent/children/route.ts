import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";
import { ParentRepository } from "@/lib/dal/parent-repository";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(["PARENT", "OWNER", "COACHING_ADMIN"]);
    const children = await ParentRepository.getLinkedChildren(auth.organizationId, auth.userId);
    return NextResponse.json({ children });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Failed to load linked children" }, { status: 500 });
  }
}
