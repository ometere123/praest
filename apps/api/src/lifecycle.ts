import { Body, Controller, ForbiddenException, Inject, Param, Post, Req } from "@nestjs/common";
import { DB } from "./database.module.js";
import {
  agreements,
  agreementVersions,
  cases,
  disputes,
  evidenceBundles,
  adjudications,
  appeals,
  decisions,
  settlementInstructions,
} from "@praest/database";
import { and, eq } from "drizzle-orm";
import { resolutionRequestSchema } from "@praest/schemas";
import { hasPermission } from "./request-context.js";
import { resolverAddress, StudioNetAdapter } from "./genlayer.js";
import { canonicalJson, sha256 } from "./crypto.js";
import { SettlementEngine } from "./settlement-engine.js";

const SUCCESSFUL_DECIDED = new Set(["ACCEPTED", "FINALIZED"]);
const NON_SETTLEABLE_DECIDED = new Set([
  "UNDETERMINED",
  "CANCELED",
  "VALIDATORS_TIMEOUT",
  "LEADER_TIMEOUT",
]);

export class LifecycleService {
  constructor(@Inject(DB) private db: any, private settlement: SettlementEngine) {}

  async createResolution(org: string, actor: string, body: unknown) {
    const v = resolutionRequestSchema.parse(body);
    const [agreement] = await this.db
      .select()
      .from(agreements)
      .where(and(eq(agreements.id, v.agreementId), eq(agreements.organizationId, org)))
      .limit(1);
    if (!agreement) throw new Error("agreement not found");

    if (v.evidenceBundleId) {
      const [bundle] = await this.db
        .select()
        .from(evidenceBundles)
        .where(
          and(
            eq(evidenceBundles.id, v.evidenceBundleId),
            eq(evidenceBundles.organizationId, org),
            eq(evidenceBundles.agreementId, agreement.id),
          ),
        )
        .limit(1);
      if (!bundle) throw new Error("evidence bundle not found for agreement");
      if (!bundle.lockedAt) throw new Error("evidence bundle must be locked before opening a resolution case");
    }

    const [createdCase] = await this.db
      .insert(cases)
      .values({
        organizationId: org,
        agreementId: agreement.id,
        caseType: v.caseType,
        claim: v.claim,
        requestedOutcome: v.requestedOutcome,
        evidenceBundleId: v.evidenceBundleId,
        openedBy: actor,
      })
      .returning();

    await this.db.insert(disputes).values({
      organizationId: org,
      caseId: createdCase.id,
      claimantStatement: v.claim,
      responseDueAt: new Date(Date.now() + 24 * 3600_000),
    });
    return createdCase;
  }

  async adjudicate(org: string, caseId: string) {
    const [c] = await this.db
      .select()
      .from(cases)
      .where(and(eq(cases.id, caseId), eq(cases.organizationId, org)))
      .limit(1);
    if (!c) throw new Error("case not found");

    const [prior] = await this.db
      .select()
      .from(adjudications)
      .where(and(eq(adjudications.caseId, c.id), eq(adjudications.organizationId, org)))
      .limit(1);
    if (prior) return prior;

    const [agreement] = await this.db
      .select()
      .from(agreements)
      .where(and(eq(agreements.id, c.agreementId), eq(agreements.organizationId, org)))
      .limit(1);
    if (!agreement) throw new Error("agreement not found");

    const [version] = await this.db
      .select()
      .from(agreementVersions)
      .where(
        and(
          eq(agreementVersions.organizationId, org),
          eq(agreementVersions.agreementId, agreement.id),
          eq(agreementVersions.version, agreement.currentVersion),
        ),
      )
      .limit(1);
    if (!version) throw new Error("active agreement version not found");

    // Verify the terms we are about to submit for adjudication match what was committed to
    // GenLayer AgreementRegistry at activation time (DomainService.activate). A compromised PRAEST
    // database/operator can no longer silently swap the terms a resolver judges without detection.
    const registryAddress = process.env.GENLAYER_AGREEMENT_REGISTRY_ADDRESS;
    if (!registryAddress) throw new Error("GENLAYER_AGREEMENT_REGISTRY_ADDRESS required for adjudication");
    const registryGl = new StudioNetAdapter();
    const stored = String(await registryGl.read(registryAddress, "get_agreement", [agreement.id], true) || "");
    const expected = `${agreement.currentVersion}|${version.termsHash}|${version.policyVersion}|active`;
    if (stored !== expected) {
      throw new Error("agreement terms do not match the commitment registered on GenLayer AgreementRegistry - refusing to adjudicate against unverified terms");
    }

    let bundle: any = null;
    if (c.evidenceBundleId) {
      [bundle] = await this.db
        .select()
        .from(evidenceBundles)
        .where(
          and(
            eq(evidenceBundles.id, c.evidenceBundleId),
            eq(evidenceBundles.organizationId, org),
            eq(evidenceBundles.agreementId, agreement.id),
          ),
        )
        .limit(1);
      if (!bundle) throw new Error("evidence bundle not found");
      if (!bundle.lockedAt) throw new Error("evidence bundle must be locked before adjudication");
    }

    const resolver = resolverAddress(c.caseType);
    const gl = new StudioNetAdapter();
    const txHash = await gl.write(resolver, "resolve", [
      c.id,
      canonicalJson(version.terms),
      c.claim,
      canonicalJson(bundle?.manifest || {}),
      bundle?.manifestHash || sha256("empty-evidence"),
    ]);

    const [adj] = await this.db
      .insert(adjudications)
      .values({
        organizationId: org,
        caseId: c.id,
        resolverKey: c.caseType,
        genlayerContract: resolver,
        genlayerTxHash: txHash,
        status: "submitted",
      })
      .returning();
    await this.db.update(cases).set({ status: "submitted", updatedAt: new Date() }).where(eq(cases.id, c.id));

    const receipt = await gl.waitDecided(txHash);
    const status = String(receipt.statusName || "").toUpperCase();
    const execution = String(receipt.txExecutionResultName || "").toUpperCase();

    if (!SUCCESSFUL_DECIDED.has(status) || (execution && execution !== "FINISHED_WITH_RETURN")) {
      const isUndetermined = NON_SETTLEABLE_DECIDED.has(status) || status === "UNDETERMINED";
      const dbStatus = status === "CANCELED" ? "canceled" : isUndetermined ? "undetermined" : "failed";
      await this.db
        .update(adjudications)
        .set({ status: dbStatus, executionResult: execution || null, rawDecision: receipt, updatedAt: new Date() })
        .where(eq(adjudications.id, adj.id));
      await this.db
        .update(cases)
        .set({ status: isUndetermined ? "undetermined" : "decided", updatedAt: new Date() })
        .where(eq(cases.id, c.id));
      return { ...adj, status: dbStatus };
    }

    const appealSeconds = Math.max(0, Number((version.terms as any)?.appealWindowSeconds || 3600));
    const alreadyFinal = status === "FINALIZED";
    const now = new Date();
    const deadline = alreadyFinal ? now : new Date(now.getTime() + appealSeconds * 1000);
    const [saved] = await this.db
      .update(adjudications)
      .set({
        status: alreadyFinal ? "finalized" : "accepted",
        acceptedAt: now,
        finalizedAt: alreadyFinal ? now : null,
        appealDeadline: deadline,
        executionResult: execution || null,
        rawDecision: receipt,
        updatedAt: now,
      })
      .where(eq(adjudications.id, adj.id))
      .returning();
    await this.db
      .update(cases)
      .set({ status: alreadyFinal ? "decided" : "appealable", updatedAt: now })
      .where(eq(cases.id, c.id));
    return saved;
  }

  async appeal(org: string, adjId: string, reason: string, value?: string) {
    const [adj] = await this.db
      .select()
      .from(adjudications)
      .where(and(eq(adjudications.id, adjId), eq(adjudications.organizationId, org)))
      .limit(1);
    if (!adj?.genlayerTxHash) throw new Error("adjudication not found");
    if (adj.status === "finalized") throw new Error("finalized adjudication cannot be appealed");
    if (adj.appealDeadline && adj.appealDeadline < new Date()) throw new Error("appeal window closed");

    const gl = new StudioNetAdapter();
    if (!(await gl.canAppeal(adj.genlayerTxHash))) throw new Error("GenLayer transaction cannot currently be appealed");
    await gl.appeal(adj.genlayerTxHash, value ? BigInt(value) : undefined);

    const existing = await this.db.select().from(appeals).where(eq(appeals.adjudicationId, adj.id));
    const [appeal] = await this.db
      .insert(appeals)
      .values({
        organizationId: org,
        adjudicationId: adj.id,
        round: existing.length + 1,
        reason,
        genlayerTxHash: adj.genlayerTxHash,
        status: "submitted",
      })
      .returning();
    await this.db.update(adjudications).set({ status: "appealed", updatedAt: new Date() }).where(eq(adjudications.id, adj.id));
    return appeal;
  }

  private async authorizeOutbox(gl: StudioNetAdapter, decision: any, instruction: any) {
    const outbox = process.env.GENLAYER_DECISION_OUTBOX_ADDRESS;
    if (!outbox) throw new Error("GENLAYER_DECISION_OUTBOX_ADDRESS required");
    const expiresAt = Math.floor(instruction.expiresAt.getTime() / 1000);
    const existing: any = await gl.read(outbox, "get_instruction", [instruction.instructionId], true);
    if (existing && Object.keys(existing).length > 0) {
      if (
        String(existing.payload_hex || "").toLowerCase() !== String(instruction.payloadHex).toLowerCase() ||
        String(existing.decision_hash || "").toLowerCase() !== String(decision.decisionHash).toLowerCase() ||
        Number(existing.destination_domain) !== Number(instruction.destinationDomain) ||
        Number(existing.expires_at) !== expiresAt
      ) {
        throw new Error("DecisionOutbox already contains a conflicting instruction");
      }
    } else {
      await gl.write(outbox, "publish_instruction", [
        instruction.instructionId,
        instruction.payloadHex,
        decision.decisionHash,
        instruction.destinationDomain,
        expiresAt,
      ]);
    }
    await this.db
      .update(settlementInstructions)
      .set({ status: "authorized", updatedAt: new Date() })
      .where(eq(settlementInstructions.id, instruction.id));
  }

  async finalize(org: string, adjId: string) {
    const [adj] = await this.db
      .select()
      .from(adjudications)
      .where(and(eq(adjudications.id, adjId), eq(adjudications.organizationId, org)))
      .limit(1);
    if (!adj?.genlayerTxHash) throw new Error("adjudication not found");

    const [existingDecision] = await this.db
      .select()
      .from(decisions)
      .where(and(eq(decisions.adjudicationId, adj.id), eq(decisions.organizationId, org)))
      .limit(1);
    if (existingDecision) {
      const [existingInstruction] = await this.db
        .select()
        .from(settlementInstructions)
        .where(and(eq(settlementInstructions.decisionId, existingDecision.id), eq(settlementInstructions.organizationId, org)))
        .limit(1);
      const instruction = existingInstruction || (await this.settlement.build(org, existingDecision.id));
      const gl = new StudioNetAdapter();
      await this.authorizeOutbox(gl, existingDecision, instruction);
      return { decision: existingDecision, instruction };
    }

    if (adj.status === "undetermined" || adj.status === "failed" || adj.status === "canceled") {
      throw new Error(`adjudication is not settleable: ${adj.status}`);
    }
    if (adj.appealDeadline && adj.appealDeadline > new Date()) throw new Error("appeal window still open");

    const gl = new StudioNetAdapter();
    // v0.6 protocol lifecycle projection is the authoritative finalize-readiness signal - there is
    // no "ready to finalize" transaction status. Only call finalize() when the protocol says
    // resolutionAction is "Finalize"; otherwise the transaction is either already finalized or not
    // yet eligible, and waitFinalized() below is what actually confirms the end state either way.
    const lifecycle = await gl.getLifecycle(adj.genlayerTxHash);
    if (lifecycle.resolutionAction === "Finalize" && lifecycle.decisionActive) {
      await gl.finalize(adj.genlayerTxHash);
    }
    const finalReceipt = await gl.waitFinalized(adj.genlayerTxHash);
    if (String(finalReceipt.statusName || "").toUpperCase() !== "FINALIZED") throw new Error("GenLayer transaction is not finalized");

    const resolution: any = await gl.read(adj.genlayerContract, "get_resolution", [adj.caseId], true);
    const [c] = await this.db
      .select()
      .from(cases)
      .where(and(eq(cases.id, adj.caseId), eq(cases.organizationId, org)))
      .limit(1);
    if (!c) throw new Error("case not found");

    const [bundle] = c.evidenceBundleId
      ? await this.db
          .select()
          .from(evidenceBundles)
          .where(and(eq(evidenceBundles.id, c.evidenceBundleId), eq(evidenceBundles.organizationId, org)))
          .limit(1)
      : [null];

    const normalized = {
      outcome: String(resolution.outcome || resolution[0] || "undetermined").toLowerCase(),
      reasonCode: String(resolution.reason_code || resolution.reasonCode || resolution[1] || "GENLAYER"),
      remedyBps: Number(resolution.remedy_bps ?? resolution.remedyBps ?? resolution[2] ?? 0),
      liability: resolution.liability || [],
    };
    if (!Number.isInteger(normalized.remedyBps) || normalized.remedyBps < 0 || normalized.remedyBps > 10000) {
      throw new Error("invalid finalized remedy from resolver");
    }

    const evidenceManifestHash = bundle?.manifestHash || sha256("empty-evidence");
    const decisionHash = sha256(canonicalJson({ caseId: c.id, ...normalized, evidenceManifestHash }));
    const now = new Date();
    const [decision] = await this.db
      .insert(decisions)
      .values({
        organizationId: org,
        caseId: c.id,
        adjudicationId: adj.id,
        decisionHash,
        outcome: normalized.outcome,
        reasonCode: normalized.reasonCode,
        remedyBps: normalized.remedyBps,
        liability: normalized.liability,
        finalizedAt: now,
        evidenceManifestHash,
        policyVersion: Number(resolution.policy_version || 1),
      })
      .returning();

    await this.db
      .update(adjudications)
      .set({ status: "finalized", finalizedAt: now, rawDecision: resolution, updatedAt: now })
      .where(eq(adjudications.id, adj.id));
    await this.db.update(cases).set({ status: "finalized", updatedAt: now }).where(eq(cases.id, c.id));

    // Record the finalized remedy on GenLayer SettlementEntitlement before any settlement is
    // constructed. SettlementEngine.build() independently re-reads this on-chain entitlement and
    // requires it to match this decision exactly - so a compromised PRAEST database cannot alter
    // remedyBps/outcome/policyVersion after the fact and have a different amount settled.
    const entitlementAddress = process.env.GENLAYER_SETTLEMENT_ENTITLEMENT_ADDRESS;
    if (!entitlementAddress) throw new Error("GENLAYER_SETTLEMENT_ENTITLEMENT_ADDRESS required to finalize a settleable decision");
    try {
      await gl.write(entitlementAddress, "record", [decision.decisionHash, decision.outcome, decision.remedyBps, decision.policyVersion]);
    } catch {
      // already recorded (e.g. a retried finalize call) - SettlementEngine.build() verifies the
      // stored entitlement matches this decision regardless of who wrote it first.
    }

    const instruction = await this.settlement.build(org, decision.id);
    await this.authorizeOutbox(gl, decision, instruction);
    return { decision, instruction };
  }
}

@Controller("v1")
export class LifecycleController {
  constructor(private svc: LifecycleService) {}

  @Post("resolutions")
  create(@Req() r: any, @Body() b: any) {
    if (!hasPermission(r.praestActor, "disputes:write")) throw new ForbiddenException();
    return this.svc.createResolution(r.praestActor.organizationId, r.praestActor.id, b);
  }

  @Post("cases/:id/adjudicate")
  adjudicate(@Req() r: any, @Param("id") id: string) {
    if (!hasPermission(r.praestActor, "disputes:write")) throw new ForbiddenException();
    return this.svc.adjudicate(r.praestActor.organizationId, id);
  }

  @Post("adjudications/:id/appeal")
  appeal(@Req() r: any, @Param("id") id: string, @Body() b: any) {
    if (!hasPermission(r.praestActor, "disputes:write")) throw new ForbiddenException();
    return this.svc.appeal(r.praestActor.organizationId, id, b.reason, b.value);
  }

  @Post("adjudications/:id/finalize")
  finalize(@Req() r: any, @Param("id") id: string) {
    if (!hasPermission(r.praestActor, "settlements:write")) throw new ForbiddenException();
    return this.svc.finalize(r.praestActor.organizationId, id);
  }
}
