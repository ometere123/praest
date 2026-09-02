// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
library PraestWire {
    uint256 internal constant HEADER = 302;
    uint256 internal constant ALLOC = 48;
    struct Allocation { bytes32 beneficiary; uint128 amount; }
    struct Instruction { uint16 version; bytes32 instructionId; bytes32 caseId; bytes32 agreementId; bytes32 decisionHash; uint32 policyVersion; bytes32 evidenceManifestHash; uint8 outcome; uint8 settlementType; bytes32 settlementTarget; bytes32 escrowId; bytes32 asset; uint8 assetDecimals; uint64 finalizedAt; uint64 expiresAt; uint32 sourceDomain; uint32 destinationDomain; uint64 nonce; Allocation[] allocations; }
    error Malformed(); error BadMagic(); error UnsupportedVersion(uint16);
    function decode(bytes calldata d) internal pure returns(Instruction memory x){
        if(d.length < HEADER) revert Malformed();
        if(uint32(bytes4(d[0:4])) != 0x50525354) revert BadMagic();
        x.version=u16(d,4); if(x.version!=1) revert UnsupportedVersion(x.version);
        x.instructionId=b32(d,6); x.caseId=b32(d,38); x.agreementId=b32(d,70); x.decisionHash=b32(d,102); x.policyVersion=u32(d,134); x.evidenceManifestHash=b32(d,138); x.outcome=u8(d,170); x.settlementType=u8(d,171); x.settlementTarget=b32(d,172); x.escrowId=b32(d,204); x.asset=b32(d,236); x.assetDecimals=u8(d,268); x.finalizedAt=u64(d,269); x.expiresAt=u64(d,277); x.sourceDomain=u32(d,285); x.destinationDomain=u32(d,289); x.nonce=u64(d,293); uint8 n=u8(d,301); if(n==0||n>16||d.length!=HEADER+uint256(n)*ALLOC) revert Malformed(); x.allocations=new Allocation[](n); uint256 o=HEADER; for(uint256 i;i<n;i++){x.allocations[i]=Allocation(b32(d,o),u128(d,o+32));o+=ALLOC;}
    }
    function u8(bytes calldata d,uint256 o) private pure returns(uint8){return uint8(d[o]);}
    function u16(bytes calldata d,uint256 o) private pure returns(uint16){return (uint16(uint8(d[o]))<<8)|uint16(uint8(d[o+1]));}
    function u32(bytes calldata d,uint256 o) private pure returns(uint32 v){for(uint256 i;i<4;i++)v=(v<<8)|uint32(uint8(d[o+i]));}
    function u64(bytes calldata d,uint256 o) private pure returns(uint64 v){for(uint256 i;i<8;i++)v=(v<<8)|uint64(uint8(d[o+i]));}
    function u128(bytes calldata d,uint256 o) private pure returns(uint128 v){for(uint256 i;i<16;i++)v=(v<<8)|uint128(uint8(d[o+i]));}
    function b32(bytes calldata d,uint256 o) private pure returns(bytes32 v){assembly{v:=calldataload(add(d.offset,o))}}
    function toAddress(bytes32 x) internal pure returns(address){return address(uint160(uint256(x)));}
    function address32(address a) internal pure returns(bytes32){return bytes32(uint256(uint160(a)));}
}
