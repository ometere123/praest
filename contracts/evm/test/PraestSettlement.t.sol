// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PraestEscrow} from "../src/PraestEscrow.sol";
import {PraestSettlementReceiver} from "../src/PraestSettlementReceiver.sol";
import {IInterchainSecurityModule} from "../src/interfaces/IHyperlane.sol";

contract Token is ERC20 { constructor() ERC20("Test USD", "tUSD") {} function mint(address a, uint256 n) external { _mint(a, n); } }
contract TestIsm is IInterchainSecurityModule { function moduleType() external pure returns (uint8) { return 5; } function verify(bytes calldata, bytes calldata) external pure returns (bool) { return true; } }

contract PraestSettlementTest is Test {
    PraestEscrow e; PraestSettlementReceiver r; Token t;
    address payer = address(0xA11CE); address provider = address(0xB0B); address customer = address(0xCAFE);
    bytes32 sender = bytes32(uint256(uint160(address(0xBEEF)))); bytes32 agreementId = bytes32(uint256(3));
    uint32 origin = 300; uint32 local = 84532;

    function setUp() public {
        t = new Token(); e = new PraestEscrow(address(this));
        r = new PraestSettlementReceiver(address(this), address(this), local, origin, sender, address(new TestIsm()), e);
        e.setSettler(address(r), true); t.mint(payer, 1_000_000);
        vm.startPrank(payer); t.approve(address(e), type(uint256).max);
        e.fund(bytes32(uint256(1)), agreementId, address(t), provider, customer, 5000, 1_000_000);
        vm.stopPrank();
    }

    function payload(bytes32 instructionId, uint64 expiry, uint32 dest, bytes32 target, address beneficiary, uint128 amount) internal view returns (bytes memory b) {
        b = abi.encodePacked(
            bytes4(0x50525354), uint16(1), instructionId, bytes32(uint256(2)), agreementId,
            bytes32(uint256(4)), uint32(1), bytes32(uint256(5)), uint8(2), uint8(2), target,
            bytes32(uint256(1)), bytes32(uint256(uint160(address(t)))), uint8(6), uint64(block.timestamp),
            expiry, origin, dest, uint64(1), uint8(1), bytes32(uint256(uint160(beneficiary))), amount
        );
    }

    function test_success_and_replay() public {
        bytes32 id = bytes32(uint256(9));
        bytes memory p = payload(id, uint64(block.timestamp + 100), local, bytes32(uint256(uint160(address(r)))), customer, 250_000);
        r.handle(origin, sender, p); assertEq(t.balanceOf(customer), 250_000);
        vm.expectRevert(PraestSettlementReceiver.Replay.selector); r.handle(origin, sender, p);
    }
    function test_wrong_origin() public { vm.expectRevert(PraestSettlementReceiver.UnauthorizedOrigin.selector); r.handle(301, sender, payload(bytes32(uint256(9)), uint64(block.timestamp+100), local, bytes32(uint256(uint160(address(r)))), customer, 1)); }
    function test_wrong_sender() public { vm.expectRevert(PraestSettlementReceiver.UnauthorizedSender.selector); r.handle(origin, bytes32(uint256(99)), payload(bytes32(uint256(9)), uint64(block.timestamp+100), local, bytes32(uint256(uint160(address(r)))), customer, 1)); }
    function test_expired() public { vm.expectRevert(PraestSettlementReceiver.Expired.selector); r.handle(origin, sender, payload(bytes32(uint256(9)), uint64(block.timestamp-1), local, bytes32(uint256(uint160(address(r)))), customer, 1)); }
    function test_wrong_target() public { vm.expectRevert(PraestSettlementReceiver.WrongTarget.selector); r.handle(origin, sender, payload(bytes32(uint256(9)), uint64(block.timestamp+1), local, bytes32(uint256(123)), customer, 1)); }
    function test_wrong_destination() public { vm.expectRevert(PraestSettlementReceiver.WrongDestination.selector); r.handle(origin, sender, payload(bytes32(uint256(9)), uint64(block.timestamp+100), 10, bytes32(uint256(uint160(address(r)))), customer, 1)); }
    function test_unknown_beneficiary_rejected_by_local_policy() public { vm.expectRevert(PraestEscrow.InvalidAllocation.selector); r.handle(origin, sender, payload(bytes32(uint256(9)), uint64(block.timestamp+100), local, bytes32(uint256(uint160(address(r)))), address(0xD00D), 1)); }
    function test_remedy_cap_rejected() public { vm.expectRevert(PraestEscrow.PolicyMismatch.selector); r.handle(origin, sender, payload(bytes32(uint256(9)), uint64(block.timestamp+100), local, bytes32(uint256(uint160(address(r)))), customer, 500_001)); }
    function test_provider_allocation_allowed() public { r.handle(origin, sender, payload(bytes32(uint256(11)), uint64(block.timestamp+100), local, bytes32(uint256(uint160(address(r)))), provider, 750_000)); assertEq(t.balanceOf(provider), 750_000); }
}
