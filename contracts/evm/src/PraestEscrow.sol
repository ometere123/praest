// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Destination-local value store. Hyperlane never moves the escrowed asset in PRAEST's normal path.
/// @dev Each escrow binds the business policy needed to reject arbitrary settlement instructions.
contract PraestEscrow is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    /// @dev Payer self-refund is only available once this window has passed with nothing settled -
    /// closes the gap where a payer could withdraw funding mid-agreement/mid-dispute, before
    /// adjudication had a chance to run, defeating the escrow's assurance purpose.
    uint64 public constant DEFAULT_REFUND_LOCK_SECONDS = 7 days;

    struct Escrow {
        bytes32 agreementId;
        address token;
        address payer;
        address provider;
        address customer;
        uint16 maxCustomerRemedyBps;
        uint256 deposited;
        uint256 remaining;
        uint64 lockUntil;
        bool exists;
    }

    mapping(bytes32 => Escrow) public escrows;
    mapping(bytes32 => bool) public executedInstructions;

    event EscrowFunded(
        bytes32 indexed escrowId,
        bytes32 indexed agreementId,
        address indexed payer,
        address token,
        address provider,
        address customer,
        uint16 maxCustomerRemedyBps,
        uint256 amount
    );
    event EscrowSettled(bytes32 indexed escrowId, bytes32 indexed instructionId, uint256 totalReleased, uint256 remaining);
    event EscrowRefunded(bytes32 indexed escrowId, address indexed payer, uint256 amount);

    error UnknownEscrow();
    error AssetMismatch();
    error AgreementMismatch();
    error PolicyMismatch();
    error InsufficientEscrow();
    error InvalidAllocation();
    error AlreadyUsed();
    error InstructionReplay();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setSettler(address settler, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(SETTLER_ROLE, settler);
        else _revokeRole(SETTLER_ROLE, settler);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    /// @notice Creates and funds an immutable escrow policy. Additional deposits are allowed only with identical policy.
    function fund(
        bytes32 escrowId,
        bytes32 agreementId,
        address token,
        address provider,
        address customer,
        uint16 maxCustomerRemedyBps,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (amount == 0 || token == address(0) || provider == address(0) || customer == address(0) || provider == customer) {
            revert InvalidAllocation();
        }
        if (maxCustomerRemedyBps > 10_000) revert PolicyMismatch();

        Escrow storage e = escrows[escrowId];
        if (!e.exists) {
            e.agreementId = agreementId;
            e.token = token;
            e.payer = msg.sender;
            e.provider = provider;
            e.customer = customer;
            e.maxCustomerRemedyBps = maxCustomerRemedyBps;
            e.lockUntil = uint64(block.timestamp) + DEFAULT_REFUND_LOCK_SECONDS;
            e.exists = true;
        } else {
            if (e.remaining != e.deposited) revert AlreadyUsed();
            if (e.agreementId != agreementId) revert AgreementMismatch();
            if (e.token != token || e.payer != msg.sender || e.provider != provider || e.customer != customer || e.maxCustomerRemedyBps != maxCustomerRemedyBps) {
                revert PolicyMismatch();
            }
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        e.deposited += amount;
        e.remaining += amount;
        emit EscrowFunded(escrowId, agreementId, msg.sender, token, provider, customer, maxCustomerRemedyBps, amount);
    }

    /// @notice Executes only allocations allowed by the locally registered escrow policy.
    function execute(
        bytes32 escrowId,
        bytes32 agreementId,
        bytes32 instructionId,
        address token,
        address[] calldata beneficiaries,
        uint256[] calldata amounts
    ) external onlyRole(SETTLER_ROLE) nonReentrant whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (!e.exists) revert UnknownEscrow();
        if (executedInstructions[instructionId]) revert InstructionReplay();
        if (e.agreementId != agreementId) revert AgreementMismatch();
        if (e.token != token) revert AssetMismatch();
        if (beneficiaries.length == 0 || beneficiaries.length != amounts.length) revert InvalidAllocation();

        uint256 total;
        uint256 customerAmount;
        for (uint256 i; i < amounts.length; i++) {
            address b = beneficiaries[i];
            uint256 amount = amounts[i];
            if (amount == 0 || (b != e.provider && b != e.customer)) revert InvalidAllocation();
            total += amount;
            if (b == e.customer) customerAmount += amount;
        }
        if (total > e.remaining) revert InsufficientEscrow();
        if (customerAmount > (e.deposited * e.maxCustomerRemedyBps) / 10_000) revert PolicyMismatch();

        executedInstructions[instructionId] = true;
        e.remaining -= total;
        for (uint256 i; i < amounts.length; i++) IERC20(token).safeTransfer(beneficiaries[i], amounts[i]);
        emit EscrowSettled(escrowId, instructionId, total, e.remaining);
    }

    /// @notice Payer recovery is only possible before any settlement consumed escrow value, AND only
    /// once the lock window has passed - a payer cannot unilaterally withdraw funding while an
    /// agreement is still active or a dispute could still be open. Legitimate early
    /// cancellation/refund (agreement canceled before activation, or a finalized decision awarding a
    /// full refund before the lock expires) goes through settlerRefund, gated the same way as
    /// execute().
    function refundUnused(bytes32 escrowId) external nonReentrant whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (!e.exists) revert UnknownEscrow();
        if (msg.sender != e.payer) revert InvalidAllocation();
        if (e.remaining != e.deposited) revert AlreadyUsed();
        if (block.timestamp < e.lockUntil) revert PolicyMismatch();
        uint256 amount = e.remaining;
        e.remaining = 0;
        IERC20(e.token).safeTransfer(e.payer, amount);
        emit EscrowRefunded(escrowId, e.payer, amount);
    }

    /// @notice Authorized early refund path (agreement canceled before activation, or a finalized
    /// GenLayer decision awarding a full refund) - bypasses the payer-side time lock, but only for
    /// the same trusted settler role that executes normal settlement instructions.
    function settlerRefund(bytes32 escrowId) external onlyRole(SETTLER_ROLE) nonReentrant whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (!e.exists) revert UnknownEscrow();
        uint256 amount = e.remaining;
        if (amount == 0) revert InvalidAllocation();
        e.remaining = 0;
        IERC20(e.token).safeTransfer(e.payer, amount);
        emit EscrowRefunded(escrowId, e.payer, amount);
    }
}
