import {Body,Controller,ForbiddenException,Headers,Inject,Post,Req} from "@nestjs/common";
import {DB} from "./database.module.js";
import {evidence,tlsProofs} from "@praest/database";
import {and,eq} from "drizzle-orm";
import {hasPermission} from "./request-context.js";
import {sha256,canonicalJson} from "./crypto.js";
import {Public} from "./public.decorator.js";

// PRAEST-owned configuration for our own future TLSNotary verifier deployment (e.g. on Railway) -
// not credentials issued by any TLSNotary SaaS/API-key service. TLSNOTARY_WEBHOOK_TOKEN is a
// secret PRAEST generates itself to authenticate that verifier's callbacks; it is never claimed to
// have come from TLSNotary.
export const tlsNotaryEnabled = () => process.env.TLSNOTARY_ENABLED === "true";
export const tlsNotaryConfig = () => ({
  enabled: tlsNotaryEnabled(),
  verifierUrl: process.env.TLSNOTARY_VERIFIER_URL || null,
  verifierWsUrl: process.env.TLSNOTARY_VERIFIER_WS_URL || null,
  proxyWsUrl: process.env.TLSNOTARY_PROXY_WS_URL || null,
  timeoutMs: Number(process.env.TLSNOTARY_TIMEOUT_MS || 60000),
});

export class TlsNotaryService {
  constructor(@Inject(DB) private db: any) {}

  /**
   * Records a proof artifact submission from an ordinary authenticated caller. This is NOT a
   * verification result - a caller-supplied `verified` flag is never trusted here, no matter what
   * the body contains. The artifact is recorded as pending_verification; only `recordVerifierResult`
   * (reachable exclusively via the TLSNOTARY_WEBHOOK_TOKEN-authenticated webhook) can ever transition
   * evidence to tlsnotary_verified or tlsnotary_failed.
   */
  async submitProof(org: string, evidenceId: string, b: any) {
    const [e] = await this.db.select().from(evidence).where(and(eq(evidence.id, evidenceId), eq(evidence.organizationId, org))).limit(1);
    if (!e) throw new Error("evidence not found");
    const proofHash = b.proofHash || sha256(canonicalJson(b.proof || b));
    const [p] = await this.db
      .insert(tlsProofs)
      .values({
        organizationId: org,
        evidenceId: e.id,
        proofObjectKey: b.proofObjectKey || `external:${proofHash}`,
        proofHash,
        verifierVersion: b.verifierVersion || "tlsnotary",
        disclosureManifest: b.disclosureManifest || {},
        verifiedAt: null,
      })
      .returning();
    await this.db.update(evidence).set({ verificationStatus: "pending_verification" }).where(eq(evidence.id, e.id));
    return p;
  }

  /**
   * Records the real verification outcome. Only callable from the authenticated webhook below -
   * `verified` here comes from our own verifier service having actually run MPC-TLS verification,
   * never from an ordinary caller's request body.
   */
  async recordVerifierResult(org: string, evidenceId: string, b: any) {
    const [e] = await this.db.select().from(evidence).where(and(eq(evidence.id, evidenceId), eq(evidence.organizationId, org))).limit(1);
    if (!e) throw new Error("evidence not found");
    const verified = b.verified === true;
    const proofHash = b.proofHash || sha256(canonicalJson(b.proof || b));
    const [p] = await this.db
      .insert(tlsProofs)
      .values({
        organizationId: org,
        evidenceId: e.id,
        proofObjectKey: b.proofObjectKey || `external:${proofHash}`,
        proofHash,
        verifierVersion: b.verifierVersion || "tlsnotary",
        disclosureManifest: b.disclosureManifest || {},
        verifiedAt: verified ? new Date() : null,
      })
      .returning();
    await this.db.update(evidence).set({ verificationStatus: verified ? "tlsnotary_verified" : "tlsnotary_failed" }).where(eq(evidence.id, e.id));
    return p;
  }
}

@Controller("v1/tlsnotary")
export class TlsNotaryController {
  constructor(private svc: TlsNotaryService) {}

  @Post("proofs")
  proof(@Req() r: any, @Body() b: any) {
    if (!hasPermission(r.praestActor, "evidence:write")) throw new ForbiddenException();
    return this.svc.submitProof(r.praestActor.organizationId, b.evidenceId, b);
  }

  // Called by our own verifier service, authenticated with a PRAEST-generated shared secret
  // (TLSNOTARY_WEBHOOK_TOKEN) - never accept a webhook without it, and this is the ONLY path that
  // can mark evidence tlsnotary_verified.
  @Public()
  @Post("webhook")
  webhook(@Headers("authorization") auth: string, @Body() b: any) {
    if (!process.env.TLSNOTARY_WEBHOOK_TOKEN || auth !== `Bearer ${process.env.TLSNOTARY_WEBHOOK_TOKEN}`) throw new ForbiddenException();
    if (!b.organizationId || !b.evidenceId) throw new Error("organizationId/evidenceId required");
    return this.svc.recordVerifierResult(b.organizationId, b.evidenceId, b);
  }
}
