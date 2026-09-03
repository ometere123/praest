# PRAEST

**Accountability infrastructure for digital services and autonomous commerce.**

PRAEST turns promises into verifiable obligations: define an agreement, attach value, observe delivery, preserve evidence, resolve ambiguous failures through GenLayer, wait for appeal/finality, deliver the finalized decision through Hyperlane, execute settlement locally on the destination chain, and publish a verifiable receipt.

## Product surfaces

- **Product** — customer/provider/enterprise/agent workflows: services, agreements, monitoring, evidence, incidents, disputes, appeals, decisions, escrow, settlements, agents, x402, event resolution, analytics and reputation.
- **Control Plane** — PRAEST operations: probes, workflows, StudioNet, routes, Hyperlane, ISMs, system wallets, reconciliation, billing, security and audit.
- **Developer Platform** — REST/OpenAPI, TypeScript SDK, Python SDK, CLI, MCP, x402 and Resolution API.
- **Explorer** — public-safe lineage for agreements, cases, decisions, instructions, Hyperlane messages, settlements and receipts.

`packages/config/src/routes.json` is the frozen route catalog and currently resolves 165 product/control/developer/explorer URLs.

## Current execution architecture

```text
service / agent / event obligation
        ↓
monitoring + execution evidence
        ↓
incident / claim / dispute
        ↓
deterministic evaluation where possible
        ↓
GenLayer StudioNet adjudication
        ↓
accepted / appealable (provisional)
        ↓
FINALIZED
        ↓
deterministic settlement engine
        ↓
DecisionOutbox on StudioNet
        ↓
PRAEST Studio relay (non-custodial trust boundary)
        ↓
StudioDecisionGateway on zkSync Sepolia
        ↓
Hyperlane GMP message
        ↓
destination Mailbox + real ISM
        ↓
PRAEST destination receiver / Solana recipient
        ↓
local escrow execution
        ↓
independent reconciliation
        ↓
PRAEST receipt + reputation / TVG
```

Hyperlane normally transports **decision bytes**, not customer funds. Destination value remains on the chain where settlement occurs.

## Testnet route mesh

The route engine is registry-driven. The included testnet configuration covers:

- zkSync Sepolia — StudioNet Hyperlane origin/hub and optional destination
- Ethereum Sepolia
- Base Sepolia
- Arbitrum Sepolia
- Optimism Sepolia
- Polygon Amoy
- Scroll Sepolia
- Linea Sepolia
- Solana Testnet (`solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z`)

Arc is not falsely advertised as a Hyperlane route because an official Hyperlane Core deployment has not been verified in the frozen registry data. The generic transport/route model means another supported EVM route is configuration + receiver deployment rather than new product logic.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run doctor
npm run db:migrate
npm run seed:routes
npm run dev
```

Then configure WorkOS, Privy, Supabase/Postgres, Upstash, Temporal, ClickHouse, R2, AWS, StudioNet, funded testnet deployers, Hyperlane, Stripe and the other providers listed in `.env.example`.

Deployment/verification order is documented in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Repository layout

```text
apps/
  web/       Next.js Product + Control + Developer + Explorer
  api/       NestJS/Fastify control/API plane
  worker/    Temporal durable workflows
  bridge/    StudioNet → zkSync Hyperlane relay and destination reconciler
  probe/     AWS Lambda regional probe
  relayer/   Hyperlane relayer runtime
contracts/
  genlayer/  StudioNet Intelligent Contracts
  evm/       gateway, receiver, escrow and canonical wire decoder
  solana/    Hyperlane Sealevel recipient + per-escrow SPL settlement
packages/
  database/  Drizzle schema + migration
  protocol/  canonical PRAEST decision envelope
  config/    routes + chain registry
  schemas/   API schemas
  sdk-typescript/
  sdk-python/
  cli/
  mcp/
infrastructure/
  hyperlane/
  clickhouse/
```

## Hard safety invariants

- GenLayer `ACCEPTED` is not final.
- No irreversible settlement until GenLayer finality.
- StudioNet cannot directly call Hyperlane; the explicit relay is documented as a trust boundary.
- Production settlement never uses an always-true ISM.
- Hyperlane transport replay protection is supplemented by PRAEST `instructionId` replay protection and escrow state-machine protection.
- Destination escrow binds agreement, asset, payer, provider, customer and customer-remedy cap locally.
- Collector infrastructure failure is `UNKNOWN/COLLECTOR_ERROR`, not a service outage.
- Party evidence is provenance-labelled; public evidence can be independently re-fetched by validators.
- Secrets are not committed; service/integration/webhook credentials are encrypted at rest before database storage.
- Browser escrow funding is non-custodial: the user's wallet signs, then PRAEST independently verifies chain state.

## Verification truthfulness

This source bundle has static verification tooling in `scripts/verify-repo.mjs` and environment/toolchain checks in `scripts/doctor.mjs`. The execution environment used to assemble this repository did not provide Foundry, Rust/Cargo or Solana CLI and dependency installation was not reliable, so native EVM/Solana compilation and credential-bound live testnet proofs are explicitly marked **pending local proof**, not falsely reported as passed. See [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).

## Agent handoff

Read, in order:

1. `AGENTS.md`
2. `docs/ARCHITECTURE.md`
3. `docs/TRUST_MODEL.md`
4. `docs/IMPLEMENTATION_STATUS.md`
5. `docs/DEPLOYMENT.md`
6. `docs/HANDOFF.md`
7. `docs/REQUIREMENTS_TRACEABILITY.md`

Do not reduce scope or replace real integrations with mocks in order to make checks green.
