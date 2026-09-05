import {readFile,writeFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import {config as loadEnv} from 'dotenv';import {createClient} from 'genlayer-js';import * as chains from 'genlayer-js/chains';
if(existsSync('.env.local'))loadEnv({path:'.env.local'});else if(existsSync('.env'))loadEnv();
async function main(){
const networkName=process.env.GENLAYER_NETWORK||'studioDevnet';
const chain=(chains as any)[networkName];if(!chain)throw new Error(`unknown GenLayer chain preset: ${networkName}`);
const client=createClient({chain} as any);
const path=`deployments/${networkName}.json`;
const deployment:any=JSON.parse(await readFile(path,'utf8'));
for(const [name,entry] of Object.entries<any>(deployment.contracts)){
  if(entry.address){console.log(`${name}: already have address ${entry.address}`);continue;}
  console.log(`resolving ${name} from tx ${entry.txHash}...`);
  const tx:any=await (client as any).getTransaction({hash:entry.txHash});
  const address=tx?.txDataDecoded?.contractAddress||tx?.data?.contract_address||null;
  if(!address){console.warn(`${name}: still unresolved (tx status: ${tx?.statusName||tx?.status}); it may not be finalized yet - rerun this script once it is.`);continue;}
  entry.address=address;console.log(`${name}: ${address}`);
}
await writeFile(path,JSON.stringify(deployment,null,2));
console.log(`updated ${path}`);
}
main().catch(err=>{console.error(err);process.exit(1)});
