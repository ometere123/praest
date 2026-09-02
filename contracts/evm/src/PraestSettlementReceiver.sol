// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IInterchainSecurityModule} from "./interfaces/IHyperlane.sol";
import {PraestWire} from "./PraestWire.sol";
import {PraestEscrow} from "./PraestEscrow.sol";

/// @notice Hyperlane recipient for finalized PRAEST settlement instructions.
contract PraestSettlementReceiver is AccessControl, Pausable {
    address public immutable mailbox;
    uint32 public immutable localDomain;
    uint32 public trustedOrigin;
    bytes32 public trustedSender;
    IInterchainSecurityModule private _ism;
    PraestEscrow public escrow;

    mapping(bytes32 => bool) public processedInstructions;
    mapping(bytes32 => bytes32) public instructionDecision;

    event DecisionReceived(bytes32 indexed instructionId, bytes32 indexed decisionHash, uint32 origin);
    event SettlementExecuted(bytes32 indexed instructionId, bytes32 indexed decisionHash, bytes32 escrowId, uint256 total);

    error MailboxOnly();
    error UnauthorizedOrigin();
    error UnauthorizedSender();
    error Expired();
    error InvalidFinality();
    error WrongDestination();
    error WrongTarget();
    error Replay();
    error InvalidIsm();

    constructor(
        address admin,
        address mailbox_,
        uint32 localDomain_,
        uint32 origin_,
        bytes32 sender_,
        address ism_,
        PraestEscrow escrow_
    ) {
        require(mailbox_ != address(0) && ism_ != address(0) && address(escrow_) != address(0), "zero");
        mailbox = mailbox_;
        localDomain = localDomain_;
        trustedOrigin = origin_;
        trustedSender = sender_;
        _ism = IInterchainSecurityModule(ism_);
        escrow = escrow_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @dev Hyperlane Mailbox queries this method and uses the returned ISM for process() verification.
    function interchainSecurityModule() external view returns (IInterchainSecurityModule) { return _ism; }

    function setIsm(address module) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (module == address(0)) revert InvalidIsm();
        _ism = IInterchainSecurityModule(module);
    }

    function setTrustedRoute(uint32 origin, bytes32 sender) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trustedOrigin = origin;
        trustedSender = sender;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function handle(uint32 origin, bytes32 sender, bytes calldata message) external whenNotPaused {
        if (msg.sender != mailbox) revert MailboxOnly();
        if (origin != trustedOrigin) revert UnauthorizedOrigin();
        if (sender != trustedSender) revert UnauthorizedSender();

        PraestWire.Instruction memory x = PraestWire.decode(message);
        if (x.sourceDomain != origin) revert UnauthorizedOrigin();
        if (x.destinationDomain != localDomain) revert WrongDestination();
        if (x.settlementTarget != PraestWire.address32(address(this))) revert WrongTarget();
        if (x.finalizedAt == 0 || x.finalizedAt > block.timestamp) revert InvalidFinality();
        if (block.timestamp > x.expiresAt || x.expiresAt <= x.finalizedAt) revert Expired();
        if (processedInstructions[x.instructionId]) revert Replay();

        // Effects are written before the external escrow interaction. A settlement revert atomically rolls them back.
        processedInstructions[x.instructionId] = true;
        instructionDecision[x.instructionId] = x.decisionHash;
        emit DecisionReceived(x.instructionId, x.decisionHash, origin);

        address[] memory beneficiaries = new address[](x.allocations.length);
        uint256[] memory amounts = new uint256[](x.allocations.length);
        uint256 total;
        for (uint256 i; i < x.allocations.length; i++) {
            beneficiaries[i] = PraestWire.toAddress(x.allocations[i].beneficiary);
            amounts[i] = uint256(x.allocations[i].amount);
            total += amounts[i];
        }

        escrow.execute(
            x.escrowId,
            x.agreementId,
            x.instructionId,
            PraestWire.toAddress(x.asset),
            beneficiaries,
            amounts
        );
        emit SettlementExecuted(x.instructionId, x.decisionHash, x.escrowId, total);
    }
}
