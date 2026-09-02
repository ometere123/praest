import {Body,Controller,ForbiddenException,Get,Inject,Post,Query,Req} from "@nestjs/common";
import {DB} from "./database.module.js";
import {monitors,services,incidents,serviceCredentials} from "@praest/database";
import {and,eq} from "drizzle-orm";
import {createClient} from "@clickhouse/client";
import {Redis} from "@upstash/redis";
import {decryptSecret} from "./crypto.js";

function inMaintenance(assertions:any, observedAt:string){
  const t=new Date(observedAt).getTime();
  return (assertions?.maintenanceWindows||[]).some((w:any)=>{const a=new Date(w.start).getTime(),b=new Date(w.end).getTime();return Number.isFinite(a)&&Number.isFinite(b)&&t>=a&&t<=b;});
}
function requiredVotes(q:any,total:number){if(typeof q==="number")return Math.min(total,Math.max(1,q));if(q==="all")return total;if(q==="any")return 1;return Math.floor(total/2)+1;}

@Controller("v1/internal/probes")
export class ProbeController{
  constructor(@Inject(DB)private db:any){}
  private internal(r:any){if(r.praestActor?.type!=="internal")throw new ForbiddenException()}
  private redis(){const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;return url&&token?new Redis({url,token}):null}

  @Get("targets")
  async targets(@Req()r:any,@Query("region")region:string){
    this.internal(r);
    const rows=await this.db.select({monitor:monitors,service:services}).from(monitors).innerJoin(services,eq(monitors.serviceId,services.id)).where(and(eq(monitors.status,"active"),eq(services.status,"active")));
    const out=[];
    for(const x of rows as any[]){
      const regions=x.monitor.regions as string[];
      if(regions?.length&&!regions.includes(region))continue;
      let authHeaders:Record<string,string>={};
      if(x.monitor.credentialId){const [c]=await this.db.select().from(serviceCredentials).where(and(eq(serviceCredentials.id,x.monitor.credentialId),eq(serviceCredentials.organizationId,x.monitor.organizationId))).limit(1);if(c){const secret=JSON.parse(decryptSecret(c.ciphertext));authHeaders=secret.headers||{};}}
      out.push({id:x.monitor.id,organizationId:x.monitor.organizationId,serviceId:x.monitor.serviceId,url:x.monitor.url,method:x.monitor.method,timeoutMs:x.monitor.timeoutMs,intervalSeconds:x.monitor.intervalSeconds,regions:x.monitor.regions,assertions:x.monitor.assertions,authHeaders});
    }
    return out;
  }

  @Post("measurements")
  async ingest(@Req()r:any,@Body()b:any){
    this.internal(r);
    const required=["monitorId","organizationId","serviceId","region","collectorStatus","observedAt"];
    for(const k of required)if(b[k]===undefined)throw new Error(`${k} required`);
    const [monitor]=await this.db.select().from(monitors).where(and(eq(monitors.id,b.monitorId),eq(monitors.organizationId,b.organizationId))).limit(1);
    if(!monitor)throw new Error("monitor not found");

    if(process.env.CLICKHOUSE_URL){const ch=createClient({url:process.env.CLICKHOUSE_URL,username:process.env.CLICKHOUSE_USERNAME||"default",password:process.env.CLICKHOUSE_PASSWORD,database:process.env.CLICKHOUSE_DATABASE||"praest"});await ch.insert({table:process.env.CLICKHOUSE_MEASUREMENTS_TABLE||"measurements",values:[b],format:"JSONEachRow"});await ch.close();}

    if(b.collectorStatus!=="OK"||b.classification==="UNKNOWN")return {accepted:true,quorumStatus:"UNKNOWN"};
    if(inMaintenance(monitor.assertions,b.observedAt))return {accepted:true,quorumStatus:"MAINTENANCE"};

    const configured=(monitor.regions as string[])?.length?(monitor.regions as string[]):[b.region];
    const redis=this.redis();
    let states:Record<string,string>={};
    if(redis){
      const ttl=Math.max(180,Number(monitor.intervalSeconds||60)*3);
      await redis.set(`praest:probe:${monitor.id}:${b.region}`,JSON.stringify({classification:b.classification,observedAt:b.observedAt}),{ex:ttl});
      const vals=await redis.mget(...configured.map(region=>`praest:probe:${monitor.id}:${region}`));
      configured.forEach((region,i)=>{if(vals[i]){try{const x=typeof vals[i]==="string"?JSON.parse(vals[i] as string):vals[i] as any;states[region]=String(x.classification||"")}catch{}}});
    }else if(configured.length===1){states[b.region]=b.classification;}
    else return {accepted:true,quorumStatus:"PENDING",reason:"multi-region quorum requires Upstash Redis ephemeral coordination"};

    const known=Object.values(states).filter(Boolean);const failures=known.filter(x=>x==="SERVICE_FAILURE").length;const oks=known.filter(x=>x==="SERVICE_OK").length;const need=requiredVotes((monitor.assertions as any)?.quorum||"majority",configured.length);
    let quorumStatus="PENDING";
    if(failures>=need)quorumStatus="SERVICE_FAILURE";else if(oks>=need)quorumStatus="SERVICE_OK";

    if(quorumStatus==="SERVICE_FAILURE"){
      const open=await this.db.select().from(incidents).where(and(eq(incidents.monitorId,b.monitorId),eq(incidents.status,"open"))).limit(1);
      if(!open.length)await this.db.insert(incidents).values({organizationId:b.organizationId,serviceId:b.serviceId,monitorId:b.monitorId,status:"open",classification:"service_failure",severity:b.severity||"minor",startedAt:new Date(b.observedAt),summary:b.summary||"PRAEST regional quorum detected a service failure",metadata:{triggerMeasurementId:b.measurementId,regions:states,requiredVotes:need}});
    }
    if(quorumStatus==="SERVICE_OK")await this.db.update(incidents).set({status:"resolved",recoveredAt:new Date(b.observedAt),updatedAt:new Date(),metadata:{recoveryMeasurementId:b.measurementId,regions:states,requiredVotes:need}}).where(and(eq(incidents.monitorId,b.monitorId),eq(incidents.status,"open")));
    return {accepted:true,quorumStatus,knownRegions:known.length,requiredVotes:need};
  }
}
