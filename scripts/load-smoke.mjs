import { performance } from "node:perf_hooks";

const baseUrl = process.env.LOAD_TEST_BASE_URL;
if (!baseUrl) throw new Error("LOAD_TEST_BASE_URL is required.");

const totalRequests = Number(process.env.LOAD_TEST_REQUESTS ?? "200");
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? "20");
const maximumP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS ?? "1500");
const maximumErrorRate = Number(process.env.LOAD_TEST_MAX_ERROR_RATE ?? "0.01");
const paths = (process.env.LOAD_TEST_PATHS ?? "/api/health,/").split(",").map((path) => path.trim()).filter(Boolean);

if (!Number.isInteger(totalRequests) || totalRequests < 1 || totalRequests > 100_000) throw new Error("LOAD_TEST_REQUESTS must be between 1 and 100000.");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 500) throw new Error("LOAD_TEST_CONCURRENCY must be between 1 and 500.");
if (!Number.isFinite(maximumP95Ms) || maximumP95Ms < 1) throw new Error("LOAD_TEST_MAX_P95_MS must be positive.");
if (!Number.isFinite(maximumErrorRate) || maximumErrorRate < 0 || maximumErrorRate > 1) throw new Error("LOAD_TEST_MAX_ERROR_RATE must be between 0 and 1.");

const durations = [];
const failures = [];
let cursor = 0;

async function worker() {
  while (cursor < totalRequests) {
    const index = cursor++;
    const path = paths[index % paths.length];
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl), {
        headers: { "user-agent": "prepzii-release-load-smoke/1.0" },
        signal: AbortSignal.timeout(Math.max(10_000, maximumP95Ms * 4)),
      });
      await response.arrayBuffer();
      durations.push(performance.now() - started);
      if (!response.ok) failures.push({ path, status: response.status });
    } catch (error) {
      durations.push(performance.now() - started);
      failures.push({ path, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

const suiteStarted = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()));
durations.sort((left, right) => left - right);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)] ?? 0;
const result = {
  baseUrl: new URL(baseUrl).origin,
  requests: totalRequests,
  concurrency,
  durationMs: Math.round(performance.now() - suiteStarted),
  p50Ms: Math.round(percentile(0.5)),
  p95Ms: Math.round(percentile(0.95)),
  p99Ms: Math.round(percentile(0.99)),
  errors: failures.length,
  errorRate: failures.length / totalRequests,
  sampleFailures: failures.slice(0, 10),
};
console.log(JSON.stringify(result, null, 2));

if (result.p95Ms > maximumP95Ms) throw new Error(`p95 ${result.p95Ms}ms exceeded ${maximumP95Ms}ms.`);
if (result.errorRate > maximumErrorRate) throw new Error(`Error rate ${result.errorRate} exceeded ${maximumErrorRate}.`);
