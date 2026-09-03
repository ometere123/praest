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
   * Records a proof submission. This endpoint (and the webhook below it) is the callback surface a
   * real TLSNotary verifier calls after it has independently run the MPC-TLS verification - it is
   * NOT itself a verifier, and does not treat "a POST arrived" as proof of anything. Only an
   * explicit `verified: true` assertion (expected to come from the verifier service, authenticated
   * via TLSNOTARY_WEBHOOK_TOKEN on the webhook path) marks the evidence verified; anything else is
   * recorded as a failed/unverified attempt so it can be audited, never silently upgraded.
   */
  async register(org: string, evidenceId: string, b: any) {
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
    return this.svc.register(r.praestActor.organizationId, b.evidenceId, b);
  }

  // Called by our own verifier service, authenticated with a PRAEST-generated shared secret
  // (TLSNOTARY_WEBHOOK_TOKEN) - never accept a webhook without it, and never trust an unauthenticated
  // caller's `verified: true` claim.
  @Public()
  @Post("webhook")
  webhook(@Headers("authorization") auth: string, @Body() b: any) {
    if (!process.env.TLSNOTARY_WEBHOOK_TOKEN || auth !== `Bearer ${process.env.TLSNOTARY_WEBHOOK_TOKEN}`) throw new ForbiddenException();
    if (!b.organizationId || !b.evidenceId) throw new Error("organizationId/evidenceId required");
    return this.svc.register(b.organizationId, b.evidenceId, b);
  }
}
