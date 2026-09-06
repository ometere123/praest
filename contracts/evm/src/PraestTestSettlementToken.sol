// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Explicitly labelled test settlement asset for PRAEST testnet proofs.
/// @dev PRAEST never claims this is Circle USDC or any other real asset - the name and symbol say
/// so on-chain. It exists so the settlement path can be proven end to end without waiting on a
/// faucet that requires a human. Same 6 decimals as USDC so amounts read identically, and the
/// escrow is token-agnostic, so swapping in real testnet USDC later changes only an address.
/// Mirrors the labelled-test-mint approach AGENTS.md already requires for Solana settlement.
contract PraestTestSettlementToken is ERC20, Ownable {
    constructor(address owner_) ERC20("PRAEST Test Settlement USD", "ptUSD") Ownable(owner_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Test-only faucet. Owner-gated so a stray mint cannot distort a recorded proof.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
