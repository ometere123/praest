import {execFileSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
const strict=process.argv.includes("--strict");
const checks=[];
function tool(name,args=["--version"],required=true){try{const out=execFileSync(name,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],shell:process.platform==="win32"}).trim().split("\n")[0];checks.push({name,status:"ok",detail:out});return true}catch{checks.push({name,status:required?"missing":"warn",detail:"not installed in this environment"});return false}}
function file(path,required=true){const ok=existsSync(path);checks.push({name:path,status:ok?"ok":required?"missing":"warn",detail:ok?"present":"missing"});}

tool("node");tool("npm");tool("git");tool("python3");tool("cargo",["--version"],false);tool("forge",["--version"],false);tool("solana",["--version"],false);tool("genlayer",["--version"],false);tool("terraform",["version"],false);tool("docker",["--version"],false);
[
 "package.json",".env.example","README.md","apps/web/package.json","apps/api/package.json","apps/worker/package.json","apps/bridge/package.json",
 "contracts/genlayer/DecisionOutbox.py","contracts/evm/src/PraestSettlementReceiver.sol","contracts/solana/src/lib.rs","packages/protocol/src/index.ts",
 "docs/IMPLEMENTATION_STATUS.md","docs/DEPLOYMENT.md","docs/TRUST_MODEL.md","docs/HANDOFF.md"
].forEach(x=>file(x));
const envFile=existsSync(".env.local")?".env.local":existsSync(".env")?".env":null;
const requiredEnv=["DATABASE_URL","PRAEST_DATA_ENCRYPTION_KEY_BASE64","PRAEST_INTERNAL_TOKEN","GENLAYER_STUDIONET_PRIVATE_KEY","GENLAYER_DECISION_OUTBOX_ADDRESS","ZKSYNC_SEPOLIA_RPC_URL","BRIDGE_EVM_PRIVATE_KEY"];
// Feature-flag groups: presence only, never prints a value. "wired" = code actually reads this var today.
const featureGroups={
 "Temporal (self-hosted)":["TEMPORAL_ADDRESS","TEMPORAL_NAMESPACE","TEMPORAL_TASK_QUEUE"],
 "Globalping probes":["PROBE_PROVIDER","GLOBALPING_PROBE_LOCATIONS","GLOBALPING_MEASUREMENT_TYPE"],
 "Stripe (optional, off by default)":["STRIPE_ENABLED","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","STRIPE_PRICE_STARTER","STRIPE_PRICE_PRO","STRIPE_METER_EVENT_NAME"],
 "Brevo email (optional)":["BREVO_API_KEY","BREVO_FROM_EMAIL","BREVO_FROM_NAME"],
 "x402 (config only - no 402 guard wired yet)":["X402_ENABLED","X402_NETWORK","X402_FACILITATOR_URL","BASE_SEPOLIA_RPC_URL","BASE_SEPOLIA_CHAIN_ID","X402_USDC_ADDRESS","X402_PAY_TO_EVM","X402_PAYER_PRIVATE_KEY"],
 "TLSNotary (config only - no verifier deployed yet)":["TLSNOTARY_ENABLED","TLSNOTARY_VERIFIER_URL","TLSNOTARY_VERIFIER_WS_URL","TLSNOTARY_PROXY_WS_URL","TLSNOTARY_WEBHOOK_TOKEN"],
 "Internet Court (optional adapter)":["INTERNET_COURT_API_URL","INTERNET_COURT_API_KEY"],
 "GenLayer - wired (resolverAddress() reads these)":["GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS","GENLAYER_AGENT_AGREEMENT_RESOLVER_ADDRESS","GENLAYER_EVENT_RESOLVER_ADDRESS","GENLAYER_DISPUTE_RESOLVER_ADDRESS","GENLAYER_DECISION_OUTBOX_ADDRESS"],
 "GenLayer - deployed but NOT wired into apps/api yet":["GENLAYER_AGREEMENT_REGISTRY_ADDRESS","GENLAYER_EVIDENCE_ASSESSOR_ADDRESS","GENLAYER_SETTLEMENT_ENTITLEMENT_ADDRESS","GENLAYER_LIABILITY_RESOLVER_ADDRESS"],
};
if(envFile){
 const text=readFileSync(envFile,"utf8");
 const isSet=key=>new RegExp(`^${key}=.+$`,"m").test(text);
 for(const key of requiredEnv){const ok=isSet(key);checks.push({name:`env:${key}`,status:ok?"ok":"warn",detail:ok?"set":"not set"});}
 console.log(`\n--- feature readiness (from ${envFile}; values are never read into this output) ---`);
 for(const [group,keys] of Object.entries(featureGroups)){
  const present=keys.filter(isSet),missing=keys.filter(k=>!isSet(k));
  console.log(`\n${group}`);
  for(const k of present)console.log(`  ✓ ${k}`);
  for(const k of missing)console.log(`  ✗ ${k}  (not set)`);
 }
}else checks.push({name:"environment",status:"warn",detail:"create .env.local from .env.example"});
if(!existsSync("node_modules"))checks.push({name:"node_modules",status:"warn",detail:"run npm install before dependency-resolved build/typecheck"});
const pad=Math.max(...checks.map(x=>x.name.length));for(const c of checks)console.log(`${c.status==="ok"?"✓":c.status==="warn"?"!":"✗"} ${c.name.padEnd(pad)}  ${c.detail}`);
const hard=checks.filter(x=>x.status==="missing"),warnings=checks.filter(x=>x.status==="warn");console.log(`\n${checks.length-hard.length-warnings.length} ok, ${warnings.length} warnings, ${hard.length} missing required`);if(hard.length||(strict&&warnings.length))process.exit(1);
