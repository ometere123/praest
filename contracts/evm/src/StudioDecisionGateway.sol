// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IMailbox} from "./interfaces/IHyperlane.sol";
contract StudioDecisionGateway is AccessControl,Pausable {
    bytes32 public constant PUBLISHER_ROLE=keccak256("PUBLISHER_ROLE");
    IMailbox public immutable mailbox;
    // Semantic idempotency keyed on PRAEST's own instructionId, independent of Hyperlane's own
    // messageId - a retried bridge cycle (e.g. after a crash between dispatch and DB update) must
    // not create a second Hyperlane message/fee for an instruction already dispatched.
    mapping(bytes32=>bytes32) public dispatchedInstructionMessage;
    event InstructionDispatched(bytes32 indexed instructionId,bytes32 indexed messageId,uint32 indexed destination,bytes32 recipient,bytes32 payloadHash);
    constructor(address admin,address mailbox_){require(mailbox_!=address(0),"mailbox");mailbox=IMailbox(mailbox_);_grantRole(DEFAULT_ADMIN_ROLE,admin);_grantRole(PUBLISHER_ROLE,admin);}
    function setPublisher(address p,bool on)external onlyRole(DEFAULT_ADMIN_ROLE){if(on)_grantRole(PUBLISHER_ROLE,p);else _revokeRole(PUBLISHER_ROLE,p);}
    function pause()external onlyRole(DEFAULT_ADMIN_ROLE){_pause();}
    function unpause()external onlyRole(DEFAULT_ADMIN_ROLE){_unpause();}
    function quote(uint32 destination,bytes32 recipient,bytes calldata payload)external view returns(uint256){return mailbox.quoteDispatch(destination,recipient,payload);}
    function dispatchInstruction(bytes32 instructionId,uint32 destination,bytes32 recipient,bytes calldata payload)external payable onlyRole(PUBLISHER_ROLE) whenNotPaused returns(bytes32 messageId){
        bytes32 existing=dispatchedInstructionMessage[instructionId];
        if(existing!=bytes32(0)){
            if(msg.value>0){(bool ok,)=msg.sender.call{value:msg.value}("");require(ok,"refund");}
            return existing;
        }
        uint256 fee=mailbox.quoteDispatch(destination,recipient,payload);require(msg.value>=fee,"fee");
        messageId=mailbox.dispatch{value:fee}(destination,recipient,payload);
        if(msg.value>fee){(bool ok,)=msg.sender.call{value:msg.value-fee}("");require(ok,"refund");}
        dispatchedInstructionMessage[instructionId]=messageId;
        emit InstructionDispatched(instructionId,messageId,destination,recipient,keccak256(payload));
    }
}
