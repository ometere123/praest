import { getProvider } from "./providers/index.js";
import type { ProbeTarget, RegionalMeasurement } from "./providers/types.js";

/**
 * Default regional spread, chosen to mirror the AWS EventBridge deployment
 * this replaces (us-east-1, eu-west-1, ap-southeast-1, sa-east-1,
 * ap-northeast-1 - North America, Europe, SE Asia, South America, East
 * Asia). Only used when GLOBALPING_PROBE_LOCATIONS is unset.
 */
const DEFAULT_LOCATIONS = ["US", "Germany", "Singapore", "Brazil", "Japan"];

function configuredLocations(): string[] {
  const raw = process.env.GLOBALPING_PROBE_LOCATIONS || process.env.PROBE_REGIONS;
  if (!raw) return DEFAULT_LOCATIONS;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function apiBase() {
  return process.env.PRAEST_API_URL || "http://localhost:4000";
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = process.env.PRAEST_INTERNAL_TOKEN;
  if (!token) throw new Error("PRAEST_INTERNAL_TOKEN required");
  const res = await fetch(new URL(path, apiBase()), { ...init, headers: { "content-type": "application/json", "x-praest-internal-token": token, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

/** Same retry allowance AWS EventBridge's default async Lambda invocation gave this pipeline for free (2 retries). */
async function withRetry<T>(label: string, fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  console.error(`${label} failed after ${retries + 1} attempts:`, lastErr);
  throw lastErr;
}

async function runLocation(region: string): Promise<{ region: string; total: number; ran: number }> {
  const provider = getProvider();
  const targets = (await withRetry(`fetch targets for ${region}`, () => apiFetch(`/v1/internal/probes/targets?region=${encodeURIComponent(region)}`))) as ProbeTarget[];
  let ran = 0;
  for (const t of targets) {
    let measurement: RegionalMeasurement;
    try {
      measurement = await withRetry(`${provider.name} probe ${t.id}@${region}`, () => provider.run(t, region));
    } catch (e: any) {
      measurement = {
        measurementId: crypto.randomUUID(),
        monitorId: t.id,
        organizationId: t.organizationId,
        serviceId: t.serviceId,
        region,
        workerVersion: process.env.PRAEST_PROBE_WORKER_VERSION || `${provider.name}-1`,
        collectorStatus: "COLLECTOR_ERROR",
        classification: "UNKNOWN",
        error: String(e?.message || e),
        observedAt: new Date().toISOString(),
      };
    }
    await withRetry(`ingest measurement ${measurement.measurementId}`, () => apiFetch("/v1/internal/probes/measurements", { method: "POST", body: JSON.stringify(measurement) }));
    ran++;
  }
  return { region, total: targets.length, ran };
}

/** The probe coordinator: fan out across configured locations, one provider-agnostic run per target per location. */
export async function runOnce() {
  const locations = configuredLocations();
  const results = [];
  for (const region of locations) {
    try {
      results.push(await runLocation(region));
    } catch (e: any) {
      results.push({ region, error: String(e?.message || e) });
    }
  }
  return { provider: getProvider().name, locations, results };
}

const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`;
  } catch {
    return false;
  }
})();
if (isMain) {
  runOnce()
    .then((r) => { console.log(JSON.stringify(r, null, 2)); })
    .catch((e) => { console.error(e); process.exit(1); });
}
