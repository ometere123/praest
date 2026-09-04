import {createHash} from "node:crypto";
import {Inject, Injectable} from "@nestjs/common";
import {and, eq} from "drizzle-orm";
import {
  agreements,
  agreementParties,
  agreementVersions,
  cases,
  chainRoutes,
  decisions,
  escrows,
  settlementInstructions,
} from "@praest/database";
import {
  deriveInstructionId,
  encodeInstruction,
  sha256Hex,
  WIRE_VERSION,
  type SettlementInstruction,
} from "@praest/protocol";
import {DB} from "./database.module.js";
import {addressToBytes32, idToBytes32} from "./address.js";
import {StudioNetAdapter} from "./genlayer.js";

const STUDIO_HUB_DOMAIN = Number(process.env.PRAEST_HYPERLANE_ORIGIN_DOMAIN || 300);
const INSTRUCTION_TTL_SECONDS = Number(process.env.PRAEST_SETTLEMENT_INSTRUCTION_TTL_SECONDS || 86_400);

@Injectable()
export class SettlementEngine {
  constructor(@Inject(DB) private db: any) {}

  async build(org: string, decisionId: string) {
    const [d] = await this.db
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, decisionId), eq(decisions.organizationId, org)))
      .limit(1);
    if (!d) throw new Error("decision not found");

    // Independently re-read the finalized remedy from GenLayer SettlementEntitlement (recorded by
    // LifecycleService.finalize() at the moment the decision was created) and require it to match
    // this decision row exactly. This is the check that stops a compromised PRAEST database from
    // settling a different remedy than GenLayer actually decided.
    const entitlementAddress = process.env.GENLAYER_SETTLEMENT_ENTITLEMENT_ADDRESS;
    if (!entitlementAddress) throw new Error("GENLAYER_SETTLEMENT_ENTITLEMENT_ADDRESS required to build a settlement");
    const gl = new StudioNetAdapter();
    const entitlement: any = await gl.read(entitlementAddress, "get", [d.decisionHash], true);
    if (
      !entitlement ||
      String(entitlement.outcome) !== String(d.outcome) ||
      Number(entitlement.remedy_bps) !== Number(d.remedyBps) ||
      Number(entitlement.policy_version) !== Number(d.policyVersion)
    ) {
      throw new Error("decision does not match the entitlement recorded on GenLayer SettlementEntitlement - refusing to build settlement");
    }

    const [c] = await this.db
      .select()
      .from(cases)
      .where(and(eq(cases.id, d.caseId), eq(cases.organizationId, org)))
      .limit(1);
    if (!c) throw new Error("case not found");

    const [a] = await this.db
      .select()
      .from(agreements)
      .where(and(eq(agreements.id, c.agreementId), eq(agreements.organizationId, org)))
      .limit(1);
    if (!a) throw new Error("agreement not found");

    const [v] = await this.db
      .select()
      .from(agreementVersions)
      .where(and(eq(agreementVersions.agreementId, a.id), eq(agreementVersions.version, a.currentVersion)))
      .limit(1);
    if (!v) throw new Error("agreement version not found");

    const [e] = await this.db
      .select()
      .from(escrows)
      .where(and(eq(escrows.agreementId, a.id), eq(escrows.organizationId, org)))
      .limit(1);
    if (!e) throw new Error("escrow required for executable settlement");
    if (e.status !== "funded") throw new Error(`escrow must be funded before settlement (current: ${e.status})`);

    // Idempotency: one decision+escrow produces one canonical executable instruction.
    const [existing] = await this.db
      .select()
      .from(settlementInstructions)
      .where(and(eq(settlementInstructions.decisionId, d.id), eq(settlementInstructions.escrowId, e.id)))
      .limit(1);
    if (existing) return existing;

    const [route] = await this.db.select().from(chainRoutes).where(eq(chainRoutes.key, e.routeKey)).limit(1);
    if (!route || !route.enabled || !route.receiver) throw new Error("route receiver not deployed/configured");

    const parties = await this.db
      .select()
      .from(agreementParties)
      .where(and(eq(agreementParties.agreementId, a.id), eq(agreementParties.organizationId, org)));
    const customer = parties.find((p: any) => p.role === "customer");
    const provider = parties.find((p: any) => p.role === "provider");
    if (!customer?.settlementAddress || !provider?.settlementAddress) {
      throw new Error("customer and provider settlement addresses required");
    }

    // Agreement-party addresses and escrow policy must agree before constructing payouts.
    if (normalizeAddress(customer.settlementAddress, route.protocol) !== normalizeAddress(e.customerAddress, route.protocol)) {
      throw new Error("customer settlement address does not match funded escrow policy");
    }
    if (normalizeAddress(provider.settlementAddress, route.protocol) !== normalizeAddress(e.providerAddress, route.protocol)) {
      throw new Error("provider settlement address does not match funded escrow policy");
    }

    const total = BigInt(e.remainingAmount);
    if (total <= 0n) throw new Error("escrow has no remaining value");

    const decisionBps = Math.max(0, Number(d.remedyBps));
    const boundedBps = Math.min(10_000, Number(e.maxCustomerRemedyBps), decisionBps);
    const remedyBps = BigInt(boundedBps);
    const customerAmount = (total * remedyBps) / 10_000n;
    const providerAmount = total - customerAmount;

    const allocations: SettlementInstruction["allocations"] = [];
    if (providerAmount > 0n) {
      allocations.push({
        beneficiary: addressToBytes32(provider.settlementAddress, route.protocol),
        amount: providerAmount,
      });
    }
    if (customerAmount > 0n) {
      allocations.push({
        beneficiary: addressToBytes32(customer.settlementAddress, route.protocol),
        amount: customerAmount,
      });
    }
    if (!allocations.length) throw new Error("settlement allocations empty");

    const settlementTarget = addressToBytes32(route.receiver, route.protocol);
    const nonce = deterministicNonce(d.decisionHash, e.onchainEscrowId, route.domainId, settlementTarget);
    const instructionId = deriveInstructionId({
      decisionHash: d.decisionHash,
      destinationDomain: route.domainId,
      settlementTarget,
      nonce,
    });

    const finalizedAt = BigInt(Math.floor(new Date(d.finalizedAt).getTime() / 1000));
    if (finalizedAt <= 0n) throw new Error("invalid decision finality timestamp");
    const expiresAt = finalizedAt + BigInt(INSTRUCTION_TTL_SECONDS);

    const input: SettlementInstruction = {
      payloadVersion: WIRE_VERSION,
      instructionId,
      caseId: idToBytes32(c.id),
      agreementId: idToBytes32(a.id),
      decisionHash: d.decisionHash,
      policyVersion: d.policyVersion,
      evidenceManifestHash: d.evidenceManifestHash,
      outcome: outcomeCode(d.outcome),
      settlementType: settlementTypeCode((v.terms as any)?.remedy?.type),
      settlementTarget,
      // The cross-chain protocol binds to the destination escrow identity, not the DB UUID.
      escrowId: e.onchainEscrowId,
      asset: addressToBytes32(e.asset, route.protocol),
      assetDecimals: e.assetDecimals,
      finalizedAt,
      expiresAt,
      sourceDomain: STUDIO_HUB_DOMAIN,
      destinationDomain: route.domainId,
      nonce,
      allocations,
    };

    const payload = encodeInstruction(input);
    const [row] = await this.db
      .insert(settlementInstructions)
      .values({
        organizationId: org,
        decisionId: d.id,
        escrowId: e.id,
        instructionId,
        payload: jsonSafe(input),
        payloadHex: `0x${Buffer.from(payload).toString("hex")}`,
        payloadSha256: sha256Hex(payload),
        destinationDomain: route.domainId,
        status: "authorized",
        expiresAt: new Date(Number(input.expiresAt) * 1000),
      })
      .returning();
    return row;
  }
}

function deterministicNonce(decisionHash: string, escrowId: string, destinationDomain: number, target: string): bigint {
  const digest = createHash("sha256")
    .update(decisionHash.toLowerCase())
    .update("|")
    .update(escrowId.toLowerCase())
    .update("|")
    .update(String(destinationDomain))
    .update("|")
    .update(target.toLowerCase())
    .digest();
  return digest.readBigUInt64BE(0);
}

function normalizeAddress(address: string, protocol: string) {
  return protocol === "ethereum" ? address.toLowerCase() : address;
}
function outcomeCode(x: string) {
  return ({fulfilled: 1, breached: 2, partial: 3, undetermined: 255} as Record<string, number>)[x.toLowerCase()] ?? 254;
}
function settlementTypeCode(x: string) {
  return ({none: 0, credit: 1, refund: 2, escrow_release: 3, withholding: 4, custom: 255} as Record<string, number>)[x] ?? 255;
}
function jsonSafe(x: any): any {
  return typeof x === "bigint"
    ? x.toString()
    : Array.isArray(x)
      ? x.map(jsonSafe)
      : x && typeof x === "object"
        ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, jsonSafe(v)]))
        : x;
}
