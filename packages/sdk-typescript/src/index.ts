import {createClient, isSuccessful} from "genlayer-js";
import {studioDevnet} from "genlayer-js/chains";
import {TransactionHashVariant, type Account, type Address, type GenLayerClient, type GenLayerTransaction} from "genlayer-js/types";

export const STUDIO_DEV = {
  alias: "studio-dev",
  chainId: 61997,
  rpc: "https://studio-dev.genlayer.com/api",
  explorer: "https://explorer-studio-dev.genlayer.com/",
} as const;

export type Eip1193Provider = {request(args: {method: string; params?: unknown[]}): Promise<unknown>};
export type DirectClientConfig = {account?: Account | Address; provider?: Eip1193Provider};
export type TransactionTruth = {txId: `0x${string}`; finalized: boolean; successful: boolean; transaction: GenLayerTransaction};

export const applicationSuccess = (transaction: GenLayerTransaction) => isSuccessful(transaction);

/** Direct GenLayer client. It has no PRAEST API, database, or server-held signer. */
export class PraestDirectClient {
  readonly client: GenLayerClient<any>;

  constructor(config: DirectClientConfig = {}) {
    this.client = createClient({chain: studioDevnet, ...(config.account ? {account: config.account} : {}), ...(config.provider ? {provider: config.provider} : {})} as any);
  }

  async readFinal(address: Address, functionName: string, args: unknown[] = []) {
    return this.client.readContract({address, functionName, args: args as never[], transactionHashVariant: TransactionHashVariant.LATEST_FINAL} as never);
  }

  async writeFinal(address: Address, functionName: string, args: unknown[] = [], value = 0n): Promise<TransactionTruth> {
    const account = this.client.account;
    if (!account || typeof account === "string") throw new Error("SIGNING_ACCOUNT_REQUIRED");
    const estimate = await this.client.estimateTransactionFeesForWrite({address, functionName, args: args as never[], account, value} as never);
    const txId = await this.client.writeContract({account, address, functionName, args: args as never[], value, fees: {distribution: estimate.distribution, feeValue: estimate.feeValue, ...(estimate.messageAllocations ? {messageAllocations: estimate.messageAllocations} : {})}} as never);
    const transaction = await this.client.waitForFinalization({hash: txId, retries: 240, interval: 5000, fullTransaction: true});
    return {txId, finalized: true, successful: isSuccessful(transaction), transaction};
  }

  explorerUrl(txId: string) { return `${STUDIO_DEV.explorer}tx/${txId}`; }
}
