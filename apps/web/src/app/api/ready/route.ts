import { validateEnvironment } from "@/lib/env-validator";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

const TIMEOUT_MS = 4_000;

async function checkDatabase() {
  const query = getPrepziiAdmin().from("institutes").select("id", { count: "exact", head: true });
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Database readiness check timed out.")), TIMEOUT_MS);
  });
  const result = await Promise.race([query, timeout]);
  if (result.error) throw new Error(result.error.message);
}

export async function GET() {
  const environment = validateEnvironment();
  if (!environment.isConfigured) {
    return Response.json(
      {
        service: "prepzii-b2b-web",
        status: "not_ready",
        checks: { configuration: "failed", database: "not_checked" },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    await checkDatabase();
    return Response.json(
      {
        service: "prepzii-b2b-web",
        status: "ready",
        checks: { configuration: "ok", database: "ok" },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Readiness check failed", error);
    return Response.json(
      {
        service: "prepzii-b2b-web",
        status: "not_ready",
        checks: { configuration: "ok", database: "failed" },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
