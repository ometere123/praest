import {heartbeat} from "@temporalio/activity";
const base=()=>process.env.PRAEST_API_URL||"http://localhost:4000";
async function request(path:string,organizationId:string,method="POST",body?:any){const token=process.env.PRAEST_INTERNAL_TOKEN;if(!token)throw new Error("PRAEST_INTERNAL_TOKEN required");const r=await fetch(new URL(`/v1/${path}`,base()),{method,headers:{"content-type":"application/json","x-praest-internal-token":token,"x-praest-organization-id":organizationId},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();const d=t?JSON.parse(t):null;if(!r.ok)throw new Error(d?.message||`API ${r.status}`);return d}

async function requestGlobal(path:string,method="GET",body?:any){const token=process.env.PRAEST_INTERNAL_TOKEN;if(!token)throw new Error("PRAEST_INTERNAL_TOKEN required");const r=await fetch(new URL(`/v1/${path}`,base()),{method,headers:{"content-type":"application/json","x-praest-internal-token":token},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();const d=t?JSON.parse(t):null;if(!r.ok)throw new Error(d?.message||`API ${r.status}`);return d}
export const activities={
 adjudicate:(org:string,caseId:string)=>request(`cases/${caseId}/adjudicate`,org),
 finalize:(org:string,adjudicationId:string)=>request(`adjudications/${adjudicationId}/finalize`,org),
 runMonitor:(org:string,monitorId:string)=>request(`monitors/${monitorId}/run`,org),
 processWebhook:(org:string,deliveryId:string)=>request(`internal/webhook-deliveries/${deliveryId}/run`,org),
 pendingWebhooks:()=>requestGlobal("internal/webhook-deliveries/pending"),
 health:async()=>{heartbeat("checking");const r=await fetch(new URL('/healthz',base()));if(!r.ok)throw new Error('API unhealthy');return r.json()}
};
