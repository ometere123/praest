# PRAEST Agent Instructions

PRAEST is a frozen-scope full product. Do not remove or defer product capabilities to "later versions". Implementation may be sequenced by dependency only.

## Hard invariants
- GenLayer environment for the current build is StudioNet.
- `ACCEPTED` is provisional; irreversible settlement requires `FINALIZED` plus successful execution result.
- StudioNet has no general EVM/ghost-contract execution. Cross-chain decisions leave StudioNet through the explicit Studio bridge worker and zkSync Sepolia gateway.
- Hyperlane normally transports a versioned decision instruction, not the settlement asset.
- Destination settlement is local to the destination chain/escrow.
- Never use an ISM that always verifies or reports `ModuleType.Unused` as security.
- Destination contracts authenticate Mailbox, origin, sender, target, expiry and idempotency.
- `instructionId` is the business-level idempotency key; `decisionHash` identifies the adjudication result.
- Collector failure is not service failure.
- User/party evidence is provenance-labelled and never automatically trusted as truth.
- Do not replace missing live credentials with fake success paths. Return explicit UNCONFIGURED/PENDING/FAILED states.
- No secrets, private keys or provider tokens in git.

## Before changing external integrations
Read the matching official documentation and verify current package/network behavior. Hyperlane registry data is dynamic; prefer registry/configuration over hard-coded chain metadata.
