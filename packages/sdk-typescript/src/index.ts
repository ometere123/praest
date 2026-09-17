export const STUDIO_DEV = {alias: "studio-dev", chainId: 61997, rpc: "https://studio-dev.genlayer.com/api", explorer: "https://explorer-studio-dev.genlayer.com/"} as const;

export type Provider = {request(args: {method: string; params?: unknown[]}): Promise<any>};
export type TxTruth = {txId: string; consensus: "ACCEPTED" | "FINALIZED" | "UNDETERMINED" | "CANCELED"; execution: "FINISHED_WITH_RETURN" | "FAILED" | "PENDING" | "UNKNOWN"};

/** Direct browser-wallet surface. No PRAEST API, database, or server-held signer is involved. */
export class PraestDirectClient {
  constructor(public readonly provider: Provider, public readonly network = STUDIO_DEV) {}
  async assertNetwork() {
    const chainId = await this.provider.request({method: "eth_chainId"});
    if (Number.parseInt(String(chainId), 16) !== this.network.chainId) throw new Error(`WRONG_NETWORK:${chainId}`);
  }
  async accounts(): Promise<string[]> { return this.provider.request({method: "eth_accounts"}); }
  async estimateFees(): Promise<any> { return this.provider.request({method: "eth_estimateGas", params: [{}]); }
  async submit(to: string, data: string, value = "0x0"): Promise<string> {
    await this.assertNetwork();
    const [from] = await this.accounts();
    if (!from) throw new Error("WALLET_NOT_CONNECTED");
    await this.estimateFees();
    return this.provider.request({method: "eth_sendTransaction", params: [{from, to, data, value}]});
  }
  read(to: string, data: string): Promise<string> { return this.provider.request({method: "eth_call", params: [{to, data}, "latest"]}); }
}

export function applicationSuccess(t: TxTruth): boolean { return (t.consensus === "ACCEPTED" || t.consensus === "FINALIZED") && t.execution === "FINISHED_WITH_RETURN"; }
