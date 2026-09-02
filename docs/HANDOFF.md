# Codex / Claude Deployment Handoff

PRAEST is a frozen-scope product. Your job after receiving this repository is **not** to redesign or reduce it. Your job is to install native/dependency toolchains, configure real credentials, deploy every component, fix environment-specific integration errors, run the acceptance suite and collect proof.

## First commands

```bash
cp .env.example .env.local
npm install
npm run doctor
npm run verify:repo
npm run typecheck
npm test
```

Read all failures as real work. Never replace a failed integration with a fake success response.

## Required deployment proof

Record into `verification/live-proof.json`:

- provider project/account identifiers (never secrets)
- deployed StudioNet Intelligent Contract addresses
- representative StudioNet adjudication tx IDs through decided/appeal/finalized lifecycle
- zkSync Sepolia gateway address
- EVM receiver and escrow addresses for each enabled route
- Solana Testnet program ID/config/escrow PDA examples
- Hyperlane ISM addresses/config/validator threshold
- Hyperlane message IDs and destination process tx/signatures
- destination escrow state/balance transitions
- WorkOS sign-in and organisation bootstrap result
- Privy EVM and Solana wallet provisioning result
- probe region observations
- x402 verify/settle receipt
- Stripe test checkout/meter/webhook result
- final Vercel/Railway service URLs

## Do not change these invariants

- StudioNet is the current GenLayer environment.
- Accepted ≠ finalized.
- No irreversible settlement before finalized state.
- Hyperlane carries decisions; destination value normally stays local.
- No fake/permissive production ISM.
- `instructionId` is semantic idempotency.
- destination escrow policy independently constrains beneficiaries/remedy/value.
- collector error ≠ service failure.
- party evidence is not automatically trusted truth.
- route support is registry/config driven.

## Highest-priority proof sequence

1. clean npm install/typecheck/tests
2. Postgres migration + route seed
3. GenVM lint + Direct Mode for all Intelligent Contracts
4. StudioNet contract deployment
5. EVM Foundry tests/deployments
6. Solana cargo tests/program deployment/config
7. fund a Base Sepolia test escrow through the web wallet action
8. create agreement/evidence/case and adjudicate on StudioNet
9. let appeal/finality complete
10. verify deterministic instruction in DecisionOutbox
11. bridge through zkSync Sepolia/Hyperlane
12. verify destination execution and receipt
13. repeat on another EVM route and Solana Testnet
14. provider integrations and operational hardening

## Environment-specific fixes are allowed

You may update SDK call shapes, provider options, deployed addresses, gas settings and network registry data when verified current documentation requires it. Preserve the domain model and trust boundaries unless a documented external blocker proves a change necessary.
