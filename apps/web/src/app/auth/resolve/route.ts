import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdmin, listMyOrganizations } from "@/lib/prepzii-backend";

const ACTIVE_ORGANIZATION_COOKIE = "prepzii_active_organization";

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", "/auth/resolve");
    return NextResponse.redirect(signInUrl);
  }

  if (await isPlatformAdmin(userId)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  let organizations;
  try {
    organizations = await listMyOrganizations(userId);
  } catch (error) {
    console.error("Unable to resolve the signed-in workspace", error);
    return new NextResponse("Unable to resolve your account workspace. Please try again.", {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "10" },
    });
  }

  if (organizations.length === 0) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const requestedSlug = request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const organization = organizations.find((item) => item.slug === requestedSlug) ?? organizations[0];
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organization.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
