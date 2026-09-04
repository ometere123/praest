import {Body,Controller,ForbiddenException,Get,Inject,Post,Req,Res} from "@nestjs/common";import type {FastifyReply,FastifyRequest} from "fastify";import {DB} from "./database.module.js";import {x402Requests,cases,agreements} from "@praest/database";import {hasPermission} from "./request-context.js";import {sha256,canonicalJson} from "./crypto.js";import {and,eq} from "drizzle-orm";import {HTTPFacilitatorClient,x402ResourceServer} from "@x402/core/server";import {x402HTTPResourceServer,type HTTPAdapter,type HTTPRequestContext} from "@x402/core/http";import {ExactEvmScheme} from "@x402/evm/exact/server";import {Public} from "./public.decorator.js";
export class X402Service{constructor(@Inject(DB)private db:any){}private facilitator(){return new HTTPFacilitatorClient({url:process.env.X402_FACILITATOR_URL||"https://x402.org/facilitator",headers:process.env.X402_FACILITATOR_TOKEN?{authorization:`Bearer ${process.env.X402_FACILITATOR_TOKEN}`}:{}} as any)}async register(org:string,b:any){if(!b.network||!b.scheme||!b.paymentPayload||!b.obligation)throw new Error("network, scheme, paymentPayload and obligation required");const requestId=b.requestId||sha256(canonicalJson({network:b.network,scheme:b.scheme,paymentPayload:b.paymentPayload,obligation:b.obligation}));const [r]=await this.db.insert(x402Requests).values({organizationId:org,serviceId:b.serviceId,agentId:b.agentId,requestId,network:b.network,scheme:b.scheme,paymentPayload:b.paymentPayload,obligation:b.obligation,status:"observed"}).onConflictDoUpdate({target:x402Requests.requestId,set:{paymentPayload:b.paymentPayload,obligation:b.obligation,updatedAt:new Date()}}).returning();return r}async verifyAndSettle(org:string,b:any){if(!b.paymentPayload||!b.paymentRequirements)throw new Error('paymentPayload and paymentRequirements required');const f:any=this.facilitator();const verify=await f.verify({paymentPayload:b.paymentPayload,paymentRequirements:b.paymentRequirements});if(!verify?.isValid)throw new Error(`x402 verification failed: ${verify?.invalidReason||verify?.error||'invalid'}`);let settlement:any=null;if(b.settle!==false)settlement=await f.settle({paymentPayload:b.paymentPayload,paymentRequirements:b.paymentRequirements});const requestId=b.requestId||sha256(canonicalJson({paymentPayload:b.paymentPayload,paymentRequirements:b.paymentRequirements}));const [r]=await this.db.insert(x402Requests).values({organizationId:org,serviceId:b.serviceId,agentId:b.agentId,requestId,network:b.paymentRequirements.network,scheme:b.paymentRequirements.scheme,paymentPayload:b.paymentPayload,paymentReceipt:{verify,settlement},obligation:b.obligation||{resource:b.paymentRequirements.resource,description:b.paymentRequirements.description},status:settlement?'paid':'verified'}).onConflictDoUpdate({target:x402Requests.requestId,set:{paymentReceipt:{verify,settlement},status:settlement?'paid':'verified',updatedAt:new Date()}}).returning();return r}async openAssurance(org:string,requestId:string,agreementId:string,claim:string){const [x]=await this.db.select().from(x402Requests).where(and(eq(x402Requests.organizationId,org),eq(x402Requests.requestId,requestId))).limit(1);if(!x?.paymentReceipt)throw new Error('verified/paid x402 receipt required');const [a]=await this.db.select().from(agreements).where(and(eq(agreements.organizationId,org),eq(agreements.id,agreementId))).limit(1);if(!a)throw new Error('agreement not found');const [c]=await this.db.insert(cases).values({organizationId:org,agreementId,caseType:'x402',status:'open',claim,openedBy:`x402:${requestId}`}).returning();await this.db.update(x402Requests).set({status:'disputed',updatedAt:new Date()}).where(eq(x402Requests.id,x.id));return c}}
// Fastify adapter for @x402/core's framework-agnostic HTTP resource server.
class FastifyX402Adapter implements HTTPAdapter {
  constructor(private req: FastifyRequest) {}
  getHeader(name: string) { const v = this.req.headers[name.toLowerCase()]; return Array.isArray(v) ? v[0] : v; }
  getMethod() { return this.req.method; }
  getPath() { return (this.req as any).routeOptions?.url || this.req.url.split("?")[0]; }
  getUrl() { const proto = (this.getHeader("x-forwarded-proto") || "https"); const host = this.getHeader("host") || "localhost"; return `${proto}://${host}${this.req.url}`; }
  getAcceptHeader() { return this.getHeader("accept") || "*/*"; }
  getUserAgent() { return this.getHeader("user-agent") || ""; }
}

let x402HttpServer: x402HTTPResourceServer | null = null;
let x402HttpServerInit: Promise<x402HTTPResourceServer> | null = null;
// Lazily built/initialized on first request (initialize() makes a facilitator round-trip to
// fetch supported kinds) rather than at app boot, so a facilitator outage never blocks startup.
function getX402HttpServer(): Promise<x402HTTPResourceServer> {
  if (x402HttpServerInit) return x402HttpServerInit;
  x402HttpServerInit = (async () => {
    const facilitator = new HTTPFacilitatorClient({
      url: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
      headers: process.env.X402_FACILITATOR_TOKEN ? { authorization: `Bearer ${process.env.X402_FACILITATOR_TOKEN}` } : {},
    } as any);
    const resourceServer = new x402ResourceServer(facilitator as any).register("eip155:*", new ExactEvmScheme() as any);
    const payTo = process.env.X402_PAY_TO_EVM;
    if (!payTo) throw new Error("X402_PAY_TO_EVM required to serve x402-protected resources");
    const server = new x402HTTPResourceServer(resourceServer, {
      "GET /v1/x402/example-resource": {
        accepts: {
          scheme: "exact",
          payTo,
          price: process.env.X402_EXAMPLE_RESOURCE_PRICE || "$0.01",
          network: (process.env.X402_NETWORK as any) || "eip155:84532",
        },
        description: "PRAEST x402 example protected resource - demonstrates the full 402 challenge/verify/settle flow for agent-economy clients. Not a real product endpoint; wire your own protected routes the same way.",
        mimeType: "application/json",
      },
    });
    await server.initialize();
    x402HttpServer = server;
    return server;
  })();
  return x402HttpServerInit;
}

@Controller("v1/x402")export class X402Controller{constructor(private svc:X402Service){}@Post("requests")register(@Req()r:any,@Body()b:any){if(!hasPermission(r.praestActor,"x402:write"))throw new ForbiddenException();return this.svc.register(r.praestActor.organizationId,b)}@Post("verify-settle")verify(@Req()r:any,@Body()b:any){if(!hasPermission(r.praestActor,"x402:write"))throw new ForbiddenException();return this.svc.verifyAndSettle(r.praestActor.organizationId,b)}@Post("assurance")assurance(@Req()r:any,@Body()b:any){if(!hasPermission(r.praestActor,"disputes:write"))throw new ForbiddenException();return this.svc.openAssurance(r.praestActor.organizationId,b.requestId,b.agreementId,b.claim)}

  // Example x402-protected resource: no PRAEST API key/org auth - payment itself is the access
  // control, for autonomous agent-economy clients. Demonstrates the seller-side HTTP 402
  // challenge/verify/settle flow that was previously entirely unimplemented (only the
  // client-presented verify/settle half existed via POST /verify-settle above).
  @Public()
  @Get("example-resource")
  async exampleResource(@Req() req: FastifyRequest, @Res({ passthrough: false }) reply: FastifyReply) {
    const server = await getX402HttpServer();
    const context: HTTPRequestContext = { adapter: new FastifyX402Adapter(req), path: "/v1/x402/example-resource", method: "GET" };
    const result = await server.processHTTPRequest(context);
    if (result.type === "no-payment-required") { reply.status(500).send({ error: "route not configured for payment" }); return; }
    if (result.type === "payment-error") { reply.status(result.response.status).headers(result.response.headers).send(result.response.body); return; }
    // Settle BEFORE responding - paid status here only ever reflects a facilitator-verified/
    // settled payment, never a client-supplied claim (see the removed self-attested receipt()
    // endpoint history). This anonymous demo route has no PRAEST organization context, so it
    // isn't persisted to x402_requests (organizationId is NOT NULL there) - the org-scoped audit
    // trail is covered by POST /requests and /verify-settle above for real integrations.
    const requestId = sha256(canonicalJson({ paymentPayload: result.paymentPayload, paymentRequirements: result.paymentRequirements }));
    const settlement = await server.processSettlement(result.paymentPayload, result.paymentRequirements);
    const body = { message: "This is a PRAEST x402 example protected resource.", accessedAt: new Date().toISOString(), requestId, settled: settlement.success };
    reply.status(200).headers(settlement.headers).send(body);
  }
}
