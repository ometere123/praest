import {proxyActivities,sleep,defineSignal,setHandler} from "@temporalio/workflow";import type {activities} from "./activities.js";
const a=proxyActivities<typeof activities>({startToCloseTimeout:"10 minutes",retry:{maximumAttempts:8,initialInterval:"2 seconds",backoffCoefficient:2,maximumInterval:"5 minutes"}});
export const cancelSignal=defineSignal("cancel");
export async function caseLifecycle(organizationId:string,caseId:string){let canceled=false;setHandler(cancelSignal,()=>{canceled=true});const adj:any=await a.adjudicate(organizationId,caseId);if(canceled)return {status:"canceled"};const deadline=adj.appealDeadline?new Date(adj.appealDeadline).getTime():Date.now();const wait=Math.max(0,deadline-Date.now());if(wait)await sleep(wait);if(canceled)return {status:"canceled"};return a.finalize(organizationId,adj.id)}
export async function monitorLoop(organizationId:string,monitorId:string,intervalSeconds:number){let canceled=false;setHandler(cancelSignal,()=>{canceled=true});while(!canceled){await a.runMonitor(organizationId,monitorId);await sleep(Math.max(30,intervalSeconds)*1000)}return {status:"stopped"}}
export async function webhookDelivery(organizationId:string,deliveryId:string){return a.processWebhook(organizationId,deliveryId)}

export async function webhookSweep(){while(true){const due:any[]=await a.pendingWebhooks();for(const row of due){try{await a.processWebhook(row.organizationId,row.id)}catch{/* activity retry policy + durable row state handles retry */}}await sleep("15 seconds")}}
