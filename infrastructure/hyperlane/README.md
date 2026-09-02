# Hyperlane transport

PRAEST uses Hyperlane GMP for **decision instruction delivery**, not as the default asset bridge.

Origin during StudioNet development: zkSync Sepolia `StudioDecisionGateway`.
Destinations are loaded from `packages/config/src/chains.json` and include the EVM testnet mesh plus Solana Testnet.

Run the current TypeScript relayer service through `apps/relayer`. Set `HYP_KEY`, `RELAYER_CONFIG_FILE`, and chain RPC environment variables. Keep the relayer funded with destination gas. The destination `PraestSettlementReceiver` or Solana recipient remains authoritative for origin/sender/expiry/idempotency and local settlement execution.
