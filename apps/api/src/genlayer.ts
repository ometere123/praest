import {createAccount,createClient} from "genlayer-js";
import * as chains from "genlayer-js/chains";
import {ExecutionResult,TransactionHashVariant} from "genlayer-js/types";

function privateKey(){const k=process.env.GENLAYER_STUDIONET_PRIVATE_KEY||process.env.GENLAYER_PRIVATE_KEY;if(!k)throw new Error("GENLAYER_STUDIONET_PRIVATE_KEY required");return k as `0x${string}`}
// Consensus v0.6 migration: studio-dev (chain 61997) is a distinct network from the stable
// studionet (chain 61999) - its own consensus contract, not an RPC swap on the same chain
// object. GENLAYER_NETWORK selects which genlayer-js chain preset to use; defaults to
// studioDevnet per the current migration testing phase. See docs/GENLAYER_V06_MIGRATION.md.
function chain(){const name=process.env.GENLAYER_NETWORK||"studioDevnet";const c=(chains as any)[name];if(!c)throw new Error(`unknown GenLayer chain preset: ${name}`);return c}
export class StudioNetAdapter{
 readonly client:any;
 constructor(){this.client=createClient({chain:chain(),account:createAccount(privateKey())});}
 // v0.6 requires an explicit fee-funded write - quote current network prices, then submit the
 // returned distribution/feeValue unchanged (never invent fee numbers).
 async write(address:string,functionName:string,args:any[]=[]){
  const estimate=await this.client.estimateTransactionFeesForWrite({address:address as `0x${string}`,functionName,args});
  return this.client.writeContract({address:address as `0x${string}`,functionName,args,fees:{distribution:estimate.distribution,feeValue:estimate.feeValue}}) as Promise<`0x${string}`>;
 }
 async read(address:string,functionName:string,args:any[]=[],final=false){return this.client.readContract({address:address as `0x${string}`,functionName,args,transactionHashVariant:final?TransactionHashVariant.LATEST_FINAL:TransactionHashVariant.LATEST_NONFINAL})}
 async waitDecided(hash:string){return this.client.waitForTransactionReceipt({hash:hash as `0x${string}`,waitUntil:"decided",fullTransaction:true})}
 async waitFinalized(hash:string){const r=await this.client.waitForTransactionReceipt({hash:hash as `0x${string}`,waitUntil:"finalized",fullTransaction:true});if(r.txExecutionResultName!==ExecutionResult.FINISHED_WITH_RETURN)throw new Error(`GenLayer execution did not succeed: ${r.txExecutionResultName}`);return r}
 // v0.6: an ordinary unfunded appeal can revert - fetch the current appeal charge and fund it,
 // never submit a bare/low-level appeal.
 async appeal(hash:string,value?:bigint){const charge=value??await this.client.getAppealCharge({txId:hash as `0x${string}`});return this.client.appealTransaction({txId:hash as `0x${string}`,value:charge})}
 async canAppeal(hash:string){try{return await this.client.canAppeal({txId:hash as `0x${string}`})}catch{return false}}
 // v0.6 protocol lifecycle projection - resolutionAction==="Finalize" is the authoritative
 // finalize-readiness signal (there is no "ready to finalize" transaction status).
 async getLifecycle(hash:string){return this.client.advanced.getTransactionLifecycle({hash:hash as `0x${string}`})}
 async finalize(hash:string){return this.client.finalizeTransaction({txId:hash as `0x${string}`})}
 async transaction(hash:string){return this.client.getTransaction({hash:hash as `0x${string}`})}
}
export const resolverAddress=(caseType:string)=>{
 const map:Record<string,string|undefined>={sla:process.env.GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS,service:process.env.GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS,x402:process.env.GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS,agent:process.env.GENLAYER_AGENT_AGREEMENT_RESOLVER_ADDRESS,event:process.env.GENLAYER_EVENT_RESOLVER_ADDRESS,escrow:process.env.GENLAYER_DISPUTE_RESOLVER_ADDRESS,dispute:process.env.GENLAYER_DISPUTE_RESOLVER_ADDRESS,liability:process.env.GENLAYER_LIABILITY_RESOLVER_ADDRESS};
 const a=map[caseType]||process.env.GENLAYER_DISPUTE_RESOLVER_ADDRESS;if(!a)throw new Error(`GenLayer resolver not configured for ${caseType}`);return a;
};
