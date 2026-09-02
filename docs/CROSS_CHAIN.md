# Cross-Chain Decision Delivery

## Four different objects

1. **GenLayer transaction** — requests adjudication.
2. **PRAEST decision** — finalized canonical result.
3. **Hyperlane message** — authenticated bytes carrying the settlement instruction.
4. **Destination transaction** — executes local escrow state/value movement.

A source transaction is not transferred between chains.

## StudioNet flow

```text
StudioNet DecisionOutbox
→ PRAEST bridge verifies exact payload
→ zkSync Sepolia StudioDecisionGateway
→ Hyperlane Mailbox.dispatch
→ relayer supplies ISM metadata / process transaction
→ destination Mailbox verifies ISM
→ PRAEST receiver/program checks origin/sender/policy
→ local escrow execution
```

## Route families

- EVM → EVM message recipient/escrow implementation
- EVM → Solana Sealevel recipient/escrow implementation

The same canonical PRAEST wire envelope is decoded independently in TypeScript, Solidity and Rust.

## Asset movement

PRAEST GMP decision delivery and asset movement are separate concerns. If an agreement genuinely requires value to move between chains, an `AssetMovementAdapter` may use a canonical asset rail such as Circle infrastructure where supported or a Hyperlane Warp Route. Normal settlement does not require this.
