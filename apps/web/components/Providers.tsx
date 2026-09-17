"use client";

import type {PropsWithChildren} from "react";
import {useEffect, useState} from "react";
type Ethereum = {request(args: {method: string; params?: unknown[]}): Promise<any>; on?: (event: string, handler: () => void) => void; removeListener?: (event: string, handler: () => void) => void};
declare global { interface Window { ethereum?: Ethereum } }

export default function Providers({children}: PropsWithChildren) {
  return <>{children}</>;
}

export function WalletStatus() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const refresh = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) { setAddress(null); setChainId(null); return; }
    const accounts = await ethereum.request({method: "eth_accounts"}) as string[];
    const chain = String(await ethereum.request({method: "eth_chainId"}));
    setAddress(accounts?.[0] ?? null);
    setChainId(Number.parseInt(chain, 16));
  };
  useEffect(() => {
    void refresh();
    const ethereum = window.ethereum;
    if (!ethereum?.on) return;
    const handler = () => void refresh();
    ethereum.on("accountsChanged", handler); ethereum.on("chainChanged", handler);
    return () => { ethereum.removeListener?.("accountsChanged", handler); ethereum.removeListener?.("chainChanged", handler); };
  }, []);
  const connect = async () => {
    setError("");
    try {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error("Install an injected EIP-1193 wallet first.");
      await ethereum.request({method: "eth_requestAccounts"});
      const current = Number.parseInt(String(await ethereum.request({method: "eth_chainId"})), 16);
      if (current !== 61997) {
        try { await ethereum.request({method: "wallet_switchEthereumChain", params: [{chainId: "0xf22d"}]}); }
        catch (switchError: any) {
          if (switchError?.code !== 4902) throw switchError;
          await ethereum.request({method: "wallet_addEthereumChain", params: [{chainId: "0xf22d", chainName: "GenLayer Studio-dev", nativeCurrency: {name: "GenLayer Token", symbol: "GLT", decimals: 18}, rpcUrls: ["https://studio-dev.genlayer.com/api"], blockExplorerUrls: ["https://explorer-studio-dev.genlayer.com/"]}]});
        }
      }
      await refresh();
    } catch (value: any) { setError(value?.message || "Wallet connection failed"); }
  };
  return <div><button className="btn" onClick={connect}>{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect injected wallet"}</button><small className="wallet-meta">{chainId === 61997 ? "Studio-dev · 61997" : chainId ? `Wrong network · ${chainId}` : ""}</small>{error ? <small className="wallet-error">{error}</small> : null}</div>;
}
