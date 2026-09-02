import { createHash } from "node:crypto";
import { z } from "zod";

export const MAGIC = Buffer.from("PRST", "ascii");
export const WIRE_VERSION = 1;
export const MAX_ALLOCATIONS = 16;

export const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const allocationSchema = z.object({ beneficiary: hex32, amount: z.bigint().nonnegative() });
export const instructionSchema = z.object({
  payloadVersion: z.literal(WIRE_VERSION), instructionId: hex32, caseId: hex32, agreementId: hex32,
  decisionHash: hex32, policyVersion: z.number().int().nonnegative().max(0xffffffff), evidenceManifestHash: hex32,
  outcome: z.number().int().min(0).max(255), settlementType: z.number().int().min(0).max(255),
  settlementTarget: hex32, escrowId: hex32, asset: hex32, assetDecimals: z.number().int().min(0).max(255),
  finalizedAt: z.bigint().nonnegative(), expiresAt: z.bigint().positive(), sourceDomain: z.number().int().nonnegative().max(0xffffffff),
  destinationDomain: z.number().int().nonnegative().max(0xffffffff), nonce: z.bigint().nonnegative(),
  allocations: z.array(allocationSchema).min(1).max(MAX_ALLOCATIONS)
});
export type SettlementInstruction = z.infer<typeof instructionSchema>;

function fixedHex(value:string, bytes:number){
  const raw=value.startsWith("0x")?value.slice(2):value;
  if(raw.length!==bytes*2) throw new Error(`expected ${bytes} bytes`);
  return Buffer.from(raw,"hex");
}
function u8(n:number){const b=Buffer.alloc(1);b.writeUInt8(n);return b}
function u16(n:number){const b=Buffer.alloc(2);b.writeUInt16BE(n);return b}
function u32(n:number){const b=Buffer.alloc(4);b.writeUInt32BE(n);return b}
function u64(n:bigint){const b=Buffer.alloc(8);b.writeBigUInt64BE(n);return b}
function u128(n:bigint){if(n<0n||n>(1n<<128n)-1n) throw new Error("u128 overflow");const b=Buffer.alloc(16);b.writeBigUInt64BE(n>>64n,0);b.writeBigUInt64BE(n&((1n<<64n)-1n),8);return b}

export function encodeInstruction(input:SettlementInstruction):Uint8Array{
  const v=instructionSchema.parse(input);
  const parts=[MAGIC,u16(v.payloadVersion),fixedHex(v.instructionId,32),fixedHex(v.caseId,32),fixedHex(v.agreementId,32),fixedHex(v.decisionHash,32),u32(v.policyVersion),fixedHex(v.evidenceManifestHash,32),u8(v.outcome),u8(v.settlementType),fixedHex(v.settlementTarget,32),fixedHex(v.escrowId,32),fixedHex(v.asset,32),u8(v.assetDecimals),u64(v.finalizedAt),u64(v.expiresAt),u32(v.sourceDomain),u32(v.destinationDomain),u64(v.nonce),u8(v.allocations.length)];
  for(const a of v.allocations) parts.push(fixedHex(a.beneficiary,32),u128(a.amount));
  return Buffer.concat(parts);
}

export function decodeInstruction(data:Uint8Array):SettlementInstruction{
  const b=Buffer.from(data); let o=0;
  const take=(n:number)=>{if(o+n>b.length)throw new Error("truncated payload");const x=b.subarray(o,o+n);o+=n;return x};
  if(!take(4).equals(MAGIC))throw new Error("bad magic");
  const payloadVersion=take(2).readUInt16BE(); if(payloadVersion!==WIRE_VERSION)throw new Error("unsupported version");
  const h=()=>`0x${take(32).toString("hex")}` as `0x${string}`;
  const instructionId=h(),caseId=h(),agreementId=h(),decisionHash=h(); const policyVersion=take(4).readUInt32BE(); const evidenceManifestHash=h();
  const outcome=take(1).readUInt8(),settlementType=take(1).readUInt8(); const settlementTarget=h(),escrowId=h(),asset=h(); const assetDecimals=take(1).readUInt8();
  const finalizedAt=take(8).readBigUInt64BE(),expiresAt=take(8).readBigUInt64BE(); const sourceDomain=take(4).readUInt32BE(),destinationDomain=take(4).readUInt32BE(); const nonce=take(8).readBigUInt64BE();
  const count=take(1).readUInt8(); if(count===0||count>MAX_ALLOCATIONS)throw new Error("invalid allocation count"); const allocations=[] as {beneficiary:`0x${string}`;amount:bigint}[];
  for(let i=0;i<count;i++){const beneficiary=h();const x=take(16);const amount=(x.readBigUInt64BE(0)<<64n)|x.readBigUInt64BE(8);allocations.push({beneficiary,amount});}
  if(o!==b.length)throw new Error("trailing bytes");
  return instructionSchema.parse({payloadVersion,instructionId,caseId,agreementId,decisionHash,policyVersion,evidenceManifestHash,outcome,settlementType,settlementTarget,escrowId,asset,assetDecimals,finalizedAt,expiresAt,sourceDomain,destinationDomain,nonce,allocations});
}

export function sha256Hex(data:Uint8Array|string){return `0x${createHash("sha256").update(data).digest("hex")}` as `0x${string}`}
export function deriveInstructionId(fields:{decisionHash:string;destinationDomain:number;settlementTarget:string;nonce:bigint}){
  const b=Buffer.concat([fixedHex(fields.decisionHash,32),u32(fields.destinationDomain),fixedHex(fields.settlementTarget,32),u64(fields.nonce)]);
  return sha256Hex(b);
}
