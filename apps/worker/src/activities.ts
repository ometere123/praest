const base = () => process.env.PRAEST_API_URL || "http://localhost:4000";

// Fastify rejects a request that declares content-type: application/json but carries no body
// ("Body cannot be empty..."), so only declare it when we are actually sending something. The
// sweep endpoints take no payload.
function headers(token: string, organizationId?: string, hasBody = false) {
  const h: Record<string, string> = {"x-praest-internal-token": token};
  if (hasBody) h["content-type"] = "application/json";
  if (organizationId) h["x-praest-organization-id"] = organizationId;
  return h;
}

async function request(path: string, organizationId: string, method = "POST", body?: any) {
  const token = process.env.PRAEST_INTERNAL_TOKEN;
  if (!token) throw new Error("PRAEST_INTERNAL_TOKEN required");
  const r = await fetch(new URL(`/v1/${path}`, base()), {
    method,
    headers: headers(token, organizationId, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  const d = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error(d?.message || `API ${r.status}`);
  return d;
}

async function requestGlobal(path: string, method = "GET", body?: any) {
  const token = process.env.PRAEST_INTERNAL_TOKEN;
  if (!token) throw new Error("PRAEST_INTERNAL_TOKEN required");
  const r = await fetch(new URL(`/v1/${path}`, base()), {
    method,
    headers: headers(token, undefined, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  const d = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error(d?.message || `API ${r.status}`);
  return d;
}

export const activities = {
  adjudicate: (org: string, caseId: string) => request(`cases/${caseId}/adjudicate`, org),
  finalize: (org: string, adjudicationId: string) => request(`adjudications/${adjudicationId}/finalize`, org),
  runMonitor: (org: string, monitorId: string) => request(`monitors/${monitorId}/run`, org),
  processWebhook: (org: string, deliveryId: string) => request(`internal/webhook-deliveries/${deliveryId}/run`, org),
  pendingWebhooks: () => requestGlobal("internal/webhook-deliveries/pending"),

  // Sweeps driven by the scheduler in worker.ts. Each is idempotent and safe to call early.
  sweepMonitors: () => requestGlobal("monitors/internal/sweep", "POST"),
  sweepWebhooks: () => requestGlobal("internal/webhook-deliveries/sweep", "POST"),
  sweepAdjudications: () => requestGlobal("internal/adjudications/sweep", "POST"),

  health: async () => {
    const r = await fetch(new URL("/healthz", base()));
    if (!r.ok) throw new Error("API unhealthy");
    return r.json();
  },
};
