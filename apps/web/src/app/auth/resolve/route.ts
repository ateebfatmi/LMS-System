import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdmin, listMyOrganizations } from "@/lib/prepzii-backend";

const ACTIVE_ORGANIZATION_COOKIE = "prepzii_active_organization";
type Portal = "platform" | "institute-admin" | "member";

const adminRoles = new Set(["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR"]);
const memberRoles = new Set(["TEACHER", "STUDENT"]);

function portalLoginPath(portal: Portal | null): string {
  if (portal === "platform") return "/admin/login";
  if (portal === "institute-admin") return "/institute/login";
  if (portal === "member") return "/portal/login";
  return "/sign-in";
}

function safeReturnPath(request: NextRequest): string | null {
  const candidate = request.nextUrl.searchParams.get("return_to");
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) return null;
  const target = new URL(candidate, request.url);
  if (target.origin !== request.nextUrl.origin) return null;
  const allowed =
    target.pathname === "/dashboard" ||
    target.pathname.startsWith("/dashboard/") ||
    target.pathname === "/onboarding" ||
    target.pathname.startsWith("/invite/");
  if (!allowed) {
    return null;
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

function mismatchRedirect(request: NextRequest, portal: Portal, returnTo: string | null) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", "role_mismatch");
  url.searchParams.set("portal", portal);
  if (returnTo) url.searchParams.set("redirect_url", returnTo);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestedPortalValue = request.nextUrl.searchParams.get("portal");
  const requestedPortal: Portal | null =
    requestedPortalValue === "platform" ||
    requestedPortalValue === "institute-admin" ||
    requestedPortalValue === "member"
      ? requestedPortalValue
      : null;
  const returnTo = safeReturnPath(request);
  const { userId } = await auth();

  if (!userId) {
    const loginUrl = new URL(portalLoginPath(requestedPortal), request.url);
    if (returnTo && requestedPortal !== "platform") loginUrl.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(loginUrl);
  }

  const platformAdmin = await isPlatformAdmin(userId);
  if (requestedPortal === "platform") {
    return platformAdmin
      ? NextResponse.redirect(new URL("/admin", request.url))
      : mismatchRedirect(request, requestedPortal, returnTo);
  }
  if (platformAdmin && requestedPortal) {
    return mismatchRedirect(request, requestedPortal, returnTo);
  }
  if (platformAdmin) {
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

  if (organizations.length === 0 && returnTo?.startsWith("/invite/")) {
    return NextResponse.redirect(new URL(returnTo, request.url));
  }
  if (organizations.length === 0 && requestedPortal === "member") {
    return mismatchRedirect(request, requestedPortal, returnTo);
  }
  if (organizations.length === 0) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const requestedSlug = request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const eligibleOrganizations = requestedPortal === "institute-admin"
    ? organizations.filter((item) => adminRoles.has(String(item.userRole)))
    : requestedPortal === "member"
      ? organizations.filter((item) => memberRoles.has(String(item.userRole)))
      : organizations;

  if (requestedPortal && eligibleOrganizations.length === 0) {
    return mismatchRedirect(request, requestedPortal, returnTo);
  }

  const organization =
    eligibleOrganizations.find((item) => item.slug === requestedSlug) ?? eligibleOrganizations[0];
  const response = NextResponse.redirect(new URL(returnTo ?? "/dashboard/workspace", request.url));
  response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organization.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
