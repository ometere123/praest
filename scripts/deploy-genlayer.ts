import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {existsSync} from 'node:fs';import {config as loadEnv} from 'dotenv';import {createAccount,createClient} from 'genlayer-js';import * as chains from 'genlayer-js/chains';
if(existsSync('.env.local'))loadEnv({path:'.env.local'});else if(existsSync('.env'))loadEnv();
const ALL_NAMES=['AgreementRegistry','EvidenceAssessor','ServiceAssuranceResolver','DisputeResolver','SettlementEntitlement','AgentAgreementResolver','LiabilityResolver','EventResolver','DecisionOutbox'];
async function main(){
// Optional: pass one or more contract names as CLI args to redeploy only those (e.g. after a
// source-only fix to a single contract) instead of churning all 9 and orphaning the other
// addresses already in .env.local. Merges into the existing deployments/<network>.json rather
// than overwriting it.
const requested=process.argv.slice(2).filter(a=>!a.startsWith('-'));
const names=requested.length?requested:ALL_NAMES;
for(const n of names)if(!ALL_NAMES.includes(n))throw new Error(`unknown contract: ${n}`);
const pk=process.env.GENLAYER_STUDIONET_PRIVATE_KEY as `0x${string}`|undefined;if(!pk)throw new Error('GENLAYER_STUDIONET_PRIVATE_KEY required');const account=createAccount(pk);
// Consensus v0.6 migration: studio-dev (chain 61997) has its own consensus contract, not an RPC
// swap on studionet's chain object. GENLAYER_NETWORK selects the genlayer-js chain preset;
// defaults to studioDevnet per the current migration testing phase.
const networkName=process.env.GENLAYER_NETWORK||'studioDevnet';
const chain=(chains as any)[networkName];if(!chain)throw new Error(`unknown GenLayer chain preset: ${networkName}`);
const client=createClient({chain,account} as any);
const outPath=`deployments/${networkName}.json`;
let deployment:any={network:networkName,rpc:chain.rpcUrls.default.http[0],deployedAt:new Date().toISOString(),contracts:{}};
if(existsSync(outPath)){try{const existing=JSON.parse(await readFile(outPath,'utf8'));deployment.contracts=existing.contracts||{};}catch{}}
await mkdir('deployments',{recursive:true});
// Write after EVERY contract, not just once at the end - a mid-batch failure (e.g. a transient
// RPC error on contract N of a multi-contract run) must not lose the on-chain, fee-paid
// deployments of contracts 1..N-1 that already succeeded.
async function persist(){deployment.deployedAt=new Date().toISOString();await writeFile(outPath,JSON.stringify(deployment,null,2));}
for(const name of names){
 const code=await readFile(path.join('contracts/genlayer',`${name}.py`),'utf8');
 console.log(`deploying ${name}...`);
 // v0.6 requires an explicit fee-funded deploy - quote current network prices, then submit the
 // returned distribution/feeValue unchanged (never invent fee numbers).
 const estimate:any=await (client as any).estimateTransactionFees();
 const tx=await (client as any).deployContract({account,code,args:[],fees:{distribution:estimate.distribution,feeValue:estimate.feeValue}});
 deployment.contracts[name]={txHash:tx,address:null};
 await persist(); // record the tx immediately - a fee has already been spent at this point
 const receipt:any=await (client as any).waitForTransactionReceipt({hash:tx,waitUntil:'finalized',fullTransaction:true});
 const address=receipt?.contractAddress||receipt?.data?.contractAddress||receipt?.decodedData?.contractAddress||receipt?.data?.decodedData?.contractAddress||receipt?.consensus_data?.contract_address||receipt?.txDataDecoded?.contractAddress;
 if(!address)console.warn(`${name}: deployed tx ${tx}; address was not exposed in the known receipt fields. Run scripts/resolve-genlayer-addresses.ts afterward.`);
 deployment.contracts[name]={txHash:tx,address:address||null};
 await persist();
 console.log(`wrote ${outPath} (${name})`);
}
}
main().catch(err=>{console.error(err);process.exit(1)});
