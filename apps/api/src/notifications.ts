import {Injectable,Inject} from "@nestjs/common";import {DB} from "./database.module.js";import {notifications,webhooks,webhookDeliveries} from "@praest/database";import {eq,and} from "drizzle-orm";import {BrevoClient} from "@getbrevo/brevo";import {createHmac} from "node:crypto";import {decryptSecret} from "./crypto.js";import {probeHttps} from "./safe-fetch.js";
@Injectable() export class NotificationService{constructor(@Inject(DB)private db:any){}async emit(org:string,eventType:string,title:string,body:string,metadata:any={}){await this.db.insert(notifications).values({organizationId:org,eventType,title,body,metadata});const hooks=await this.db.select().from(webhooks).where(and(eq(webhooks.organizationId,org),eq(webhooks.enabled,true)));for(const h of hooks){const events=h.events as string[];if(events.length&& !events.includes(eventType)&&!events.includes("*"))continue;await this.db.insert(webhookDeliveries).values({organizationId:org,webhookId:h.id,eventType,eventId:crypto.randomUUID(),payload:{eventType,title,body,metadata},nextAttemptAt:new Date()})}}
  // Optional/no-op when BREVO_API_KEY is unset, matching the previous Resend behavior - notifications
  // still record to the `notifications`/webhook-delivery tables regardless of whether email is configured.
  async email(to:string,subject:string,html:string){
    const apiKey=process.env.BREVO_API_KEY;
    if(!apiKey)return;
    const fromEmail=process.env.BREVO_FROM_EMAIL;
    if(!fromEmail)throw new Error("BREVO_FROM_EMAIL required when BREVO_API_KEY is set");
    const fromName=process.env.BREVO_FROM_NAME;
    const brevo=new BrevoClient({apiKey});
    await brevo.transactionalEmails.sendTransacEmail({subject,htmlContent:html,sender:{email:fromEmail,name:fromName||undefined},to:[{email:to}]});
  }
  async deliver(row:any,hook:any){const payload=JSON.stringify(row.payload);const secret=decryptSecret(hook.secretCiphertext);const sig=createHmac("sha256",secret).update(`${row.eventId}.${payload}`).digest("hex");try{const r=await probeHttps(hook.url,{method:"POST",headers:{"content-type":"application/json","x-praest-event-id":row.eventId,"x-praest-signature":`sha256=${sig}`},body:payload,timeoutMs:10000,maxBytes:100_000});if(r.statusCode<200||r.statusCode>=300)throw new Error(`HTTP ${r.statusCode}`);await this.db.update(webhookDeliveries).set({status:"delivered",deliveredAt:new Date(),attempt:row.attempt+1}).where(eq(webhookDeliveries.id,row.id))}catch(e:any){const attempt=row.attempt+1;await this.db.update(webhookDeliveries).set({status:attempt>=8?"dead_letter":"pending",attempt,lastError:String(e.message||e),nextAttemptAt:new Date(Date.now()+Math.min(3600_000,2**attempt*1000))}).where(eq(webhookDeliveries.id,row.id))}} async deliverById(id:string,org?:string){const rows=await this.db.select({delivery:webhookDeliveries,hook:webhooks}).from(webhookDeliveries).innerJoin(webhooks,eq(webhookDeliveries.webhookId,webhooks.id)).where(org?and(eq(webhookDeliveries.id,id),eq(webhookDeliveries.organizationId,org)):eq(webhookDeliveries.id,id)).limit(1);const hit=rows[0];if(!hit)throw new Error("webhook delivery not found");return this.deliver(hit.delivery,hit.hook)}}

import {Controller,Get,Param,Post,Req,ForbiddenException} from "@nestjs/common";import {hasPermission} from "./request-context.js";
@Controller("v1/internal/webhook-deliveries") export class InternalNotificationsController{constructor(private readonly svc:NotificationService,@Inject(DB)private db:any){}@Get("pending") async pending(@Req()r:any){if(r.praestActor?.type!=="internal")throw new ForbiddenException();const now=new Date();const rows=await this.db.select().from(webhookDeliveries);return rows.filter((x:any)=>x.status==="pending"&&(!x.nextAttemptAt||x.nextAttemptAt<=now)).slice(0,100).map((x:any)=>({id:x.id,organizationId:x.organizationId,attempt:x.attempt}))}@Post(":id/run") run(@Req()r:any,@Param("id")id:string){if(r.praestActor?.type!=="internal"&&!hasPermission(r.praestActor,"webhooks:write"))throw new ForbiddenException();return this.svc.deliverById(id,r.praestActor.organizationId)}
  // Cron-friendly alternative to the Temporal webhookSweep workflow: finds due pending
  // deliveries and retries each, same as the workflow's loop body, just triggered externally
  // instead of by Temporal. Point a scheduler (Supabase pg_cron + pg_net, Railway Cron, etc.)
  // at this on whatever cadence you want retries to run.
  @Post("sweep")
  async sweep(@Req() r: any) {
    if (r.praestActor?.type !== "internal") throw new ForbiddenException();
    const now = new Date();
    const rows = await this.db.select().from(webhookDeliveries);
    const due = rows.filter((x: any) => x.status === "pending" && (!x.nextAttemptAt || x.nextAttemptAt <= now)).slice(0, 100);
    const results = await Promise.allSettled(due.map((x: any) => this.svc.deliverById(x.id, x.organizationId)));
    return { swept: results.length, failed: results.filter((r) => r.status === "rejected").length };
  }
}
