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
  "/api/students",
]);

function isProtectedRoute(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
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
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }

  return clerkMiddleware(async (auth, request) => {
    if (
      isDevelopmentAuthOverrideEnabled(process.env.NODE_ENV, process.env.ALLOW_INSECURE_DEV_AUTH)
      && request.headers.get("x-authenticated-user")
    ) {
      return;
    }
    if (isProtectedRoute(request)) await auth.protect();
  })(req, ev);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk(.*)",
  ],
};


