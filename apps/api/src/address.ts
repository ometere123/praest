import bs58 from "bs58";import {sha256} from "./crypto.js";
export function idToBytes32(id:string){return sha256(id)}
export function addressToBytes32(address:string,protocol:"ethereum"|"sealevel"){
 if(protocol==="ethereum"){if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw new Error(`invalid EVM address ${address}`);return `0x${address.slice(2).padStart(64,"0").toLowerCase()}`;}
 const b=bs58.decode(address);if(b.length!==32)throw new Error("invalid Solana address");return `0x${Buffer.from(b).toString("hex")}`;
}
