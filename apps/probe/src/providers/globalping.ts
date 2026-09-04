import { randomUUID, createHash } from "node:crypto";
import { Globalping, type MeasurementLocationOption } from "globalping";
import { evaluateAssertions } from "../lib/assertions.js";
import type { ProbeProvider, ProbeTarget, RegionalMeasurement } from "./types.js";

const MEASUREMENT_TYPE = process.env.GLOBALPING_MEASUREMENT_TYPE || "http";
const DEFAULT_TIMEOUT_MS = 30000;

export function client() {
  const token = process.env.GLOBALPING_API_TOKEN || undefined; // optional - anonymous use is supported, just more rate-limited
  return new Globalping({ auth: token, userAgent: "PRAEST-Probe (+https://github.com/ometere123/praest)" });
}

/** "US", "Germany", "US-NY", "AS13335", a full free-form magic string, etc. */
export function locationFor(region: string): MeasurementLocationOption {
  return { magic: region };
}

export const globalpingProvider: ProbeProvider = {
  name: "globalping",
  async run(t: ProbeTarget, region: string): Promise<RegionalMeasurement> {
    const observedAt = new Date().toISOString();
    const workerVersion = process.env.PRAEST_PROBE_WORKER_VERSION || "globalping-1";
    const fail = (error: string): RegionalMeasurement => ({
      measurementId: randomUUID(),
      monitorId: t.id,
      organizationId: t.organizationId,
      serviceId: t.serviceId,
      region,
      workerVersion,
      collectorStatus: "COLLECTOR_ERROR",
      classification: "UNKNOWN",
      error,
      observedAt,
    });

    if (MEASUREMENT_TYPE !== "http") return fail(`GLOBALPING_MEASUREMENT_TYPE=${MEASUREMENT_TYPE} is not supported by the PRAEST evidence model (only "http" is normalized today)`);

    // Hard invariant, not a config convention: Globalping is a public third-party probe network -
    // a target carrying auth headers (a credentialed/private check) must never reach it. Route
    // those to the native provider instead.
    if (t.authHeaders && Object.keys(t.authHeaders).length > 0) return fail("Globalping cannot be used for authenticated targets (authHeaders present) - use PROBE_PROVIDER=native for private/credentialed checks");

    const u = new URL(t.url);
    if (u.protocol !== "https:") return fail("HTTPS only");

    const gp = client();
    const timeoutMs = Number(t.timeoutMs) > 0 ? Number(t.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const created = await gp.createMeasurement({
        type: "http",
        target: u.hostname,
        locations: [locationFor(region)],
        limit: 1,
        measurementOptions: {
          request: { path: u.pathname, query: u.search.replace(/^\?/, ""), method: (t.method as any) || "GET" },
          protocol: "HTTPS",
          port: u.port ? Number(u.port) : undefined,
        },
      });
      if (!created.ok) return fail(`Globalping measurement creation failed: ${JSON.stringify((created.data as any)?.error || created.data)}`);

      const awaited = await gp.awaitMeasurement(created.data.id, { signal: controller.signal });
      if (!awaited.ok) return fail(`Globalping measurement did not finish successfully: ${JSON.stringify((awaited.data as any)?.error || awaited.data)}`);

      const item = awaited.data.results?.[0];
      if (!item) return fail("Globalping returned no results for the requested location");
      const result = item.result as any;
      if (result.status === "offline") return fail("Requested Globalping location has no available probes right now");
      if (result.status !== "finished") return fail(`Globalping test did not finish (status=${result.status}): ${result.rawOutput || ""}`.trim());

      const body: string = result.rawBody || "";
      const { ok } = evaluateAssertions(t.assertions, { statusCode: result.statusCode, totalMs: result.timings?.total ?? 0, body, headers: result.headers || {} });

      return {
        measurementId: created.data.id,
        monitorId: t.id,
        organizationId: t.organizationId,
        serviceId: t.serviceId,
        region,
        workerVersion,
        collectorStatus: "OK",
        classification: ok ? "SERVICE_OK" : "SERVICE_FAILURE",
        statusCode: result.statusCode,
        dnsMs: result.timings?.dns ?? undefined,
        tcpMs: result.timings?.tcp ?? undefined,
        tlsMs: result.timings?.tls ?? undefined,
        ttfbMs: result.timings?.firstByte ?? undefined,
        totalMs: result.timings?.total ?? undefined,
        responseDigest: body ? createHash("sha256").update(body).digest("hex") : undefined,
        assertions: { ok },
        observedAt,
        summary: ok ? "Assertions satisfied" : "One or more assertions failed",
        evidence: {
          provider: "globalping",
          measurementId: created.data.id,
          requestedLocation: region,
          probe: {
            continent: item.probe.continent,
            region: item.probe.region,
            country: item.probe.country,
            state: item.probe.state,
            city: item.probe.city,
            asn: item.probe.asn,
            network: item.probe.network,
            latitude: item.probe.latitude,
            longitude: item.probe.longitude,
            tags: item.probe.tags,
          },
          resolvedAddress: result.resolvedAddress ?? null,
          truncated: result.truncated ?? false,
          tls: result.tls ?? null,
          rawHeadersDigest: result.rawHeaders ? createHash("sha256").update(result.rawHeaders).digest("hex") : undefined,
        },
      };
    } catch (e: any) {
      return fail(controller.signal.aborted ? `Globalping measurement timed out after ${timeoutMs}ms` : String(e?.message || e));
    } finally {
      clearTimeout(timer);
    }
  },
};
