# PRAEST Solana Testnet recipient

The program implements Hyperlane's Sealevel message-recipient interface directly. `HandleAccountMetas` derives only PRAEST config/escrow/token accounts from the message; it never returns the relayer payer account. `Handle` consumes those accounts in the identical order.

Settlement uses one PDA per `escrowId`, and replay state is stored inside that escrow. Beneficiary SPL associated token accounts must exist before delivery, so Hyperlane settlement never needs the relayer payer as a dynamic signer.

Build with a Solana/Agave-compatible Rust toolchain, then deploy to **Solana Testnet** and initialize with the current Hyperlane Testnet Mailbox/ISM from `packages/config/src/chains.json`.
