"use client";

import type {PropsWithChildren} from "react";
import {useEffect} from "react";
declare global { interface Window { ethereum?: { request(args: {method: string}): Promise<unknown> } } }

export default function Providers({children}: PropsWithChildren) {
  useEffect(() => undefined, []);
  return <>{children}</>;
}

export function WalletStatus() {
  const connect = async () => {
    if (!window.ethereum) return;
    await window.ethereum.request({method: "eth_requestAccounts"});
  };
  return <button className="btn" onClick={connect}>Connect injected wallet</button>;
}
