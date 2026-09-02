import { resourceFromPath } from "./api";

export type Plane = "product" | "control" | "developer" | "explorer";

export const human = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function section(path: string): Plane {
  if (path.startsWith("/control")) return "control";
  if (path.startsWith("/developer")) return "developer";
  if (path.startsWith("/explorer")) return "explorer";
  return "product";
}

export const PLANE_LABEL: Record<Plane, string> = {
  product: "Product",
  control: "Control Plane",
  developer: "Developer Platform",
  explorer: "Explorer",
};

export const endpointFor = (path: string) => {
  if (path.includes("/api-keys")) return "api-keys";
  if (path.includes("/webhooks")) return "webhooks";
  if (path.includes("/routes")) return "routes";
  return resourceFromPath(path);
};

export { resourceFromPath };

export const resourceKey = (endpoint: string) =>
  (({
    "agent-tasks": "agentTasks",
    "agent-execution-receipts": "agentExecutionReceipts",
    "agreement-versions": "agreementVersions",
    "agreement-parties": "agreementParties",
    "evidence-bundles": "evidenceBundles",
    "tls-proofs": "tlsProofs",
    "settlement-instructions": "settlementInstructions",
    "hyperlane-messages": "hyperlaneMessages",
    "x402-requests": "x402Requests",
    "usage-events": "usageEvents",
    "tvg-ledger": "tvgLedger",
    "reputation-events": "reputationEvents",
    "audit-logs": "auditLogs",
  }) as Record<string, string>)[endpoint] || endpoint;

const NO_FETCH_ENDPOINTS = new Set([
  "dashboard",
  "analytics",
  "billing",
  "mcp",
  "openapi",
  "playground",
  "sdks",
  "overview",
  "genlayer",
  "workflows",
  "security",
  "audit",
  "monitoring",
  "chains",
  "hyperlane",
]);

export function shouldFetch(endpoint?: string) {
  return Boolean(endpoint) && !NO_FETCH_ENDPOINTS.has(endpoint as string);
}

/** Cases/adjudications/appeals/decisions/settlements/receipts and every explorer
 * detail page carry an ACCEPTED-vs-FINALIZED distinction that must stay visible. */
export function isLifecyclePath(path: string) {
  return /\/(cases|adjudications|appeals|decisions|settlements|receipts)\/[^/]+/.test(path) || (path.startsWith("/explorer/") && path.split("/").filter(Boolean).length >= 2);
}

export function isListPath(path: string) {
  const bits = path.split("/").filter(Boolean);
  const last = bits.at(-1) || "";
  return !last.startsWith("[") && !/^[0-9a-f]{8}-/i.test(last) && last !== "new";
}

export function isFormPath(path: string) {
  return path.endsWith("/new") || /\/(new)$/.test(path);
}

export function extractId(path: string) {
  return path.split("/").find((x) => /^[0-9a-f]{8}-/i.test(x));
}
