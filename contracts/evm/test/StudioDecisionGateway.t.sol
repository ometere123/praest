// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {StudioDecisionGateway} from "../src/StudioDecisionGateway.sol";
import {IMailbox, IInterchainSecurityModule} from "../src/interfaces/IHyperlane.sol";

contract MockMailbox is IMailbox {
    uint256 public fee = 100;
    uint256 public callCount;
    function localDomain() external pure returns (uint32) { return 84532; }
    function delivered(bytes32) external pure returns (bool) { return false; }
    function defaultIsm() external pure returns (IInterchainSecurityModule) { return IInterchainSecurityModule(address(0)); }
    function dispatch(uint32, bytes32, bytes calldata) external payable returns (bytes32) {
        callCount++;
        return keccak256(abi.encodePacked("message", callCount));
    }
    function quoteDispatch(uint32, bytes32, bytes calldata) external view returns (uint256) { return fee; }
}

contract StudioDecisionGatewayTest is Test {
    StudioDecisionGateway g;
    MockMailbox mailbox;
    bytes32 recipient = bytes32(uint256(uint160(address(0xBEEF))));

    function setUp() public {
        mailbox = new MockMailbox();
        g = new StudioDecisionGateway(address(this), address(mailbox));
        vm.deal(address(this), 10 ether);
    }

    function test_dispatch_records_instruction_message() public {
        bytes32 instructionId = bytes32(uint256(1));
        bytes32 messageId = g.dispatchInstruction{value: 100}(instructionId, 300, recipient, "payload");
        assertEq(g.dispatchedInstructionMessage(instructionId), messageId);
        assertEq(mailbox.callCount(), 1);
    }

    function test_retried_dispatch_is_idempotent_no_second_hyperlane_message() public {
        bytes32 instructionId = bytes32(uint256(1));
        bytes32 first = g.dispatchInstruction{value: 100}(instructionId, 300, recipient, "payload");
        uint256 balanceBefore = address(this).balance;
        bytes32 second = g.dispatchInstruction{value: 100}(instructionId, 300, recipient, "payload");
        assertEq(second, first);
        assertEq(mailbox.callCount(), 1); // no second Hyperlane message/fee spent
        assertEq(address(this).balance, balanceBefore); // the retried value was fully refunded
    }

    function test_different_instruction_ids_dispatch_independently() public {
        bytes32 a = g.dispatchInstruction{value: 100}(bytes32(uint256(1)), 300, recipient, "payload-a");
        bytes32 b = g.dispatchInstruction{value: 100}(bytes32(uint256(2)), 300, recipient, "payload-b");
        assertTrue(a != b);
        assertEq(mailbox.callCount(), 2);
    }

    receive() external payable {}
}
