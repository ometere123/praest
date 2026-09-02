"use client";

import {useState} from "react";
import {useWallets as useEvmWallets} from "@privy-io/react-auth";
import {useSignAndSendTransaction, useWallets as useSolanaWallets} from "@privy-io/react-auth/solana";
import {Connection, PublicKey, Transaction, TransactionInstruction} from "@solana/web3.js";
import {api} from "@/lib/api";

type Prepared =
  | {protocol:"ethereum";chainId:number;payerAddress:string;transactions:{purpose:string;to:string;data:string;value:string}[]}
  | {protocol:"sealevel";chain:string;payerAddress:string;instruction:{dataBase64:string;accounts:{pubkey:string;isSigner:boolean;isWritable:boolean}[]}};

export default function EscrowFundingAction({escrowId}:{escrowId:string}) {
  const {wallets: evmWallets} = useEvmWallets();
  const {wallets: solWallets} = useSolanaWallets();
  const {signAndSendTransaction} = useSignAndSendTransaction();
  const [state,setState]=useState("");
  const [busy,setBusy]=useState(false);

  async function fund(){
    setBusy(true); setState("Preparing funding transaction…");
    try {
      const prepared=await api<Prepared>(`escrows/${escrowId}/prepare-funding`,{method:"POST",body:"{}"});
      if(prepared.protocol==="ethereum"){
        const wallet=evmWallets.find(w=>w.address.toLowerCase()===prepared.payerAddress.toLowerCase()) ?? evmWallets[0];
        if(!wallet)throw new Error("No EVM wallet available for this escrow payer");
        if(wallet.address.toLowerCase()!==prepared.payerAddress.toLowerCase())throw new Error("Connected wallet is not the escrow payer");
        const provider=await wallet.getEthereumProvider();
        const hexChain=`0x${prepared.chainId.toString(16)}`;
        try{await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:hexChain}]});}catch(e:any){throw new Error(`Switch the embedded/external wallet to chain ${prepared.chainId}: ${e?.message||e}`)}
        let fundingHash="";
        for(const tx of prepared.transactions){
          setState(`${tx.purpose === "approve" ? "Approving asset" : "Funding escrow"}…`);
          const hash=await provider.request({method:"eth_sendTransaction",params:[{from:wallet.address,to:tx.to,data:tx.data,value:"0x0"}]}) as string;
          await waitEvmReceipt(provider,hash);
          if(tx.purpose==="fund") fundingHash=hash;
        }
        await api(`escrows/${escrowId}/confirm-funding`,{method:"POST",body:JSON.stringify({txHash:fundingHash})});
        setState(`Escrow funded and independently verified: ${fundingHash}`);
      }else{
        const wallet=solWallets.find(w=>w.address===prepared.payerAddress) ?? solWallets[0];
        if(!wallet)throw new Error("No Solana wallet available for this escrow payer");
        if(wallet.address!==prepared.payerAddress)throw new Error("Connected Solana wallet is not the escrow payer");
        const rpc=process.env.NEXT_PUBLIC_SOLANA_TESTNET_RPC_URL || "https://api.testnet.solana.com";
        const connection=new Connection(rpc,"confirmed");
        const accounts=prepared.instruction.accounts.map(a=>({pubkey:new PublicKey(a.pubkey),isSigner:a.isSigner,isWritable:a.isWritable}));
        const programId=accounts.length ? await deriveProgramId(prepared) : null;
        if(!programId)throw new Error("Missing Solana settlement program id");
        const ix=new TransactionInstruction({programId,keys:accounts,data:Buffer.from(prepared.instruction.dataBase64,"base64")});
        const {blockhash,lastValidBlockHeight}=await connection.getLatestBlockhash("confirmed");
        const tx=new Transaction({feePayer:new PublicKey(wallet.address),blockhash,lastValidBlockHeight}).add(ix);
        const bytes=tx.serialize({requireAllSignatures:false,verifySignatures:false});
        setState("Signing and funding Solana Testnet escrow…");
        const result=await signAndSendTransaction({transaction:new Uint8Array(bytes),wallet,chain:prepared.chain as any});
        const signature=base58(result.signature);
        await connection.confirmTransaction({signature,blockhash,lastValidBlockHeight},"confirmed");
        await api(`escrows/${escrowId}/confirm-funding`,{method:"POST",body:JSON.stringify({txHash:signature})});
        setState(`Escrow funded and independently verified: ${signature}`);
      }
    }catch(e:any){setState(e?.message||String(e))}finally{setBusy(false)}
  }

  return <div className="card" style={{marginTop:18}}><h3>Fund settlement escrow</h3><p className="muted">PRAEST prepares the chain-specific transaction. Your wallet signs it; the backend independently verifies the destination escrow before marking it funded.</p><button className="btn primary" disabled={busy} onClick={fund}>{busy?"Working…":"Prepare and fund escrow"}</button>{state&&<p className="muted" style={{marginTop:12}}>{state}</p>}</div>;
}

async function deriveProgramId(prepared: Extract<Prepared,{protocol:"sealevel"}>){
  // The program itself is the settlement target configured by the route. The API places it in the
  // funding instruction response by adding `programId`; tolerate older responses only by failing closed.
  const p=(prepared as any).programId;
  return p?new PublicKey(p):null;
}
async function waitEvmReceipt(provider:any,hash:string){
  for(let i=0;i<90;i++){
    const r=await provider.request({method:"eth_getTransactionReceipt",params:[hash]});
    if(r){if(r.status&&r.status!=="0x1")throw new Error(`Transaction reverted: ${hash}`);return r;}
    await new Promise(r=>setTimeout(r,1000));
  }
  throw new Error(`Timed out waiting for transaction ${hash}`);
}
const ALPHABET="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes:Uint8Array){let digits=[0];for(const byte of bytes){let carry=byte;for(let j=0;j<digits.length;j++){carry+=digits[j]*256;digits[j]=carry%58;carry=(carry/58)|0;}while(carry){digits.push(carry%58);carry=(carry/58)|0;}}let out="";for(const b of bytes){if(b===0)out+=ALPHABET[0];else break;}for(let q=digits.length-1;q>=0;q--)out+=ALPHABET[digits[q]];return out;}
