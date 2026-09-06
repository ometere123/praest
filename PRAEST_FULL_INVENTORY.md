# PRAEST — Full Inventory (as of 2026-09-05)

Everything that exists right now: what's built, what's deployed, what's live-proven, what's
blocked, and every single environment variable's fill status. Nothing curated out.

---

## 1. What PRAEST is

Accountability infrastructure for digital services and autonomous agent commerce. Core lifecycle:
Identity → Organisation → Service/Agent → Agreement → Monitoring/Execution → Evidence →
Incident/Claim/Dispute → Deterministic Evaluation → GenLayer Adjudication → Appeal/Finality →
Deterministic Settlement → Hyperlane Decision Delivery → Destination-Local Settlement →
Reconciliation → Receipt → Analytics/Reputation.

Monorepo: npm workspaces + Turborepo. NestJS/Fastify API, Next.js 16 web app, Temporal worker,
zkSync-relay bridge, regional probe service, shared packages (config/database/schemas/protocol/
sdk/cli/mcp).

---

## 2. Repository / git state

- GitHub: `github.com/ometere123/praest`, branch `main`
- History was fully rewritten this session (author reattributed to `PAPITO
  <45469370+ometere123@users.noreply.github.com>`) — repo was deleted and recreated fresh
- 25+ commits this session alone (see `git log` for full detail); highlights below
- Working tree currently has one uncommitted addition: `skills/internet-court/` (vendored, not
  yet committed) and this inventory file itself

---

## 3. GenLayer — deployed and live-proven on **studio-dev** (consensus v0.6 migration)

**Network**: `studioDevnet`, chain `61997`, RPC `https://studio-dev.genlayer.com/api` (the
current v0.6 migration/test network — separate from stable `studionet`, chain `61999`, which
remains supported via `GENLAYER_NETWORK=studionet`).

**Runner pin** (confirmed correct, live-verified): `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`

**All 9 Intelligent Contracts deployed, addresses**:

| Contract | Address | Live semantic proof |
|---|---|---|
| `AgreementRegistry` | `0x8E5fd5260568Db6b455e146536270D4367C634b4` | deploy+finalize only (no nondet) |
| `EvidenceAssessor` | `0xcd007f5352C8aD38fbAeCf3E301c694b385f0b61` | ✅ live call, `FINALIZED`/`FINISHED_WITH_RETURN` |
| `ServiceAssuranceResolver` | `0xAB67b705917Bb275af830d5015FF20aD5C2558ca` | ✅ live call |
| `DisputeResolver` | `0xDB21697e97a9A5b8b44A9F9FAFc6c116e6f744aA` | ✅ live call |
| `SettlementEntitlement` | `0xf0ef6754D1Cd691d728c957091F2e3C8EE742f56` | deploy+finalize only (no nondet) |
| `AgentAgreementResolver` | `0x1D92a75A61EdE76BE75F42d72B00A5C993C0600E` | ✅ live call |
| `LiabilityResolver` | `0xEFA69e324Eaba9F49B4C597B50783d56eCd58891` | ✅ live call (most complex validator) |
| `EventResolver` | `0x9FD22e352ddc75Aa1B88f2cb7F75C2D6Ab55551f` | ✅ live call |
| `DecisionOutbox` | `0xb00F81C8b08d09F921FBA4A108e1343Afd9Daaec` | deploy+finalize only (no nondet) |

Full tx hashes in `deployments/studioDevnet.json`. Evidence record: `docs/GENLAYER_V06_MIGRATION.md`.

**Local tooling caveat (disclosed, not hidden)**: local `genvm-lint` (v0.11.0) flags all 6
`run_nondet_default`-using contracts with "not reachable from equivalence principle block" and
can't load either runner's SDK bundle to validate locally. Classified as **tooling-version lag**,
not a contract defect — proven by live execution on all 6, each producing genuine reasoned
results (see the doc for exact transcripts).

**What's genuinely NOT done here**:
- `client.advanced.getTransactionLifecycle()` — now wired into `LifecycleService.finalize()` ✅
- Resolver specialization (Service/Dispute/Agent/Liability/Event no longer identical prompts) ✅
- A brand-new "agent supervision" GenLayer contract (continue/warn/constrain/revoke) for the
  Internet Court connector — **not built**; existing `AgentAgreementResolver` reused instead
  (see §7)

---

## 4. Security/trust fixes landed this session

- x402 self-attested "paid" receipt endpoint — **removed**
- TLSNotary self-verification via the ordinary (non-webhook) endpoint — **closed**
- WorkOS bootstrap tenant-escalation (client-supplied org id) — **fixed**
- Globalping receiving customer auth headers (credential leak to a public probe network) — **blocked, hard invariant**
- GenLayer `finalize()` gated on a nonexistent `READY_TO_FINALIZE` status — **fixed**, now uses
  the real protocol lifecycle projection
- EVM `PraestEscrow` premature-refund (payer could withdraw mid-dispute) — **fixed**, 7-day lock
  + settler-gated early release, 17 Foundry tests passing
- Solana escrow same premature-refund fix applied — **not compiler-verified** (no MSVC linker on
  this machine; verified by manual review + GitHub Actions Linux runner proven to work for a
  prior Solana fix)
- Hyperlane gateway `dispatchInstruction` — **semantic idempotency added** (no duplicate
  message/fee on a retried bridge cycle)

---

## 5. x402

- Verify/settle bookkeeping: implemented, real facilitator calls (`@x402/core`, `@x402/evm`
  v2.24.0, current non-deprecated packages)
- **Seller-side HTTP 402 challenge/verify/settle flow: implemented** on a demo endpoint
  (`GET /v1/x402/example-resource`) using the vendor SDK's own `x402ResourceServer`/
  `x402HTTPResourceServer` (not hand-rolled) — 2 unit tests
- **Not decided**: which real production endpoint (if any) should be paywalled — that's a
  product decision, not a code gap

---

## 6. Cross-chain / EVM / Solana / Hyperlane

- EVM destination contracts (`PraestSettlementReceiver`, `PraestEscrow`, `StudioDecisionGateway`):
  source complete, Foundry tests passing (31 total across 2 suites) — **not yet deployed to any
  live EVM testnet or zkSync Sepolia**
- **zkSync gateway deploy: BLOCKED on this machine** — `foundry-zksync` (the `--zksync`-flag fork
  of Foundry needed to compile/deploy `StudioDecisionGateway.sol` to zkSync) ships **Linux and
  macOS builds only — no Windows build exists**, confirmed via the actual GitHub release assets.
  `EVM_DEPLOYER_PRIVATE_KEY` is funded and ready; only the toolchain is missing.
- Solana program: source complete (with the same premature-refund fix as EVM), **not
  compiler-verified locally** (no MSVC linker) and **not deployed** — Solana/Agave CLI isn't
  installed (needs admin elevation not available in this session)
- Hyperlane: route/ISM config exists in source; no real ISM configured yet, no live route proven
  end-to-end (blocked behind the above two deployments)

**Both blockers are the same root cause**: this Windows machine has no working native
Rust/C++ toolchain (confirmed: only Git's unrelated `link.exe` on PATH, no MSVC). Real options:
WSL, a Linux/Mac machine, or GitHub Actions' Linux runner (already proven once this session for
a Solana fix).

---

## 7. TLSNotary — genuinely unbuilt, real architecture uncertainty

- PRAEST-side scaffolding exists and is hardened: `apps/api/src/tlsnotary.ts` correctly separates
  "submit a proof artifact" (any authenticated caller, always lands as `pending_verification`)
  from "record the real verifier result" (only the `TLSNOTARY_WEBHOOK_TOKEN`-authenticated
  webhook can ever mark evidence `tlsnotary_verified`)
- **No real MPC-TLS prover/verifier exists** — this is the single largest remaining gap
- Investigated live: the ecosystem's server component has moved/restructured multiple times
  (`tlsnotary/notary-server` standalone repo is deprecated → claims to have merged into
  `tlsnotary/tlsn` → that merge-target path no longer exists in the current repo structure).
  **Could not confirm the current authoritative server binary/example without more specific
  guidance** (e.g. a tagged release or doc page naming it) — flagged rather than guessed at
- Config vars exist (`TLSNOTARY_VERIFIER_URL`, `_VERIFIER_WS_URL`, `_PROXY_WS_URL`,
  `_WEBHOOK_TOKEN`) but are placeholders for a service that doesn't exist yet

---

## 8. Internet Court

- Skill vendored into `skills/internet-court/` (pinned commit
  `fa89195eeb5c12827e0b11e1c16b4fc8733711d4` from `internet-court/internet-court-skill`) — **not
  yet committed to git**
- Real finding from reading the vendored `integrations/genlayer-intelligent-contracts/SKILL.md`:
  its model is **ongoing agent supervision** (decisions: `continue`/`warn`/`constrain`/`revoke`/
  `escalate`) — a genuinely different shape from PRAEST's existing `AgentAgreementResolver`
  (single-task `fulfilled`/`breached`/`partial`/`undetermined` + `remedy_bps`)
- **Plan, not yet built**: a TS adapter that builds Internet Court's `AgentPerformanceReviewInput`
  from PRAEST data, reuses the already-deployed/live-proven `AgentAgreementResolver` rather than
  deploying a new contract, and maps its output back into a supervision decision
- The existing `/v1/internet-court/export` optional interop endpoint (real, already correct —
  no external call unless `INTERNET_COURT_API_URL` is set) is unrelated to this and stays as-is

---

## 9. Infrastructure — current live status

### Railway (`railway.com/project/72ef4f3d-2a24-4c51-872a-57959cffc0bd`)

| Service | Status right now | Why |
|---|---|---|
| `temporal-server` | **No deployment** | Confirmed root-caused earlier: OOMs at the plan's default memory allocation — needs a manual memory-limit increase in the dashboard (Settings → Resources, ≥2GB), which hasn't been done |
| `temporal-postgres` | SUCCESS | healthy |
| `praest-api` | **FAILED** | secrets never pasted in (confirmed: only the 22 non-secret vars I configured are set — no `DATABASE_URL`, `PRAEST_INTERNAL_TOKEN`, `WORKOS_*`, `PRIVY_*`, GenLayer key, etc.) |
| `praest-worker` | **CRASHED** | same — missing `PRAEST_INTERNAL_TOKEN` |
| `praest-bridge` | **CRASHED** | same — missing `DATABASE_URL`, `GENLAYER_STUDIONET_PRIVATE_KEY`, `BRIDGE_EVM_PRIVATE_KEY`, gateway address |
| — | — | **Free/trial plan resource limit reached** — a 6th service (attempted for TLSNotary) was refused; needs a plan upgrade to add more services |

### Vercel

- Project `praest-web` (or `web`, depending which you kept — both were created across this
  session's back-and-forth on the repo delete/recreate) deployed, production URL
  `https://praest-web.vercel.app`
- Currently shows an Internal Server Error until WorkOS/Privy secrets are added there too (same
  pattern as Railway — I only set the 3 non-secret vars)

### Supabase

- `pg_cron` + `pg_net` enabled, two jobs active every 5 minutes:
  `praest-webhook-sweep` → `POST /v1/internal/webhook-deliveries/sweep`
  `praest-monitor-sweep` → `POST /v1/monitors/internal/sweep`
  (Temporal-optional path — these replace `monitorLoop`/`webhookSweep` workflows without touching
  Temporal code)

---

## 10. EVERY environment variable — complete, uncurated

### Filled in `.env.local` (87 of 107)

```
NODE_ENV, PRAEST_ENV, PRAEST_RELEASE, PRAEST_APP_URL, PRAEST_API_URL,
NEXT_PUBLIC_PRAEST_API_URL, PRAEST_INTERNAL_TOKEN, PRAEST_DATA_ENCRYPTION_KEY_BASE64,
PRAEST_RATE_LIMIT_PER_MINUTE, PORT, DATABASE_URL, WORKOS_CLIENT_ID, WORKOS_API_KEY,
WORKOS_COOKIE_PASSWORD, NEXT_PUBLIC_WORKOS_REDIRECT_URI, WORKOS_JWKS_URL, PRIVY_APP_ID,
PRIVY_APP_SECRET, NEXT_PUBLIC_PRIVY_APP_ID, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_TLS, TEMPORAL_TASK_QUEUE, CLICKHOUSE_URL,
CLICKHOUSE_USERNAME, CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE, CLICKHOUSE_MEASUREMENTS_TABLE,
R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_REGION, PROBE_PROVIDER,
GLOBALPING_PROBE_LOCATIONS, GLOBALPING_MEASUREMENT_TYPE, GLOBALPING_API_TOKEN, GENLAYER_NETWORK,
GENLAYER_RPC_URL, GENLAYER_CHAIN_ID, GENLAYER_STUDIONET_PRIVATE_KEY, GENLAYER_PRIVATE_KEY,
GENLAYER_AGREEMENT_REGISTRY_ADDRESS, GENLAYER_EVIDENCE_ASSESSOR_ADDRESS,
GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS, GENLAYER_DISPUTE_RESOLVER_ADDRESS,
GENLAYER_SETTLEMENT_ENTITLEMENT_ADDRESS, GENLAYER_AGENT_AGREEMENT_RESOLVER_ADDRESS,
GENLAYER_LIABILITY_RESOLVER_ADDRESS, GENLAYER_EVENT_RESOLVER_ADDRESS,
GENLAYER_DECISION_OUTBOX_ADDRESS, PRAEST_SETTLEMENT_INSTRUCTION_TTL_SECONDS,
PRAEST_HYPERLANE_ORIGIN_DOMAIN, EVM_DEPLOYER_PRIVATE_KEY, BRIDGE_EVM_PRIVATE_KEY,
HYPERLANE_RELAYER_PRIVATE_KEY, ZKSYNC_SEPOLIA_RPC_URL, BRIDGE_POLL_MS, SEPOLIA_RPC_URL,
BASE_SEPOLIA_RPC_URL, ARBITRUM_SEPOLIA_RPC_URL, OPTIMISM_SEPOLIA_RPC_URL, POLYGON_AMOY_RPC_URL,
SCROLL_SEPOLIA_RPC_URL, LINEA_SEPOLIA_RPC_URL, SOLANA_TESTNET_RPC_URL,
NEXT_PUBLIC_SOLANA_TESTNET_RPC_URL, SOLANA_KEYPAIR_PATH, STRIPE_ENABLED,
STRIPE_METER_EVENT_NAME, BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME,
SENTRY_TRACES_SAMPLE_RATE, X402_ENABLED, X402_NETWORK, X402_FACILITATOR_URL,
BASE_SEPOLIA_CHAIN_ID, X402_USDC_ADDRESS, X402_USDC_DECIMALS, X402_PAY_TO_EVM,
X402_PAY_TO_SOLANA, X402_PAYER_PRIVATE_KEY, TLSNOTARY_ENABLED, TLSNOTARY_TIMEOUT_MS
```

### Blank in `.env.local` (20 of 107)

```
TEMPORAL_API_KEY                        — correctly blank (Cloud-only, not used; self-hosted)
PRAEST_STUDIO_GATEWAY_ADDRESS           — legacy/alternate name, code doesn't read this one
ZKSYNC_STUDIO_DECISION_GATEWAY_ADDRESS  — BLOCKED: needs zkSync gateway deployed (see §6)
PRAEST_SOLANA_PROGRAM_ID                — BLOCKED: needs Solana program deployed (see §6)
PRAEST_SOLANA_TEST_MINT                 — same
STRIPE_SECRET_KEY                       — optional, Stripe disabled by design
STRIPE_WEBHOOK_SECRET                   — optional
STRIPE_PRICE_STARTER                    — optional
STRIPE_PRICE_PRO                        — optional
SENTRY_DSN                              — optional observability
NEXT_PUBLIC_SENTRY_DSN                  — optional observability
OTEL_EXPORTER_OTLP_ENDPOINT             — optional observability
X402_FACILITATOR_TOKEN                  — optional, only if facilitator requires one
X402_EXAMPLE_RESOURCE_PRICE             — optional, defaults to $0.01 in code if unset
TLSNOTARY_VERIFIER_URL                  — BLOCKED: no real verifier built yet (see §7)
TLSNOTARY_VERIFIER_WS_URL               — same
TLSNOTARY_PROXY_WS_URL                  — same
TLSNOTARY_WEBHOOK_TOKEN                 — same (self-generate once a verifier exists)
INTERNET_COURT_API_URL                  — optional interop adapter, not required
INTERNET_COURT_API_KEY                  — optional
```

### On Railway (separately from `.env.local` — needs pasting in per-service)

`praest-api`, `praest-worker`, `praest-bridge` each still need their real secrets pasted in
(the full per-service lists were given earlier in this session) — currently only non-secret
structural config is set on all three.

### On Vercel (`web`/`praest-web` project)

`WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` (must be ≥32 random chars),
`WORKOS_JWKS_URL`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID` — none of these
are set on Vercel yet (only 3 non-secret vars are).

---

## 11. Decisions needed from you / your colleagues

1. **zkSync + Solana deployment**: pick WSL, a Linux/Mac machine, or GitHub Actions as the build
   environment — this machine's Windows toolchain genuinely cannot do it.
2. **TLSNotary**: either point me at a confirmed current server/example (tagged release, doc
   page), or decide this is out of scope for now.
3. **Railway plan**: currently at the free/trial resource limit — needs an upgrade decision
   before adding TLSNotary or any other new service.
4. **Temporal**: still needs the manual memory-limit bump in Railway's dashboard.
5. **Internet Court adapter**: confirm the "reuse `AgentAgreementResolver`, don't deploy a new
   supervision contract" design decision before I build the adapter.
6. **x402 paywall**: decide which real endpoint (if any) gets protected in production.
7. **Secrets**: paste the outstanding secrets into Railway (3 services) and Vercel — nothing
   deploys cleanly until this happens.
