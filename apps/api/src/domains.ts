import {Body, Controller, ForbiddenException, Get, Inject, Param, Post, Req} from "@nestjs/common";
import {DB} from "./database.module.js";
import {
  agreements, agreementVersions, agreementParties, chainRoutes, escrows, apiKeys, webhooks,
  integrations, services, serviceCredentials
} from "@praest/database";
import {and, eq} from "drizzle-orm";
import {canonicalJson, encryptSecret, sha256} from "./crypto.js";
import {hasPermission} from "./request-context.js";
import {addressToBytes32, idToBytes32} from "./address.js";
import {randomBytes, createHash, randomUUID} from "node:crypto";
import {createPublicClient, encodeFunctionData, http, parseAbi} from "viem";
import {PublicKey, SystemProgram} from "@solana/web3.js";
import {ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID} from "@solana/spl-token";

const ERC20_ABI = parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]);
const ESCROW_ABI = parseAbi([
  "function fund(bytes32 escrowId,bytes32 agreementId,address token,address provider,address customer,uint16 maxCustomerRemedyBps,uint256 amount)",
  "function escrows(bytes32) view returns (bytes32 agreementId,address token,address payer,address provider,address customer,uint16 maxCustomerRemedyBps,uint256 deposited,uint256 remaining,bool exists)"
]);

function parseTerms(value: unknown): any {
  if (typeof value === "string") return JSON.parse(value);
  return value ?? {};
}
function u64le(value: bigint) { const b=Buffer.alloc(8); b.writeBigUInt64LE(value); return b; }
function u16le(value: number) { const b=Buffer.alloc(2); b.writeUInt16LE(value); return b; }
function bytes32(hex: string) { const h=hex.startsWith("0x")?hex.slice(2):hex; if(h.length!==64)throw new Error("bytes32 expected"); return Buffer.from(h,"hex"); }

export class DomainService {
  constructor(@Inject(DB) private db: any) {}

  async createAgreement(org: string, b: any) {
    if (!b.name || !b.kind || !b.terms) throw new Error("name, kind and terms required");
    if (b.settlementRouteKey) {
      const [route] = await this.db.select().from(chainRoutes).where(and(eq(chainRoutes.key,b.settlementRouteKey),eq(chainRoutes.enabled,true))).limit(1);
      if (!route) throw new Error("settlement route not enabled");
    }
    const terms = parseTerms(b.terms);
    return this.db.transaction(async (tx:any) => {
      const [a] = await tx.insert(agreements).values({
        organizationId:org, serviceId:b.serviceId||null, agentId:b.agentId||null, name:b.name, kind:b.kind,
        status:b.status||"draft", settlementRouteKey:b.settlementRouteKey||null, settlementAsset:b.settlementAsset||null,
        governedValue:b.governedValue?String(b.governedValue):null, metadata:b.metadata||{}
      }).returning();
      const termsHash=sha256(canonicalJson(terms));
      await tx.insert(agreementVersions).values({organizationId:org,agreementId:a.id,version:1,terms,termsHash,policyVersion:Number(terms.policyVersion||1),effectiveAt:b.status==='active'?new Date():null});
      for(const p of b.parties||[]) {
        if(!p.role||!p.settlementAddress) throw new Error("party role and settlementAddress required");
        await tx.insert(agreementParties).values({organizationId:org,agreementId:a.id,partyType:p.partyType||"user",partyId:p.partyId||p.settlementAddress,role:p.role,settlementAddress:p.settlementAddress});
      }
      return {...a,termsHash};
    });
  }

  async addVersion(org:string,id:string,b:any){
    const [a]=await this.db.select().from(agreements).where(and(eq(agreements.id,id),eq(agreements.organizationId,org))).limit(1);
    if(!a)throw new Error("agreement not found");
    if(a.status!=="draft"&&a.status!=="suspended")throw new Error("active/completed agreement terms cannot be mutated; suspend and explicitly version first");
    const terms=parseTerms(b.terms);const next=a.currentVersion+1;const hash=sha256(canonicalJson(terms));
    return this.db.transaction(async(tx:any)=>{const [v]=await tx.insert(agreementVersions).values({organizationId:org,agreementId:id,version:next,terms,termsHash:hash,policyVersion:Number(terms.policyVersion||next)}).returning();await tx.update(agreements).set({currentVersion:next,updatedAt:new Date()}).where(eq(agreements.id,id));return v});
  }

  async accept(org:string,id:string,b:any){
    const [a]=await this.db.select().from(agreements).where(and(eq(agreements.id,id),eq(agreements.organizationId,org))).limit(1);if(!a)throw new Error("agreement not found");
    const [p]=await this.db.select().from(agreementParties).where(and(eq(agreementParties.agreementId,id),eq(agreementParties.id,b.partyId),eq(agreementParties.organizationId,org))).limit(1);if(!p)throw new Error("party not found");
    const [u]=await this.db.update(agreementParties).set({acceptedVersion:a.currentVersion,acceptedAt:new Date(),signature:b.signature||null}).where(eq(agreementParties.id,p.id)).returning();return u;
  }

  async activate(org:string,id:string){
    const [a]=await this.db.select().from(agreements).where(and(eq(agreements.id,id),eq(agreements.organizationId,org))).limit(1);if(!a)throw new Error("agreement not found");
    const ps=await this.db.select().from(agreementParties).where(and(eq(agreementParties.agreementId,id),eq(agreementParties.organizationId,org)));
    if(ps.length<2)throw new Error("at least two agreement parties required");
    if(ps.some((p:any)=>p.acceptedVersion!==a.currentVersion))throw new Error("all parties must accept current agreement version");
    const [v]=await this.db.update(agreements).set({status:"active",updatedAt:new Date()}).where(eq(agreements.id,id)).returning();return v;
  }

  async createEscrow(org:string,b:any){
    const [a]=await this.db.select().from(agreements).where(and(eq(agreements.id,b.agreementId),eq(agreements.organizationId,org))).limit(1);if(!a)throw new Error("agreement not found");
    const [v]=await this.db.select().from(agreementVersions).where(and(eq(agreementVersions.agreementId,a.id),eq(agreementVersions.version,a.currentVersion))).limit(1);
    const routeKey=b.routeKey||a.settlementRouteKey;if(!routeKey)throw new Error("settlement route required");
    const [route]=await this.db.select().from(chainRoutes).where(and(eq(chainRoutes.key,routeKey),eq(chainRoutes.enabled,true))).limit(1);if(!route)throw new Error("route unavailable");
    if(!b.asset||!b.amount||!b.payerAddress||!b.providerAddress||!b.customerAddress)throw new Error("asset, amount and settlement addresses required");
    const terms:any=v?.terms||{};
    const maxBps=Number(b.maxCustomerRemedyBps ?? terms?.remedy?.maxCustomerRemedyBps ?? terms?.remedy?.maxBps ?? 10000);
    if(!Number.isInteger(maxBps)||maxBps<0||maxBps>10000)throw new Error("maxCustomerRemedyBps must be 0..10000");
    const id=randomUUID();const onchainEscrowId=idToBytes32(id);
    // Validate address families before persisting economic policy.
    addressToBytes32(b.asset,route.protocol);addressToBytes32(b.payerAddress,route.protocol);addressToBytes32(b.providerAddress,route.protocol);addressToBytes32(b.customerAddress,route.protocol);
    const [e]=await this.db.insert(escrows).values({id,organizationId:org,agreementId:a.id,routeKey,asset:b.asset,assetDecimals:Number(b.assetDecimals??6),payerAddress:b.payerAddress,providerAddress:b.providerAddress,customerAddress:b.customerAddress,maxCustomerRemedyBps:maxBps,amount:String(b.amount),remainingAmount:String(b.amount),status:"created",onchainEscrowId}).returning();
    return {...e,route};
  }

  async prepareEscrowFunding(org:string,id:string){
    const [e]=await this.db.select().from(escrows).where(and(eq(escrows.id,id),eq(escrows.organizationId,org))).limit(1);if(!e)throw new Error("escrow not found");
    const [route]=await this.db.select().from(chainRoutes).where(and(eq(chainRoutes.key,e.routeKey),eq(chainRoutes.enabled,true))).limit(1);if(!route)throw new Error("route unavailable");
    const agreementId=idToBytes32(e.agreementId);const escrowId=e.onchainEscrowId;
    if(route.protocol==="ethereum"){
      if(!route.escrowContract)throw new Error("route escrow contract not deployed");
      const approve=encodeFunctionData({abi:ERC20_ABI,functionName:"approve",args:[route.escrowContract as `0x${string}`,BigInt(e.amount)]});
      const fund=encodeFunctionData({abi:ESCROW_ABI,functionName:"fund",args:[escrowId as `0x${string}`,agreementId as `0x${string}`,e.asset as `0x${string}`,e.providerAddress as `0x${string}`,e.customerAddress as `0x${string}`,e.maxCustomerRemedyBps,BigInt(e.amount)]});
      return {protocol:"ethereum",routeKey:route.key,chainId:Number(route.chainId),domainId:route.domainId,rpcEnv:route.rpcEnv,payerAddress:e.payerAddress,escrowId,agreementId,transactions:[{purpose:"approve",to:e.asset,data:approve,value:"0"},{purpose:"fund",to:route.escrowContract,data:fund,value:"0"}]};
    }
    if(!route.receiver)throw new Error("Solana route program not deployed/configured");
    const program=new PublicKey(route.receiver),payer=new PublicKey(e.payerAddress),mint=new PublicKey(e.asset),provider=new PublicKey(e.providerAddress),customer=new PublicKey(e.customerAddress);
    const [escrowPda]=PublicKey.findProgramAddressSync([Buffer.from("praest-escrow"),bytes32(escrowId)],program);
    const payerAta=getAssociatedTokenAddressSync(mint,payer,false,TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID);
    const vaultAta=getAssociatedTokenAddressSync(mint,escrowPda,true,TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID);
    const data=Buffer.concat([Buffer.from([1]),bytes32(escrowId),bytes32(agreementId),provider.toBuffer(),customer.toBuffer(),u16le(e.maxCustomerRemedyBps),u64le(BigInt(e.amount))]);
    return {protocol:"sealevel",routeKey:route.key,chainId:route.chainId,domainId:route.domainId,rpcEnv:route.rpcEnv,chain:`solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z`,payerAddress:e.payerAddress,programId:program.toBase58(),escrowId,agreementId,instruction:{dataBase64:data.toString("base64"),accounts:[
      {pubkey:payer.toBase58(),isSigner:true,isWritable:true},{pubkey:escrowPda.toBase58(),isSigner:false,isWritable:true},{pubkey:mint.toBase58(),isSigner:false,isWritable:false},{pubkey:payerAta.toBase58(),isSigner:false,isWritable:true},{pubkey:vaultAta.toBase58(),isSigner:false,isWritable:true},{pubkey:TOKEN_PROGRAM_ID.toBase58(),isSigner:false,isWritable:false},{pubkey:ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),isSigner:false,isWritable:false},{pubkey:SystemProgram.programId.toBase58(),isSigner:false,isWritable:false}
    ]}};
  }

  async confirmEscrowFunding(org:string,id:string,txHash?:string){
    const [e]=await this.db.select().from(escrows).where(and(eq(escrows.id,id),eq(escrows.organizationId,org))).limit(1);if(!e)throw new Error("escrow not found");
    const [route]=await this.db.select().from(chainRoutes).where(eq(chainRoutes.key,e.routeKey)).limit(1);if(!route)throw new Error("route unavailable");
    const rpc=process.env[route.rpcEnv];if(!rpc)throw new Error(`${route.rpcEnv} required to verify funding`);
    if(route.protocol==="ethereum"){
      if(!route.escrowContract)throw new Error("route escrow contract unavailable");
      const client=createPublicClient({transport:http(rpc)});
      const onchain:any=await client.readContract({address:route.escrowContract as `0x${string}`,abi:ESCROW_ABI,functionName:"escrows",args:[e.onchainEscrowId as `0x${string}`]});
      const [agreementId,token,payer,provider,customer,maxBps,deposited,remaining,exists]=onchain;
      if(!exists||String(agreementId).toLowerCase()!==idToBytes32(e.agreementId).toLowerCase()||String(token).toLowerCase()!==e.asset.toLowerCase()||String(payer).toLowerCase()!==e.payerAddress.toLowerCase()||String(provider).toLowerCase()!==e.providerAddress.toLowerCase()||String(customer).toLowerCase()!==e.customerAddress.toLowerCase()||Number(maxBps)!==e.maxCustomerRemedyBps||BigInt(deposited)<BigInt(e.amount)||BigInt(remaining)<BigInt(e.amount))throw new Error("on-chain escrow does not match PRAEST policy");
    } else {
      if(!route.receiver)throw new Error("Solana program unavailable");
      const program=new PublicKey(route.receiver);const [pda]=PublicKey.findProgramAddressSync([Buffer.from("praest-escrow"),bytes32(e.onchainEscrowId)],program);
      const response=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:[pda.toBase58(),{encoding:"base64",commitment:"confirmed"}]})});
      if(!response.ok)throw new Error(`Solana RPC ${response.status}`);const json:any=await response.json();const b64=json?.result?.value?.data?.[0];if(!b64)throw new Error("Solana escrow account not found");const data=Buffer.from(b64,"base64");
      if(data.length<214)throw new Error("invalid Solana escrow account");
      const storedEscrow=`0x${data.subarray(0,32).toString("hex")}`,storedAgreement=`0x${data.subarray(32,64).toString("hex")}`;
      const mint=new PublicKey(data.subarray(64,96)).toBase58(),payer=new PublicKey(data.subarray(96,128)).toBase58(),provider=new PublicKey(data.subarray(128,160)).toBase58(),customer=new PublicKey(data.subarray(160,192)).toBase58();
      const maxBps=data.readUInt16LE(192),deposited=data.readBigUInt64LE(194),remaining=data.readBigUInt64LE(202);
      if(storedEscrow.toLowerCase()!==e.onchainEscrowId.toLowerCase()||storedAgreement.toLowerCase()!==idToBytes32(e.agreementId).toLowerCase()||mint!==e.asset||payer!==e.payerAddress||provider!==e.providerAddress||customer!==e.customerAddress||maxBps!==e.maxCustomerRemedyBps||deposited<BigInt(e.amount)||remaining<BigInt(e.amount))throw new Error("Solana escrow does not match PRAEST policy");
    }
    const [saved]=await this.db.update(escrows).set({status:"funded",fundingTxHash:txHash||e.fundingTxHash||null,fundedAt:new Date(),updatedAt:new Date()}).where(eq(escrows.id,e.id)).returning();return saved;
  }

  async serviceCredential(org:string,serviceId:string,b:any){const [svc]=await this.db.select().from(services).where(and(eq(services.id,serviceId),eq(services.organizationId,org))).limit(1);if(!svc)throw new Error("service not found");if(!b.name||!b.kind||!b.secret)throw new Error("name, kind and secret required");const secret=typeof b.secret==='string'?{value:b.secret}:b.secret;const [row]=await this.db.insert(serviceCredentials).values({organizationId:org,serviceId,name:b.name,kind:b.kind,ciphertext:encryptSecret(canonicalJson(secret))}).returning();return {...row,ciphertext:undefined};}
  async listApiKeys(org:string){const rows=await this.db.select().from(apiKeys).where(eq(apiKeys.organizationId,org));return rows.map((r:any)=>({id:r.id,name:r.name,prefix:r.prefix,permissions:r.permissions,lastUsedAt:r.lastUsedAt,revokedAt:r.revokedAt,createdAt:r.createdAt}));}
  async revokeApiKey(org:string,id:string){const [row]=await this.db.update(apiKeys).set({revokedAt:new Date()}).where(and(eq(apiKeys.id,id),eq(apiKeys.organizationId,org))).returning();if(!row)throw new Error("API key not found");return {id:row.id,revokedAt:row.revokedAt};}
  async apiKey(org:string,b:any){const prefix=`prst_${randomBytes(5).toString('hex')}`;const raw=`${prefix}.${randomBytes(32).toString('base64url')}`;const secretHash=createHash('sha256').update(raw).digest('hex');const permissions=Array.isArray(b.permissions)?b.permissions:String(b.permissions||'').split(',').map((x:string)=>x.trim()).filter(Boolean);const [row]=await this.db.insert(apiKeys).values({organizationId:org,name:b.name||"API key",prefix,secretHash,permissions}).returning();return {...row,key:raw,secretHash:undefined};}
  async webhook(org:string,b:any){if(!b.url?.startsWith('https://'))throw new Error('webhook URL must use HTTPS');const secret=b.secret||randomBytes(32).toString('base64url');const events=Array.isArray(b.events)?b.events:String(b.events||'*').split(',').map((x:string)=>x.trim()).filter(Boolean);const [row]=await this.db.insert(webhooks).values({organizationId:org,url:b.url,events,secretCiphertext:encryptSecret(secret)}).returning();return {...row,secret};}
  async integration(org:string,b:any){if(!b.kind||!b.name||!b.config)throw new Error('kind, name and config required');const [row]=await this.db.insert(integrations).values({organizationId:org,kind:b.kind,name:b.name,configCiphertext:encryptSecret(canonicalJson(b.config))}).returning();return {...row,configCiphertext:undefined};}
  async routes(){return this.db.select().from(chainRoutes).where(eq(chainRoutes.enabled,true));}
}

@Controller("v1")
export class DomainController {
  constructor(private svc:DomainService){}
  private p(r:any,x:string){if(!hasPermission(r.praestActor,x))throw new ForbiddenException();if(!r.praestActor.organizationId)throw new ForbiddenException("organization required");return r.praestActor.organizationId;}
  @Post("agreements") agreement(@Req()r:any,@Body()b:any){return this.svc.createAgreement(this.p(r,"agreements:write"),b);}
  @Post("agreements/:id/versions") version(@Req()r:any,@Param("id")id:string,@Body()b:any){return this.svc.addVersion(this.p(r,"agreements:write"),id,b);}
  @Post("agreements/:id/accept") accept(@Req()r:any,@Param("id")id:string,@Body()b:any){return this.svc.accept(this.p(r,"agreements:write"),id,b);}
  @Post("agreements/:id/activate") activate(@Req()r:any,@Param("id")id:string){return this.svc.activate(this.p(r,"agreements:write"),id);}
  @Post("escrows") escrow(@Req()r:any,@Body()b:any){return this.svc.createEscrow(this.p(r,"settlements:write"),b);}
  @Post("escrows/:id/prepare-funding") prepareFunding(@Req()r:any,@Param("id")id:string){return this.svc.prepareEscrowFunding(this.p(r,"settlements:write"),id);}
  @Post("escrows/:id/confirm-funding") confirmFunding(@Req()r:any,@Param("id")id:string,@Body()b:any){return this.svc.confirmEscrowFunding(this.p(r,"settlements:write"),id,b?.txHash);}
  @Get("api-keys") apiKeys(@Req()r:any){return this.svc.listApiKeys(this.p(r,"developer:read"));}
  @Post("api-keys/:id/revoke") revokeApiKey(@Req()r:any,@Param("id")id:string){return this.svc.revokeApiKey(this.p(r,"developer:write"),id);}
  @Post("services/:id/credentials") credential(@Req()r:any,@Param("id")id:string,@Body()b:any){return this.svc.serviceCredential(this.p(r,"services:write"),id,b);}
  @Post("api-keys") apiKey(@Req()r:any,@Body()b:any){return this.svc.apiKey(this.p(r,"developer:write"),b);}
  @Post("webhooks") webhook(@Req()r:any,@Body()b:any){return this.svc.webhook(this.p(r,"developer:write"),b);}
  @Post("integrations") integration(@Req()r:any,@Body()b:any){return this.svc.integration(this.p(r,"integrations:write"),b);}
  @Get("routes") routes(@Req()r:any){this.p(r,"settlements:read");return this.svc.routes();}
}
