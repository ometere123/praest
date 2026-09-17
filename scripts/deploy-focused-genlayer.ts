import {readFile, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {config as loadEnv} from "dotenv";
import {createAccount, createClient} from "genlayer-js";
import {isSuccessful} from "genlayer-js";
import * as chains from "genlayer-js/chains";

if (existsSync(".env.local")) loadEnv({path: ".env.local"});
const names = ["PRAESTAgreementVault", "PRAESTAdjudicator"];
const sourceCommit = process.env.SOURCE_COMMIT || execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim();
async function main() {
  const pk = process.env.GENLAYER_STUDIONET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("GENLAYER_STUDIONET_PRIVATE_KEY required; refusing fake deployment");
  const chain = (chains as any).studioDevnet;
  if (!chain) throw new Error("studioDevnet preset unavailable");
  const client = createClient({chain, account: createAccount(pk)} as any);
  const manifest: any = {network: "studio-dev", chainId: 61997, rpc: "https://studio-dev.genlayer.com/api", explorer: "https://explorer-studio-dev.genlayer.com/", contracts: {}, sourceCommit, runtimePin: "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng", status: "DEPLOYING"};
  for (const name of names) {
    const code = await readFile(`contracts/genlayer/${name}.py`, "utf8");
    const fees: any = await (client as any).estimateTransactionFees();
    const tx = await (client as any).deployContract({account: createAccount(pk), code, args: [], fees: {distribution: fees.distribution, feeValue: fees.feeValue}});
    manifest.contracts[name] = {deploymentTx: tx, address: null};
    await writeFile("deployments/agent-tank.json", JSON.stringify(manifest, null, 2));
    const receipt: any = await (client as any).waitForFinalization({hash: tx, retries: 240, interval: 5000});
    if (!isSuccessful(receipt)) {
      throw new Error(`${name} finalized without successful execution: ${receipt?.statusName || "unknown status"} / ${receipt?.txExecutionResultName || "unknown execution"}`);
    }
    const address = receipt?.txDataDecoded?.contractAddress || receipt?.contractAddress || receipt?.data?.contractAddress || receipt?.consensus_data?.contract_address || receipt?.recipient;
    if (!address) throw new Error(`${name} finalized but receipt exposed no contract address`);
    manifest.contracts[name] = {deploymentTx: tx, address, execution: receipt.txExecutionResultName};
    await writeFile("deployments/agent-tank.json", JSON.stringify(manifest, null, 2));
  }
  manifest.status = "DEPLOYED";
  await writeFile("deployments/agent-tank.json", JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
