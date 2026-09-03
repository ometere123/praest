# PRAEST environment variable matrix

Authoritative reference for every variable in `.env.example`. Categories match the architecture-pass request:

- **A** — public constants (safe to know, same for everyone on this network)
- **B** — values PRAEST/you generate yourselves (random secrets, throwaway keys)
- **C** — values that come from a provider's dashboard/account
- **D** — values produced by deploying something (Railway URLs, contract addresses)
- **E** — GenLayer contract deployment outputs
- **F** — optional/dormant while a feature flag is off

"Testnet value" is what to actually put in `.env.local` right now. "Production difference" describes what changes for a real deployment — it does not mean go live now.

## Core

| Variable | Service | Required? | Secret? | Cat | When required | Where you get it | Example | Testnet value | Production difference |
|---|---|---|---|---|---|---|---|---|---|
| `NODE_ENV` | all | recommended | no | A | always | — | `production` | `development` | `production` on Railway/Vercel |
| `PRAEST_ENV` | api | recommended | no | A | always | — | `production` | `development` | `production` |
| `PRAEST_RELEASE` | api | no | no | B | telemetry | your CI/deploy | git SHA | `local` | deployed commit SHA |
| `PRAEST_APP_URL` | api, web | yes | no | D | always | Vercel project URL | `https://praest.vercel.app` | `http://localhost:3000` | your real domain |
| `PRAEST_API_URL` | api, web, worker, bridge, probe | yes | no | D | always | Railway API service URL | `https://praest-api.up.railway.app` | `http://localhost:4000` | Railway URL |
| `PRAEST_INTERNAL_TOKEN` | api, worker, probe | yes | **yes** | B | always | `openssl rand -hex 32` | 64 hex chars | generate once | generate once |
| `PRAEST_DATA_ENCRYPTION_KEY_BASE64` | api | yes | **yes** | B | always | `openssl rand -base64 32` | base64 32 bytes | generate once | generate once |
| `DATABASE_URL` | api, worker, bridge, scripts | yes | **yes** | C | always | Supabase/Postgres dashboard | `postgresql://...` | your Postgres | production DB |

## Identity (WorkOS + Privy)

| Variable | Required? | Secret? | Cat | Where you get it |
|---|---|---|---|---|
| `WORKOS_CLIENT_ID` / `WORKOS_API_KEY` / `WORKOS_JWKS_URL` | yes | key: yes | C | workos.com dashboard, AuthKit app |
| `WORKOS_COOKIE_PASSWORD` | yes | **yes** | B | generate 32+ random chars yourself |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | yes | no | D | your app's `/callback` URL |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` / `NEXT_PUBLIC_PRIVY_APP_ID` | yes | secret: yes | C | privy.io dashboard |

Unchanged this pass — not audited further here.

## B. Human billing — Stripe (**category F: optional/dormant**)

`STRIPE_ENABLED=false` is the default. Humans use PRAEST free; nothing below is required unless you set it to `true`.

| Variable | Required? | Secret? | When required | Where you get it | Testnet value |
|---|---|---|---|---|---|
| `STRIPE_ENABLED` | no | no | — | you set it | `false` |
| `STRIPE_SECRET_KEY` | only if enabled | **yes** | `STRIPE_ENABLED=true` | Stripe dashboard, **Test mode**, `sk_test_...` | blank |
| `STRIPE_WEBHOOK_SECRET` | only if enabled | **yes** | same | `stripe listen` or a Test-mode endpoint | blank |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` | only if enabled | no | same | Test-mode Prices you create | blank |
| `STRIPE_METER_EVENT_NAME` | only if enabled | no | same | a Test-mode Billing Meter's event name | `praest_usage` |

## C. x402 (active machine-payment rail — **category A, mostly public constants**)

| Variable | Cat | Required? | Secret? | Value |
|---|---|---|---|---|
| `X402_ENABLED` | B (your choice) | no | no | `true` |
| `X402_NETWORK` | A | no | no | `eip155:84532` |
| `X402_FACILITATOR_URL` | A | yes | no | `https://x402.org/facilitator` |
| `X402_FACILITATOR_TOKEN` | C | no | maybe | blank unless the facilitator requires one |
| `BASE_SEPOLIA_RPC_URL` | A | yes | no | `https://sepolia.base.org` |
| `BASE_SEPOLIA_CHAIN_ID` | A | yes | no | `84532` |
| `X402_USDC_ADDRESS` | A | yes | no | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| `X402_USDC_DECIMALS` | A | yes | no | `6` |
| `X402_PAY_TO_EVM` | D | yes | no | a Base Sepolia address **you control** — get one from any EVM wallet (MetaMask etc.), no signup |
| `X402_PAYER_PRIVATE_KEY` | B | only if PRAEST buys from another x402 service | **yes** | throwaway testnet key only — not needed for PRAEST as a seller |

## D. Temporal (self-hosted, already implemented — see `packages/config/src/temporal.ts`)

| Variable | Cat | Required? | Secret? | Testnet value |
|---|---|---|---|---|
| `TEMPORAL_ADDRESS` | D | yes | no | `localhost:7233` locally; Railway private address once deployed |
| `TEMPORAL_NAMESPACE` | B | yes | no | `default` |
| `TEMPORAL_TASK_QUEUE` | B | yes | no | `praest` |
| `TEMPORAL_TLS` | B | no | no | `false` (self-hosted); irrelevant for Cloud (auto-on) |
| `TEMPORAL_API_KEY` | C | no | **yes** | blank (self-hosted); Cloud API key if you switch later |

## E. Regional probes — Globalping (already implemented)

| Variable | Cat | Required? | Secret? | Testnet value |
|---|---|---|---|---|
| `PROBE_PROVIDER` | B | no | no | `globalping` |
| `GLOBALPING_PROBE_LOCATIONS` | B | no | no | `US,Germany,Singapore,Brazil,Japan` |
| `GLOBALPING_MEASUREMENT_TYPE` | B | no | no | `http` |
| `GLOBALPING_API_TOKEN` | C | **no — optional** | **yes** | blank; get one at dash.globalping.io only if you hit rate limits |

## F. TLSNotary (config only — no real verifier deployed yet)

| Variable | Cat | Required? | Secret? | Note |
|---|---|---|---|---|
| `TLSNOTARY_ENABLED` | B | no | no | `false` until a real verifier exists |
| `TLSNOTARY_VERIFIER_URL` / `_VERIFIER_WS_URL` / `_PROXY_WS_URL` | D | only once deployed | no | produced by deploying the verifier (section 6 of the report) |
| `TLSNOTARY_TIMEOUT_MS` | B | no | no | `60000` |
| `TLSNOTARY_WEBHOOK_TOKEN` | B | only once deployed | **yes** | `openssl rand -hex 32` — PRAEST-generated, not issued by TLSNotary |

## G. Internet Court (optional adapter, already compliant)

| Variable | Cat | Required? | Secret? |
|---|---|---|---|
| `INTERNET_COURT_API_URL` | C | no | no |
| `INTERNET_COURT_API_KEY` | C | no | **yes** |

Both blank means `InternetCourtService.exportCase()` just returns the prepared payload — no external call, no invented credentials.

## H. GenLayer (adjudication — StudioNet, unchanged)

| Variable | Cat | Required? | Secret? | Note |
|---|---|---|---|---|
| `GENLAYER_RPC_URL` / `GENLAYER_CHAIN_ID` | A | documentation only | no | **not read by application code** — `genlayer-js`'s `studionet` chain preset supplies these at runtime. Kept for reference/tooling only. |
| `GENLAYER_STUDIONET_PRIVATE_KEY` (or legacy `GENLAYER_PRIVATE_KEY`) | B | yes | **yes** | signs StudioNet transactions; PRAEST has no unlocked-CLI alternative today |
| `GENLAYER_DECISION_OUTBOX_ADDRESS` | E | yes | no | output of `npm run genlayer:deploy` |
| `GENLAYER_SERVICE_ASSURANCE_RESOLVER_ADDRESS` / `_AGENT_AGREEMENT_RESOLVER_ADDRESS` / `_EVENT_RESOLVER_ADDRESS` / `_DISPUTE_RESOLVER_ADDRESS` | E | yes | no | same deploy output — these 4 are the ones `resolverAddress()` actually reads |
| `GENLAYER_AGREEMENT_REGISTRY_ADDRESS` / `_EVIDENCE_ASSESSOR_ADDRESS` / `_SETTLEMENT_ENTITLEMENT_ADDRESS` / `_LIABILITY_RESOLVER_ADDRESS` | E | not yet wired | no | deployed contracts exist (`AgreementRegistry.py` etc.) but nothing in `apps/api` reads these 4 addresses yet — a real gap, not fixed this pass (see report) |

**Note on naming**: the real contracts in this repo are `AgreementRegistry`, `EvidenceAssessor`, `ServiceAssuranceResolver`, `DisputeResolver`, `SettlementEntitlement`, `AgentAgreementResolver`, `LiabilityResolver`, `EventResolver`, `DecisionOutbox` (`contracts/genlayer/*.py`, `docs/ARCHITECTURE.md`). `PRAESTAgreementRegistry`/`PRAESTServiceAdjudicator` are not what exists in this repository — env vars were not renamed to match a name that isn't real.

## I. Cross-chain bridge, evidence, notifications, billing infra

Unchanged this pass except Brevo:

| Variable | Cat | Required? | Secret? |
|---|---|---|---|
| `BREVO_API_KEY` | C | **no — optional**, no-op if unset | **yes** |
| `BREVO_FROM_EMAIL` | C | only if `BREVO_API_KEY` set | no | *(not fabricated — you provide it)* |
| `BREVO_FROM_NAME` | B | no | no |
| `R2_*`, `CLICKHOUSE_*`, `UPSTASH_*`, `EVM_DEPLOYER_PRIVATE_KEY`, `BRIDGE_EVM_PRIVATE_KEY`, `ZKSYNC_SEPOLIA_RPC_URL`, `PRAEST_STUDIO_GATEWAY_ADDRESS`/`ZKSYNC_STUDIO_DECISION_GATEWAY_ADDRESS`, destination `*_SEPOLIA_RPC_URL`/`POLYGON_AMOY_RPC_URL`, Solana `SOLANA_*`/`PRAEST_SOLANA_*` | mixed | see `.env.example` comments | mixed | unchanged — see prior session's env audit |

## Disappeared this pass

- `RESEND_API_KEY`, `RESEND_FROM` — replaced by `BREVO_API_KEY`/`BREVO_FROM_EMAIL`/`BREVO_FROM_NAME`.

## New this pass

`STRIPE_ENABLED`, `BREVO_API_KEY`/`BREVO_FROM_EMAIL`/`BREVO_FROM_NAME`, `X402_ENABLED`/`X402_NETWORK`/`BASE_SEPOLIA_CHAIN_ID`/`X402_USDC_ADDRESS`/`X402_USDC_DECIMALS`/`X402_PAYER_PRIVATE_KEY`, `TLSNOTARY_ENABLED`/`TLSNOTARY_VERIFIER_WS_URL`/`TLSNOTARY_PROXY_WS_URL`/`TLSNOTARY_TIMEOUT_MS`. (`TEMPORAL_*`/`GLOBALPING_*`/`PROBE_PROVIDER` were introduced in the prior architecture-pass session, not this one.)
