import {execFileSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
const strict=process.argv.includes("--strict");
const checks=[];
function tool(name,args=["--version"],required=true){try{const out=execFileSync(name,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim().split("\n")[0];checks.push({name,status:"ok",detail:out});return true}catch{checks.push({name,status:required?"missing":"warn",detail:"not installed in this environment"});return false}}
function file(path,required=true){const ok=existsSync(path);checks.push({name:path,status:ok?"ok":required?"missing":"warn",detail:ok?"present":"missing"});}

tool("node");tool("npm");tool("git");tool("python3");tool("cargo",["--version"],false);tool("forge",["--version"],false);tool("solana",["--version"],false);tool("genlayer",["--version"],false);tool("terraform",["version"],false);tool("docker",["--version"],false);
[
 "package.json",".env.example","README.md","apps/web/package.json","apps/api/package.json","apps/worker/package.json","apps/bridge/package.json",
 "contracts/genlayer/DecisionOutbox.py","contracts/evm/src/PraestSettlementReceiver.sol","contracts/solana/src/lib.rs","packages/protocol/src/index.ts",
 "docs/IMPLEMENTATION_STATUS.md","docs/DEPLOYMENT.md","docs/TRUST_MODEL.md","docs/HANDOFF.md"
].forEach(x=>file(x));
const envFile=existsSync(".env.local")?".env.local":existsSync(".env")?".env":null;
const requiredEnv=["DATABASE_URL","PRAEST_DATA_ENCRYPTION_KEY_BASE64","PRAEST_INTERNAL_TOKEN","GENLAYER_STUDIONET_PRIVATE_KEY","GENLAYER_DECISION_OUTBOX_ADDRESS","ZKSYNC_SEPOLIA_RPC_URL","BRIDGE_EVM_PRIVATE_KEY"];
if(envFile){const text=readFileSync(envFile,"utf8");for(const key of requiredEnv){const ok=new RegExp(`^${key}=.+$`,"m").test(text);checks.push({name:`env:${key}`,status:ok?"ok":"warn",detail:ok?"set":"not set"});}}else checks.push({name:"environment",status:"warn",detail:"create .env.local from .env.example"});
if(!existsSync("node_modules"))checks.push({name:"node_modules",status:"warn",detail:"run npm install before dependency-resolved build/typecheck"});
const pad=Math.max(...checks.map(x=>x.name.length));for(const c of checks)console.log(`${c.status==="ok"?"✓":c.status==="warn"?"!":"✗"} ${c.name.padEnd(pad)}  ${c.detail}`);
const hard=checks.filter(x=>x.status==="missing"),warnings=checks.filter(x=>x.status==="warn");console.log(`\n${checks.length-hard.length-warnings.length} ok, ${warnings.length} warnings, ${hard.length} missing required`);if(hard.length||(strict&&warnings.length))process.exit(1);
