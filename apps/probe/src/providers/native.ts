import dns from "node:dns/promises";
import https from "node:https";
import tls from "node:tls";
import net from "node:net";
import { randomUUID, createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { evaluateAssertions } from "../lib/assertions.js";
import type { ProbeProvider, ProbeTarget, RegionalMeasurement } from "./types.js";

const privateIp = (ip: string) =>
  /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd)/i.test(ip) || (/^172\.(\d+)\./.test(ip) && Number(ip.split(".")[1]) >= 16 && Number(ip.split(".")[1]) <= 31);

async function probeOnce(t: ProbeTarget, step: any) {
  const u = new URL(step.url || t.url);
  if (u.protocol !== "https:") throw new Error("HTTPS only");
  const rr = await dns.lookup(u.hostname, { all: true });
  if (!rr.length || rr.some((x) => privateIp(x.address))) throw new Error("unsafe target");
  const ip = rr[0]!.address;
  const started = performance.now();
  const dnsAt = performance.now();
  await dns.lookup(u.hostname);
  const dnsMs = performance.now() - dnsAt;
  const tcpAt = performance.now();
  await new Promise<void>((resolve, reject) => {
    const s = net.connect({ host: ip, port: Number(u.port || 443) });
    s.once("connect", () => { s.destroy(); resolve(); });
    s.once("error", reject);
    s.setTimeout(t.timeoutMs || 10000, () => s.destroy(new Error("tcp timeout")));
  });
  const tcpMs = performance.now() - tcpAt;
  const tlsAt = performance.now();
  await new Promise<void>((resolve, reject) => {
    const s = tls.connect({ host: ip, port: Number(u.port || 443), servername: u.hostname, rejectUnauthorized: true });
    s.once("secureConnect", () => { s.destroy(); resolve(); });
    s.once("error", reject);
    s.setTimeout(t.timeoutMs || 10000, () => s.destroy(new Error("tls timeout")));
  });
  const tlsMs = performance.now() - tlsAt;
  let statusCode = 0, bytes = 0, ttfbMs = 0, responseHeaders: Record<string, string | string[] | undefined> = {};
  const reqBody = step.body ?? t.assertions?.body;
  const headers = { host: u.host, "user-agent": "PRAEST-Probe/2", ...(t.authHeaders || {}) };
  const body = await new Promise<string>((resolve, reject) => {
    const request = https.request(
      { hostname: ip, port: Number(u.port || 443), path: u.pathname + u.search, method: step.method || t.method || "GET", headers, servername: u.hostname, rejectUnauthorized: true, timeout: t.timeoutMs || 10000 },
      (res) => {
        statusCode = res.statusCode || 0;
        responseHeaders = res.headers as any;
        ttfbMs = performance.now() - started;
        const chunks: Buffer[] = [];
        res.on("data", (c) => { bytes += c.length; if (bytes <= 512000) chunks.push(c); });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error("http timeout")));
    if (reqBody) request.write(reqBody);
    request.end();
  });
  const totalMs = performance.now() - started;
  const a = { ...(t.assertions || {}), ...step };
  const { ok } = evaluateAssertions(a, { statusCode, totalMs, body, headers: responseHeaders as any });
  return { name: step.name || "primary", url: u.origin + u.pathname, statusCode, dnsMs, tcpMs, tlsMs, ttfbMs, totalMs, responseDigest: createHash("sha256").update(body).digest("hex"), ok };
}

export const nativeProvider: ProbeProvider = {
  name: "native",
  async run(t: ProbeTarget, region: string): Promise<RegionalMeasurement> {
    const steps = (t.assertions?.steps || []).length
      ? t.assertions.steps
      : [{ name: "primary", url: t.url, method: t.method, body: t.assertions?.body, expectedStatus: t.assertions?.expectedStatus, maxLatencyMs: t.assertions?.maxLatencyMs, contentIncludes: t.assertions?.contentIncludes, headerEquals: t.assertions?.headerEquals, jsonPath: t.assertions?.jsonPath }];
    try {
      const results = [];
      for (const step of steps) results.push(await probeOnce(t, step));
      const ok = results.every((x) => x.ok);
      const first = results[0]!;
      const total = results.reduce((n, x) => n + x.totalMs, 0);
      return {
        measurementId: randomUUID(),
        monitorId: t.id,
        organizationId: t.organizationId,
        serviceId: t.serviceId,
        region,
        workerVersion: process.env.PRAEST_PROBE_WORKER_VERSION || "native-1",
        collectorStatus: "OK",
        classification: ok ? "SERVICE_OK" : "SERVICE_FAILURE",
        statusCode: first.statusCode,
        dnsMs: first.dnsMs,
        tcpMs: first.tcpMs,
        tlsMs: first.tlsMs,
        ttfbMs: first.ttfbMs,
        totalMs: total,
        responseDigest: first.responseDigest,
        assertions: { steps: results },
        observedAt: new Date().toISOString(),
        summary: ok ? "Assertions satisfied" : "One or more synthetic steps/assertions failed",
      };
    } catch (e: any) {
      return {
        measurementId: randomUUID(),
        monitorId: t.id,
        organizationId: t.organizationId,
        serviceId: t.serviceId,
        region,
        workerVersion: process.env.PRAEST_PROBE_WORKER_VERSION || "native-1",
        collectorStatus: "COLLECTOR_ERROR",
        classification: "UNKNOWN",
        error: String(e?.message || e),
        observedAt: new Date().toISOString(),
      };
    }
  },
};
