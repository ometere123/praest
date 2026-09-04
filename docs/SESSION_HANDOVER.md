# Session Handover — 2026-09-04

Paused here at the user's request. Resume when told to.

## What's live right now

| Piece | Status | URL / ref |
|---|---|---|
| GitHub | pushed, clean | `github.com/ometere123/praest`, `main`, latest commit `02b990e` |
| GenLayer StudioNet | 9/9 contracts deployed | `deployments/studionet.json` |
| Railway project | `praest` | `railway.com/project/72ef4f3d-2a24-4c51-872a-57959cffc0bd` |
| `praest-api` | deployed, needs secrets to boot cleanly | `https://praest-api-production.up.railway.app` |
| `praest-worker` | deployed, needs `PRAEST_INTERNAL_TOKEN` | (internal only) |
| `praest-bridge` | deployed, needs secrets | (internal only) |
| `temporal-server` + `temporal-postgres` | CRASHED (OOM) | needs a memory-limit bump in Railway dashboard |
| Vercel `web` | deployed, needs WorkOS/Privy secrets | `https://web-henna-nu-67.vercel.app` |
| Supabase pg_cron | scheduled, active | `praest-webhook-sweep`, `praest-monitor-sweep` (every 5 min) |

## Exact remaining work (next session)

1. **User fills in secrets** — see the three "Variables to add" lists already given in chat for `praest-api`, `praest-worker`, `praest-bridge` (Railway) and `web` (Vercel: `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` ≥32 chars, `WORKOS_JWKS_URL`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID`). Also: **paste the 9 `GENLAYER_*_ADDRESS` values into `.env.local`** — confirmed still blank as of last `doctor.mjs` run despite being generated this session (see `deployments/studionet.json` for the authoritative addresses).
2. **Bump `temporal-server`'s Railway memory limit** (Settings → Resources, ≥2GB) — root cause confirmed (OOM), not a config issue.
3. **Redeploy `praest-api`/`worker`/`bridge`** once secrets are filled (`railway` auto-redeploys on variable save), and redeploy `web` on Vercel (`vercel deploy --prod --yes` from repo root) once WorkOS/Privy vars are set — then re-check the site actually renders (last check: 500, `WORKOS_COOKIE_PASSWORD` missing, exactly as expected).
4. **Deploy EVM destination contracts** (`npm run evm:deploy` — needs funded deployer key per chain): zkSync Sepolia (`StudioDecisionGateway`), then `PraestSettlementReceiver`/`PraestEscrow` pairs on Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Polygon Amoy, Scroll Sepolia, Linea Sepolia. **Real, external, funds-required action — needs your explicit go-ahead before I run it**, same as the GenLayer deploy did.
5. **Deploy Solana Testnet program** (`npm run solana:deploy`) — blocked locally: Solana/Agave CLI isn't installed on this Windows machine (needs admin elevation this session doesn't have), and `cargo build-sbf` needs a working Rust+MSVC or Linux toolchain (this machine only has Git's unrelated `link.exe`, no real MSVC). The Solana escrow source fix from earlier (`contracts/solana/src/lib.rs`) is also still **not compiler-verified** for the same reason. Options: do this from a machine/CI with a real toolchain, or accept doing it via GitHub Actions' Linux runner (already proven to work earlier this session for a different Solana bug fix).
6. **Real Hyperlane ISM/route configuration** — currently using default/mock ISM in tests; production path needs a real configured ISM per destination, done as part of steps 4–5's deployment scripts.
7. **One full cross-chain proof run** (Base Sepolia first, then Solana Testnet) once 4–6 are done: fund an escrow → trigger a dispute → StudioNet adjudication → finalize → `DecisionOutbox` → Studio relay → Hyperlane dispatch → destination receiver execution → escrow balance change → receipt. Collect every tx hash/address along the way per the original report format the user asked for.

## Hyperlane version-drift finding (user asked to check)

Checked `github.com/hyperlane-xyz/hyperlane-monorepo` releases. The "new release two days ago" (2026-09-02) was **`@hyperlane-xyz/{widgets,utils,tron-sdk,starknet-sdk}@44.0.2`** — a patch bump that pins `@hyperlane-xyz/registry` to **26.1.0**.

PRAEST currently pins (`apps/relayer/package.json`):
```
@hyperlane-xyz/cli@42.0.0
@hyperlane-xyz/relayer@2.0.0
@hyperlane-xyz/registry@25.6.0
```

So PRAEST is 2 major CLI versions and 1 registry minor behind. **Not urgent, not a blocker** — v44.x's actual content is a Starknet.js v7→v8.9 upgrade and Node 22 minimum, irrelevant to PRAEST's EVM/Solana/zkSync routes. The registry bump (25.6.0→26.1.0) could matter because that's where Hyperlane's canonical Mailbox/ISM addresses per chain live — worth deciding whether to bump the registry pin **before** running the real EVM/Solana deployments in step 4–6 above, so the deployment scripts read current canonical addresses rather than slightly-stale ones. This matches the reviewer's earlier advice: don't blindly chase every registry release, but do sync once, deliberately, right before the real deployment pass — not mid-session, not continuously.

**Recommendation for next session**: bump `@hyperlane-xyz/registry` to `26.1.0` (and re-run `npm run hyperlane:smoke` to confirm nothing broke) as the very first step before touching steps 4–6, then record the exact registry commit/version pinned in the route registry per the reviewer's `hyperlane:verify-registry` suggestion (not yet built — a real gap, could be built alongside the registry bump).

## Things only the user can do (unchanged core list + this session's additions)

1. Fill in the Railway/Vercel secret lists above.
2. Paste the 9 GenLayer addresses into `.env.local`.
3. Raise `temporal-server`'s Railway memory limit.
4. Verify a Brevo sender/domain.
5. Decide on a real TLSNotary verifier build (still genuinely unbuilt).
6. Fund testnet wallets for the EVM/Solana deployments in step 4–5 above, and give explicit go-ahead before those deploys run (they spend real, if testnet, funds and create real on-chain state).
7. Decide whether/which real endpoint should be x402-paywalled in production (`example-resource` stays a demo either way).
8. Decide on the Hyperlane registry version bump above.

## Everything fixed/built this session (for full detail, `git log f5d259a..02b990e`)

x402 self-attestation removed; TLSNotary self-verification closed; WorkOS bootstrap tenant-escalation fixed; Globalping credential leak blocked; GenLayer `finalize()` lifecycle bug fixed; all 9 GenLayer contracts deployed, 4 previously-orphaned ones wired in (`AgreementRegistry`, `EvidenceAssessor`, `SettlementEntitlement`, `LiabilityResolver`); `LiabilityResolver`/`EventResolver`/`AgentAgreementResolver` rewritten from copy-pasted SLA prompts into genuinely distinct judgments; EVM escrow + Solana escrow premature-refund fixed; Hyperlane gateway dispatch idempotency added; x402 seller-side 402 challenge/verify/settle flow implemented (demo endpoint); Dockerfiles fixed to build workspace deps via turbo; `next.config.ts` fixed for Vercel compatibility (`output:"standalone"` removed); cron-triggerable sweep endpoints added as a Temporal-optional path for monitoring/webhooks; Supabase `pg_cron`/`pg_net` wired to call them; Railway services created for `api`/`worker`/`bridge`; Vercel `web` deployed to production.
