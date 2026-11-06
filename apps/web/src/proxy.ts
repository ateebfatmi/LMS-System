import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextFetchEvent, NextResponse } from "next/server";
import { isDevelopmentAuthOverrideEnabled, isTrustedMutationRequest } from "@prepzii/authorization";
import { validateEnvironment } from "@/lib/env-validator";

const protectedPathPrefixes = [
  "/dashboard",
  "/onboarding",
  "/api/onboarding",
  "/invite",
  "/api/invitations",
  "/api/organizations",
  "/api/me",
  "/api/platform",
  "/admin",
  "/auth/resolve",
  "/super-admin",
  "/office",
] as const;

const retiredProductionApiPaths = new Set([
  "/api/admissions",
  "/api/analytics",
  "/api/assessments",
  "/api/attendance",
  "/api/batches",
  "/api/cbt",
  "/api/fees",
  "/api/onboarding",
  "/api/questions",
  "/api/demo/reset",
  "/api/parent/children",
  "/api/parent/summary",
  "/api/parent/report",
  "/api/students",
]);

function isProtectedRoute(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return false;
  }
  return protectedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function proxy(req: NextRequest, ev: NextFetchEvent) {
  const environment = validateEnvironment();
  const strictEnvironment = environment.environment === "production" || environment.environment === "staging";
  const healthRoute = req.nextUrl.pathname === "/api/health" || req.nextUrl.pathname === "/api/ready";

  if (strictEnvironment && !environment.isConfigured && !healthRoute) {
    console.error("Deployment configuration rejected", {
      missingVariables: environment.missingVariables,
      errors: environment.errors,
    });
    const headers = { "cache-control": "no-store", "retry-after": "60" };
    return req.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Service configuration is incomplete." }, { status: 503, headers })
      : new NextResponse("Service temporarily unavailable.", { status: 503, headers });
  }

  if (strictEnvironment && retiredProductionApiPaths.has(req.nextUrl.pathname)) {
    return NextResponse.json(
      { error: "This legacy endpoint has been retired. Use the organization-scoped API." },
      { status: 410, headers: { "cache-control": "no-store" } },
    );
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    const allowedOrigins = [req.nextUrl.origin, process.env.NEXT_PUBLIC_APP_URL].filter(
      (origin): origin is string => Boolean(origin),
    );
    if (!isTrustedMutationRequest({
      method: req.method,
      origin: req.headers.get("origin"),
      fetchSite: req.headers.get("sec-fetch-site"),
      allowedOrigins,
    })) {
      return NextResponse.json({ error: "Cross-site mutation request rejected." }, { status: 403 });
    }
  }

  // Local UI development can render without Clerk. Production deployment
  // validation rejects missing Clerk configuration before release.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    const previewPage = environment.environment === "development"
      && ["localhost", "127.0.0.1", "[::1]"].includes(req.nextUrl.hostname)
      && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !process.env.CLERK_SECRET_KEY
      && !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY
      && /^\/(dashboard|onboarding)(?:\/|$)/.test(req.nextUrl.pathname);
    if (isProtectedRoute(req) && !previewPage) {
      return NextResponse.json({ error: "Authentication is not configured. Please contact the administrator." }, { status: 503 });
    }
    return NextResponse.next();
  }

  return clerkMiddleware(async (auth, request) => {
    if (
      isDevelopmentAuthOverrideEnabled(process.env.NODE_ENV, process.env.ALLOW_INSECURE_DEV_AUTH)
      && request.headers.get("x-authenticated-user")
    ) {
      return;
    }
    if (!isProtectedRoute(request)) return;
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const { userId } = await auth();
      if (!userId) return NextResponse.json({ error: "Unauthorized. Please sign in again." }, { status: 401 });
      return;
    }
    const pathname = request.nextUrl.pathname;
    // The resolver authenticates the session itself so it can carry forward return_to.
    if (pathname === "/auth/resolve") return;
    if (pathname === "/admin" || pathname === "/super-admin"
      || pathname.startsWith("/admin/") || pathname.startsWith("/super-admin/")) {
      await auth.protect({ unauthenticatedUrl: new URL("/admin/login", request.url).href });
      return;
    }
    const session = await auth();
    if (!session.userId && (request.headers.get("accept")?.includes("text/html") ||
      request.headers.get("sec-fetch-dest") === "document" || request.headers.has("next-url"))) {
      return session.redirectToSignIn({ returnBackUrl: request.url });
    }
    await auth.protect();
  }, { signInUrl: "/sign-in" })(req, ev);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk(.*)",
  ],
};


