import {readFile} from "node:fs/promises";
import {Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction} from "@solana/web3.js";
import chains from "../packages/config/src/chains.json" with {type:"json"};

function env(name:string){const v=process.env[name];if(!v)throw new Error(`${name} required`);return v}
function u32le(n:number){const b=Buffer.alloc(4);b.writeUInt32LE(n);return b}
function evmSenderBytes32(address:string){const raw=address.replace(/^0x/,"");if(!/^[0-9a-fA-F]{40}$/.test(raw))throw new Error("PRAEST_STUDIO_GATEWAY_ADDRESS must be an EVM address");return Buffer.from(raw.padStart(64,"0"),"hex")}

const sol=chains.find((c:any)=>c.key==="solanatestnet") as any;
if(!sol)throw new Error("solanatestnet route missing");
const programId=new PublicKey(env("PRAEST_SOLANA_PROGRAM_ID"));
const mailbox=new PublicKey(sol.mailbox);
const ism=new PublicKey(sol.ism);
const gateway=env("PRAEST_STUDIO_GATEWAY_ADDRESS");
const rpc=process.env.SOLANA_TESTNET_RPC_URL||"https://api.testnet.solana.com";
const secret=JSON.parse(await readFile(env("SOLANA_KEYPAIR_PATH"),"utf8"));
const payer=Keypair.fromSecretKey(Uint8Array.from(secret));
const [configPda]=PublicKey.findProgramAddressSync([Buffer.from("praest-config")],programId);
// Borsh enum variant 0 (Initialize), followed by Pubkey, Pubkey, u32 LE, u32 LE, [u8;32].
const data=Buffer.concat([Buffer.from([0]),mailbox.toBuffer(),ism.toBuffer(),u32le(sol.domainId),u32le(300),evmSenderBytes32(gateway)]);
const ix=new TransactionInstruction({programId,keys:[{pubkey:payer.publicKey,isSigner:true,isWritable:true},{pubkey:configPda,isSigner:false,isWritable:true},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}],data});
const conn=new Connection(rpc,"confirmed");
const sig=await sendAndConfirmTransaction(conn,new Transaction().add(ix),[payer],{commitment:"confirmed"});
console.log(JSON.stringify({programId:programId.toBase58(),configPda:configPda.toBase58(),mailbox:mailbox.toBase58(),ism:ism.toBase58(),trustedOrigin:300,trustedSender:gateway,signature:sig},null,2));
