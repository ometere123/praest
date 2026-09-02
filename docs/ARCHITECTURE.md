# PRAEST Architecture

## Thesis

PRAEST answers a consequential question: **did a digital service, API, human provider or autonomous agent fulfil what it promised?** It combines deterministic measurement with evidence-based adjudication, then converts a finalized decision into destination-local execution.

## Planes

### Product
Customer/provider/agent workflows are rendered by `apps/web` and backed by the canonical API. Product routes cover onboarding, services, agreements, monitoring, evidence, cases/disputes, adjudications/appeals, decisions, escrow/funding, settlements/receipts, agents/tasks/liability, x402, events, analytics, integrations, billing, organisation and settings.

### Control Plane
The same web application exposes protected operator surfaces for StudioNet, workflows, probes, evidence, Hyperlane, routes, ISMs, chain contracts, system wallets, reconciliation, security, billing, TVG and audit.

### Developer Platform
REST/OpenAPI is provided by `apps/api`. `packages/sdk-typescript`, `packages/sdk-python`, `packages/cli` and `packages/mcp` are alternate clients of that same API. The Resolution API lets third parties consume PRAEST adjudication without implementing GenLayer/finality/settlement lifecycle themselves.

## Source of truth by subsystem

| Concern | Authoritative store/system |
| --- | --- |
| tenants, agreements, cases, settlement lifecycle | PostgreSQL / Drizzle |
| high-volume monitoring measurements | ClickHouse |
| evidence objects/proofs/exports | Cloudflare R2 |
| ephemeral cache/rate limits/locks | Upstash Redis |
| long-lived workflows | Temporal |
| consequential ambiguous judgment | GenLayer StudioNet |
| cross-chain authenticated delivery | Hyperlane Mailbox + ISM |
| financial settlement | destination escrow/program state |
| customer identity | WorkOS |
| embedded wallet ownership | Privy |

Redis is never authoritative business state.

## Canonical lifecycle

```text
identity → organisation → service/agent → agreement
→ observation/execution → evidence → incident/case
→ deterministic evaluation → StudioNet adjudication
→ appeal/finality → deterministic settlement instruction
→ DecisionOutbox → Studio relay → zkSync Sepolia gateway
→ Hyperlane → destination receiver/program → local escrow
→ reconciliation → receipt → reputation/TVG
```

## GenLayer boundary

PRAEST uses deterministic code for timestamps, uptime math, threshold arithmetic, allocation math, caps, idempotency and settlement construction. GenLayer is reserved for evidence interpretation, conflicting evidence, agreement interpretation, fulfilment, liability and event resolution.

Current Intelligent Contracts:

- `AgreementRegistry.py`
- `EvidenceAssessor.py`
- `ServiceAssuranceResolver.py`
- `DisputeResolver.py`
- `SettlementEntitlement.py`
- `AgentAgreementResolver.py`
- `LiabilityResolver.py`
- `EventResolver.py`
- `DecisionOutbox.py`

Every generated contract pins the production GenVM runner hash.

## StudioNet transport boundary

StudioNet does not provide the live GenLayer EVM/ghost-contract path. Therefore PRAEST deliberately uses:

```text
DecisionOutbox (StudioNet)
→ apps/bridge verifies canonical final instruction
→ StudioDecisionGateway (zkSync Sepolia)
→ Hyperlane Mailbox.dispatch(bytes)
→ destination Mailbox.process
→ PRAEST recipient
```

The bridge worker is not a custodian and never chooses beneficiaries or amounts. It is a development-environment decision adapter. It must prove the StudioNet outbox value equals the database-authorized payload before dispatch.

A dormant `DecisionTransport` abstraction may support a native GenLayer transport later, but no current product function depends on another GenLayer network.

## Decision envelope

`packages/protocol` owns the wire format. A wire protocol version is not a deferred product version. The envelope binds:

- instruction ID
- case and agreement IDs
- decision hash
- policy version
- evidence manifest hash
- outcome / settlement type
- settlement target and escrow ID
- asset and decimals
- allocations
- finalized timestamp / expiry
- origin / destination domains
- deterministic nonce

`instructionId` is execution identity. `decisionHash` is adjudication identity. One decision can legitimately authorize more than one instruction when separate destination executions are required.

## Settlement construction

`SettlementEngine` does not allow the GenLayer result to name arbitrary payout addresses. It resolves the finalized decision against:

- immutable active agreement version
- accepted parties and their configured settlement addresses
- funded escrow policy
- destination route
- customer remedy cap
- actual remaining escrow amount

It produces deterministic allocations and a deterministic nonce, and returns an existing decision+escrow instruction when already constructed.

## Destination-local controls

### EVM
`PraestSettlementReceiver` checks Mailbox caller, origin, sender, local destination domain, target, finality, expiry and instruction replay. `PraestEscrow` binds agreement/asset/payer/provider/customer/remedy cap and refuses arbitrary recipients or excessive customer remedy.

### Solana Testnet
The Sealevel recipient verifies Hyperlane process authority, trusted route, target/finality/expiry and per-escrow instruction replay. Each escrow is a PDA keyed by `escrowId`; token settlement is local SPL execution. Dynamic `HandleAccountMetas` excludes the relayer payer and matches `handle` account ordering.

## Monitoring and evidence

AWS Lambda probes are scheduled independently by region. The probe engine measures DNS, TCP, TLS, TTFB and total latency, validates HTTPS targets and assertions, caps response bodies and prevents private/metadata-network SSRF including DNS rebinding by pinning the vetted IP while preserving TLS hostname validation.

Collector errors do not become service failures. Evidence metadata and immutable hashes live in Postgres; evidence bodies/proofs live in R2. Public source URLs may be included in evidence manifests so GenLayer validators can independently re-fetch them.

## Route engine

`packages/config/src/chains.json` is the included route seed, while Hyperlane registry data is treated as dynamic external network metadata. PRAEST business logic never hard-codes one destination chain. EVM and Sealevel transport/settlement families are implemented separately behind a common route model.
