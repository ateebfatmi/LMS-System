export function GET() {
  return Response.json(
    {
      service: "prepzii-b2b-web",
      status: "ok",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? process.env.npm_package_version ?? "development",
    },
    { headers: { "cache-control": "no-store" } },
  );
}

