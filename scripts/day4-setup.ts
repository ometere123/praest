/**
 * Day 4 setup: creates the organisation, service, agreement and monitor for one real
 * service-assurance case, then leaves the service healthy and ready to be broken.
 *
 * Everything after the organisation row goes through the real API, not direct database writes -
 * the point of the exercise is that the product's own paths work, not that rows can be inserted.
 */
import {createDatabase, organizations} from "@praest/database";
import {eq} from "drizzle-orm";

const API = process.env.PRAEST_API_URL || "https://praest-api-production.up.railway.app";
const TOKEN = process.env.PRAEST_INTERNAL_TOKEN!;
const PROVIDER_URL = process.env.DEMO_PROVIDER_URL || "https://praest-demo-provider-production.up.railway.app";
const PROVIDER_ADDRESS = process.env.PRAEST_PROVIDER!;
const CUSTOMER_ADDRESS = process.env.PRAEST_CUSTOMER!;

async function api(path: string, body?: unknown, org?: string) {
  const headers: Record<string, string> = {"x-praest-internal-token": TOKEN};
  if (org) headers["x-praest-organization-id"] = org;
  if (body !== undefined) headers["content-type"] = "application/json";
  const r = await fetch(`${API}/v1/${path}`, {method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body)});
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${text.slice(0, 400)}`);
  return data;
}

async function main() {
  if (!TOKEN) throw new Error("PRAEST_INTERNAL_TOKEN required");
  const {db, pool} = createDatabase();

  // The organisation is a tenant record. Bootstrap correctly refuses to create one without a
  // verified WorkOS org claim, so for the proof run we seed the tenant directly and drive every
  // subsequent step through the real API.
  const slug = "praest-day4";
  let [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (!org) {
    [org] = await db.insert(organizations).values({name: "PRAEST Day 4 Proof", slug, workosOrganizationId: `manual_${slug}`}).returning();
    console.log("created organisation", org.id);
  } else {
    console.log("organisation exists", org.id);
  }
  const ORG = org.id;

  const service = await api("resources/services", {
    name: "Demo Provider API",
    kind: "api",
    baseUrl: PROVIDER_URL,
    status: "active",
    metadata: {statusPageUrl: `${PROVIDER_URL}/status`, operator: "praest-demo-provider"},
  }, ORG);
  console.log("service", service.id);

  // Terms mirror the scenario from the pitch: 99.9% availability, a maintenance exclusion that
  // only applies with 48 hours of notice, and a two-tier remedy. maxBps must match the escrow's
  // maxCustomerRemedyBps - the contract enforces its own cap regardless of what a decision says,
  // so a mismatch would surface as an on-chain revert rather than an overpayment.
  const terms = {
    policyVersion: 1,
    availability: {targetPercent: 99.9, measurementWindow: "monthly", degradedThresholdMs: 5000},
    maintenance: {excludedFromAvailability: true, minimumNoticeHours: 48, noticeSource: `${PROVIDER_URL}/status`},
    remedy: {maxBps: 2500, tiers: [
      {ifAvailabilityBelowPercent: 99.9, remedyBps: 1000},
      {ifAvailabilityBelowPercent: 99.0, remedyBps: 2500},
    ]},
    evidencePolicy: {publicUrls: [`${PROVIDER_URL}/status`], collectors: ["globalping", "praest-native"]},
    disputeWindowHours: 24,
  };

  const agreement = await api("agreements", {
    name: "Demo Provider API — 99.9% availability SLA",
    kind: "service_assurance",
    serviceId: service.id,
    status: "draft",
    settlementRouteKey: "basesepolia",
    settlementAsset: process.env.PRAEST_SETTLEMENT_TOKEN,
    governedValue: process.env.PRAEST_ESCROW_AMOUNT,
    terms,
    parties: [
      {role: "provider", partyType: "org", settlementAddress: PROVIDER_ADDRESS},
      {role: "customer", partyType: "org", settlementAddress: CUSTOMER_ADDRESS},
    ],
    metadata: {escrowId: process.env.PRAEST_ESCROW_ID, service: {baseUrl: PROVIDER_URL, statusPageUrl: `${PROVIDER_URL}/status`}},
  }, ORG);
  console.log("agreement", agreement.id, "termsHash", agreement.termsHash);

  const parties = await api(`resources/agreementParties?agreementId=${agreement.id}`, undefined, ORG);
  const list = Array.isArray(parties) ? parties : parties?.items || [];
  for (const p of list.filter((p: any) => p.agreementId === agreement.id)) {
    await api(`agreements/${agreement.id}/accept`, {partyId: p.id, signature: `demo:${p.role}`}, ORG);
    console.log("accepted by", p.role);
  }

  const activated = await api(`agreements/${agreement.id}/activate`, {}, ORG);
  console.log("agreement status:", activated?.status || "activated");

  const monitor = await api("monitors", {
    serviceId: service.id,
    name: "Demo Provider API availability",
    url: PROVIDER_URL,
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 8000,
    regions: ["US", "Germany", "Singapore", "Brazil", "Japan"],
    expectedStatus: 200,
    maxLatencyMs: 5000,
  }, ORG);
  console.log("monitor", monitor.id);

  console.log("\n=== record these ===");
  console.log(JSON.stringify({organizationId: ORG, serviceId: service.id, agreementId: agreement.id, termsHash: agreement.termsHash, monitorId: monitor.id}, null, 2));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
