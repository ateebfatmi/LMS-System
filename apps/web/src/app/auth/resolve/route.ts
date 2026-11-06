import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { selectWorkspace } from "@prepzii/authorization";
import { ACTIVE_ORGANIZATION_COOKIE, setActiveWorkspace } from "@/lib/dal/auth-context";
import { isPlatformAdmin, listMyOrganizations, publicWorkspace } from "@/lib/prepzii-backend";
import { signInReturnPath, withSignInReturn } from "@/lib/sign-in-navigation";

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("portal") === "platform";
  const returnTo = signInReturnPath(request.nextUrl.searchParams.get("return_to"), request.url);
  const { userId } = await auth();

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url), {
    headers: { "cache-control": "private, no-store" },
  });

  if (!userId) {
    return redirectTo(platform ? "/admin/login" : withSignInReturn("/sign-in", returnTo));
  }
  if (platform) {
    return redirectTo(await isPlatformAdmin(userId) ? "/super-admin" : "/admin/login");
  }

  // Invitations can grant the first membership, and onboarding creates a workspace.
  if (returnTo === "/onboarding" || returnTo?.startsWith("/onboarding?") ||
      returnTo?.startsWith("/onboarding#") || returnTo?.startsWith("/invite/")) {
    return redirectTo(returnTo);
  }

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
