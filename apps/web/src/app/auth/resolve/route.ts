import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isAllowlistedPlatformAdmin, selectWorkspace } from "@prepzii/authorization";
import { ACTIVE_ORGANIZATION_COOKIE, setActiveWorkspace } from "@/lib/dal/auth-context";
import { listMyOrganizations, publicWorkspace } from "@/lib/prepzii-backend";
import { PLATFORM_INSTITUTE_SESSION_COOKIE, signInReturnPath, withSignInReturn } from "@/lib/sign-in-navigation";

export async function GET(request: NextRequest) {
  const returnTo = signInReturnPath(request.nextUrl.searchParams.get("return_to"), request.url);
  const { userId } = await auth();

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url), {
    headers: { "cache-control": "private, no-store" },
  });

  if (!userId) {
    return redirectTo(withSignInReturn("/sign-in", returnTo));
  }
  if (isAllowlistedPlatformAdmin(userId, process.env.PLATFORM_SUPER_ADMIN_USER_IDS)) {
    const response = redirectTo("/super-admin");
    response.cookies.delete(PLATFORM_INSTITUTE_SESSION_COOKIE);
    return response;
  }
  if (returnTo?.startsWith("/invite/") || returnTo?.startsWith("/sign-up?invite=")) return redirectTo(returnTo);

  let organizations;
  try {
    organizations = (await listMyOrganizations(userId)).map(publicWorkspace);
  } catch (error) {
    console.error("Unable to resolve the signed-in workspace", error);
    return new NextResponse("Unable to resolve your account workspace. Please try again.", {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "10" },
    });
  }

  const organization = selectWorkspace(organizations);
  if (organization) {
    await setActiveWorkspace(organization.slug);
    return redirectTo(returnTo ?? "/dashboard/workspace");
  }

  const response = organizations.length
    ? redirectTo(withSignInReturn("/sign-in?workspace=choose", returnTo))
    : redirectTo("/sign-in?workspace=missing");
  response.cookies.delete(ACTIVE_ORGANIZATION_COOKIE);
  return response;
}
