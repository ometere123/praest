/**
 * Same-chain settlement: submits a finalized settlement instruction straight to
 * PraestSettlementReceiver.settleDirect() on the destination chain, with no Hyperlane message in
 * the path.
 *
 * This is PRAEST's primary settlement route. Cross-chain transport is an additional capability,
 * not a dependency - a settlement must never be blocked on validator or relayer liveness when the
 * decision and the escrow already share a chain.
 *
 * The receiver applies every instruction check on this path that it applies to a Hyperlane
 * message - destination, target, finality, expiry, replay - and the escrow independently enforces
 * its own allocation policy. Only the transport checks are replaced, by DIRECT_SETTLER_ROLE.
 */
import {encodeInstruction, type SettlementInstruction} from "@praest/protocol";
import {createPublicClient, createWalletClient, http, parseEventLogs, toHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";

const RECEIVER_ABI = [
  {type: "function", name: "settleDirect", stateMutability: "nonpayable", inputs: [{name: "message", type: "bytes"}], outputs: []},
  {type: "function", name: "processedInstructions", stateMutability: "view", inputs: [{name: "", type: "bytes32"}], outputs: [{type: "bool"}]},
  {type: "event", name: "SettlementExecuted", inputs: [
    {indexed: true, name: "instructionId", type: "bytes32"},
    {indexed: true, name: "decisionHash", type: "bytes32"},
    {indexed: false, name: "escrowId", type: "bytes32"},
    {indexed: false, name: "total", type: "uint256"},
  ]},
] as const;

const ESCROW_ABI = [
  {type: "event", name: "EscrowSettled", inputs: [
    {indexed: true, name: "escrowId", type: "bytes32"},
    {indexed: true, name: "instructionId", type: "bytes32"},
    {indexed: false, name: "totalReleased", type: "uint256"},
    {indexed: false, name: "remaining", type: "uint256"},
  ]},
] as const;

const b32 = (addr: string) => `0x${addr.replace(/^0x/, "").toLowerCase().padStart(64, "0")}` as `0x${string}`;
const env = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`${n} required`);
  return v;
};

async function main() {
  const rpc = env("BASE_SEPOLIA_RPC_URL");
  const receiver = env("PRAEST_RECEIVER") as `0x${string}`;
  const escrow = env("PRAEST_ESCROW") as `0x${string}`;
  const account = privateKeyToAccount(env("BRIDGE_EVM_PRIVATE_KEY") as `0x${string}`);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const instruction: SettlementInstruction = {
    payloadVersion: 1,
    instructionId: env("PRAEST_INSTRUCTION_ID") as `0x${string}`,
    caseId: env("PRAEST_CASE_ID") as `0x${string}`,
    agreementId: env("PRAEST_AGREEMENT_ID") as `0x${string}`,
    decisionHash: env("PRAEST_DECISION_HASH") as `0x${string}`,
    policyVersion: 1,
    evidenceManifestHash: env("PRAEST_EVIDENCE_HASH") as `0x${string}`,
    outcome: Number(process.env.PRAEST_OUTCOME || 2),
    settlementType: 2,
    settlementTarget: b32(receiver),
    escrowId: env("PRAEST_ESCROW_ID") as `0x${string}`,
    asset: b32(env("PRAEST_SETTLEMENT_TOKEN")),
    assetDecimals: 6,
    // finalizedAt must already be in the past on-chain; the receiver rejects a future finality.
    finalizedAt: now - 60n,
    expiresAt: now + BigInt(process.env.PRAEST_TTL_SECONDS || 3600),
    sourceDomain: Number(env("PRAEST_HYPERLANE_ORIGIN_DOMAIN")),
    destinationDomain: Number(env("PRAEST_DESTINATION_DOMAIN")),
    nonce: BigInt(process.env.PRAEST_NONCE || 1),
    allocations: [
      {beneficiary: b32(env("PRAEST_CUSTOMER")), amount: BigInt(env("PRAEST_CUSTOMER_AMOUNT"))},
      {beneficiary: b32(env("PRAEST_PROVIDER")), amount: BigInt(env("PRAEST_PROVIDER_AMOUNT"))},
    ],
  };

  const message = toHex(encodeInstruction(instruction));
  const pub = createPublicClient({transport: http(rpc)});
  const wallet = createWalletClient({account, transport: http(rpc)});

  const already = await pub.readContract({address: receiver, abi: RECEIVER_ABI, functionName: "processedInstructions", args: [instruction.instructionId]});
  if (already) {
    console.log(`instruction ${instruction.instructionId} already processed - refusing to resubmit`);
    return;
  }

  console.log("instructionId:", instruction.instructionId);
  console.log("payload bytes:", (message.length - 2) / 2);
  console.log("customer gets:", instruction.allocations[0].amount.toString());
  console.log("provider gets:", instruction.allocations[1].amount.toString());

  const hash = await wallet.writeContract({address: receiver, abi: RECEIVER_ABI, functionName: "settleDirect", args: [message], chain: null});
  console.log("submitted:", hash);

  const receipt = await pub.waitForTransactionReceipt({hash});
  console.log("status:", receipt.status, "block:", receipt.blockNumber.toString(), "gas:", receipt.gasUsed.toString());

  const settled = parseEventLogs({abi: RECEIVER_ABI, logs: receipt.logs, eventName: "SettlementExecuted"});
  const escrowSettled = parseEventLogs({abi: ESCROW_ABI, logs: receipt.logs, eventName: "EscrowSettled"});
  for (const l of settled) console.log("SettlementExecuted:", JSON.stringify(l.args, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  for (const l of escrowSettled) console.log("EscrowSettled:", JSON.stringify(l.args, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  if (!escrowSettled.length) throw new Error("no EscrowSettled event - settlement did not reach the escrow");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
