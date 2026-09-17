import {readFile, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {config as loadEnv} from "dotenv";
import {createAccount, createClient} from "genlayer-js";
import * as chains from "genlayer-js/chains";

if (existsSync(".env.local")) loadEnv({path: ".env.local"});
const names = ["PRAESTAgreementVault", "PRAESTAdjudicator"];
async function main() {
  const pk = process.env.GENLAYER_STUDIONET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("GENLAYER_STUDIONET_PRIVATE_KEY required; refusing fake deployment");
  const chain = (chains as any).studioDevnet;
  if (!chain) throw new Error("studioDevnet preset unavailable");
  const client = createClient({chain, account: createAccount(pk)} as any);
  const manifest: any = {network: "studio-dev", chainId: 61997, rpc: "https://studio-dev.genlayer.com/api", explorer: "https://explorer-studio-dev.genlayer.com/", contracts: {}, sourceCommit: process.env.SOURCE_COMMIT || "UNRECORDED", status: "DEPLOYING"};
  for (const name of names) {
    const code = await readFile(`contracts/genlayer/${name}.py`, "utf8");
    const fees: any = await (client as any).estimateTransactionFees();
    const tx = await (client as any).deployContract({account: createAccount(pk), code, args: [], fees: {distribution: fees.distribution, feeValue: fees.feeValue}});
    manifest.contracts[name] = {deploymentTx: tx, address: null};
    await writeFile("deployments/agent-tank.json", JSON.stringify(manifest, null, 2));
    const receipt: any = await (client as any).waitForTransactionReceipt({hash: tx, waitUntil: "finalized", fullTransaction: true});
    const address = receipt?.contractAddress || receipt?.data?.contractAddress || receipt?.consensus_data?.contract_address;
    if (!address) throw new Error(`${name} finalized but receipt exposed no contract address`);
    manifest.contracts[name] = {deploymentTx: tx, address};
    await writeFile("deployments/agent-tank.json", JSON.stringify(manifest, null, 2));
  }
  manifest.status = "DEPLOYED";
  await writeFile("deployments/agent-tank.json", JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
