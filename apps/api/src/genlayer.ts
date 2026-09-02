import {createAccount,createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {ExecutionResult,TransactionHashVariant} from "genlayer-js/types";

function privateKey(){const k=process.env.GENLAYER_STUDIONET_PRIVATE_KEY||process.env.GENLAYER_PRIVATE_KEY;if(!k)throw new Error("GENLAYER_STUDIONET_PRIVATE_KEY required");return k as `0x${string}`}
export class StudioNetAdapter{
 readonly client:any;
 constructor(){this.client=createClient({chain:studionet,account:createAccount(privateKey())});}
 async write(address:string,functionName:string,args:any[]=[]){return this.client.writeContract({address:address as `0x${string}`,functionName,args,value:0n}) as Promise<`0x${string}`>}
 async read(address:string,functionName:string,args:any[]=[],final=false){return this.client.readContract({address:address as `0x${string}`,functionName,args,transactionHashVariant:final?TransactionHashVariant.LATEST_FINAL:TransactionHashVariant.LATEST_NONFINAL})}
 async waitDecided(hash:string){return this.client.waitForTransactionReceipt({hash:hash as `0x${string}`,waitUntil:"decided",fullTransaction:true})}
 async waitFinalized(hash:string){const r=await this.client.waitForTransactionReceipt({hash:hash as `0x${string}`,waitUntil:"finalized",fullTransaction:true});if(r.txExecutionResultName!==ExecutionResult.FINISHED_WITH_RETURN)throw new Error(`GenLayer execution did not succeed: ${r.txExecutionResultName}`);return r}
 async appeal(hash:string,value?:bigint){return this.client.appealTransaction({txId:hash as `0x${string}`,value})}
 async canAppeal(hash:string){try{return await this.client.canAppeal({txId:hash as `0x${string}`})}catch{return false}}
 async finalize(hash:string){return this.client.finalizeTransaction({txId:hash as `0x${string}`})}
 async transaction(hash:string){return this.client.getTransaction({hash:hash as `0x${string}`})}
}
export const resolverAddress=(caseType:string)=>{
 const map:Record<string,string|undefined>={sla:process.env.GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS,service:process.env.GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS,x402:process.env.GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS,agent:process.env.GENLAYER_AGENT_AGREEMENT_RESOLVER_ADDRESS,event:process.env.GENLAYER_EVENT_RESOLVER_ADDRESS,escrow:process.env.GENLAYER_DISPUTE_RESOLVER_ADDRESS,dispute:process.env.GENLAYER_DISPUTE_RESOLVER_ADDRESS};
 const a=map[caseType]||process.env.GENLAYER_DISPUTE_RESOLVER_ADDRESS;if(!a)throw new Error(`GenLayer resolver not configured for ${caseType}`);return a;
};
