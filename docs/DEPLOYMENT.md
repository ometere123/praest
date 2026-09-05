# Deployment and Live Proof

This document is the credential-bound final mile. The source code is built to support the full current scope; live providers and funded testnet wallets are required to prove it.

## 1. Local prerequisites

Recommended local environment: Node 22+, npm 10+, Python 3.12+, Git, Foundry, Rust/Cargo, Solana/Agave CLI, GenLayer CLI, Terraform, Docker.

```bash
cp .env.example .env.local
npm install
npm run doctor
npm run verify:repo
```

Fill every required secret in `.env.local`; never commit it.

## 2. Data services

1. Create Supabase/PostgreSQL and set `DATABASE_URL`.
2. Run `npm run db:migrate`.
3. Configure Upstash Redis.
4. Configure ClickHouse and execute `infrastructure/clickhouse/init.sql`.
5. Configure R2 bucket/credentials and evidence retention.
6. Configure Temporal - self-hosted is the default/preferred path (`TEMPORAL_ADDRESS`/`TEMPORAL_NAMESPACE`/`TEMPORAL_TASK_QUEUE`, no TLS/API key required); Temporal Cloud (`TEMPORAL_API_KEY`, auto-enables TLS) remains available as an alternative, not required. A Railway project (`praest`, `railway.com/project/72ef4f3d-2a24-4c51-872a-57959cffc0bd`) was created 2026-09-04 with `temporal-postgres` (healthy) and `temporal-server` (`temporalio/auto-setup:1.24.2`) services; the server currently OOMs on startup at the service's default memory allocation - increase its memory limit (Railway dashboard → Settings → Resources) before relying on it.
7. Run `npm run seed:routes` after contract deployments; route metadata can be reseeded safely.

## 3. Identity and wallets

### WorkOS
Set client/API/cookie/redirect values. Use `apps/web/proxy.ts` for Next.js 16 AuthKit. Configure organisation roles/permissions and MFA as required.

### Privy custom JWT auth
Create a Privy app and configure its JWT/custom-auth provider against WorkOS issuer/JWKS and the WorkOS subject used by PRAEST. Set `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`.

On authenticated bootstrap PRAEST creates/synchronises the internal user/organisation and EVM+Solana embedded wallets. Customer escrow funding is signed in the browser; PRAEST does not custody those settlement assets.

## 4. GenLayer StudioNet

Fund a dedicated submitter, set `GENLAYER_STUDIONET_PRIVATE_KEY`, and set `GENLAYER_NETWORK`
(defaults to `studioDevnet`, chain `61997`, `https://studio-dev.genlayer.com/api` - the current
consensus v0.6 migration/test network; set to `studionet` for the stable network, chain `61999`).
See `docs/GENLAYER_V06_MIGRATION.md`. Then run:

```bash
npm run genlayer:deploy
```

The script deploys all Intelligent Contracts and writes `deployments/<GENLAYER_NETWORK>.json` (merging into the file per-contract, so a mid-batch failure never loses an already-succeeded, fee-paid deployment). **All 9 contracts were deployed to `studioDevnet` on 2026-09-05** with the corrected consensus v0.6 runner pin (`deployments/studioDevnet.json`); the earlier `deployments/studionet.json` from 2026-09-04 is for the old stable network and is not used unless `GENLAYER_NETWORK=studionet`. If the receipt's contract address isn't captured at deploy time, run `npx tsx scripts/resolve-genlayer-addresses.ts` afterward to backfill it. Populate the resulting addresses into the runtime environment - `AgreementRegistry`, `EvidenceAssessor`, `SettlementEntitlement`, and `LiabilityResolver` are now actually read by application code (agreement activation/adjudication/finalization/resolver routing), not just deployed placeholders. All 6 contracts using `gl.vm.run_nondet_default` have live-proven `FINALIZED`/`FINISHED_WITH_RETURN` semantic calls on `studioDevnet` - see `docs/GENLAYER_V06_MIGRATION.md` for the full evidence record.

## 5. EVM destination contracts

Install Foundry and fund deployers on zkSync Sepolia plus the configured EVM destinations. Install forge-std if the script has not already done so.

```bash
npm run evm:deploy
```

The deployment script creates the Studio decision gateway on zkSync Sepolia and receiver/escrow pairs on each enabled EVM route. Each destination receiver must use a real Hyperlane ISM (typically the chain Mailbox default or an explicitly configured stronger ISM), not the test mock.

## 6. Solana Testnet

Install Rust/Cargo and Solana/Agave tooling, fund the deployment keypair with Testnet SOL, then:

```bash
npm run solana:deploy
```

The program is a Hyperlane Sealevel MessageRecipient with per-escrow PDA state. Configure its owner, Hyperlane Testnet Mailbox/ISM, local domain, trusted zkSync Sepolia domain and trusted PRAEST gateway sender. Confirm `HandleAccountMetas` and `handle` account ordering against the deployed program using the live relayer.

Solana Testnet does not claim Circle test USDC. Use the explicitly labelled PRAEST test SPL settlement mint for proof.

## 7. Hyperlane

Run:

```bash
npm run hyperlane:smoke
```

This checks configured Mailboxes/domains. Configure a real ISM/validator set and relayer. The current app relayer is transport only; security lives in the destination ISM plus PRAEST recipient checks.

For each destination, collect a proof bundle containing:

- StudioNet adjudication tx ID
- decision ID/hash and final status
- DecisionOutbox instruction/payload hash
- zkSync Sepolia gateway dispatch transaction
- Hyperlane message ID
- relayer/destination process transaction
- Mailbox delivered state
- PRAEST recipient/program execution state
- escrow balances/state before and after
- PRAEST receipt hash

## 8. Multi-region probes

Default provider is Globalping (`PROBE_PROVIDER=globalping`), which needs no AWS account: build `apps/probe` and run it (`npm run start -w @praest/probe`, or `node dist/index.js`) on any schedule - Railway's Cron Job feature, plain OS cron, or a small always-on service that loops. It fans out across `GLOBALPING_PROBE_LOCATIONS` itself in one process; no per-region deployment is needed. Set `PRAEST_API_URL`/`PRAEST_INTERNAL_TOKEN` and, optionally, `GLOBALPING_API_TOKEN` for a higher rate-limit allowance.

Alternative: `PROBE_PROVIDER=native` runs the original direct DNS/TCP/TLS/HTTP prober in-process (same command), still without AWS - useful if Globalping is unreachable from your network or you want a single self-hosted vantage point instead of Globalping's network.

The AWS Lambda + EventBridge regional deployment (`infrastructure/terraform/probes`) has been retired along with the Lambda-shaped entrypoint it invoked - `apps/probe` no longer exports an AWS Lambda `handler`, since the coordinator now fans out across all configured locations itself in a single run rather than one region per Lambda deployment. It remains available in git history if AWS deployment is ever wanted again; re-adding it would mean a new thin Lambda entrypoint calling the same `runOnce()`/provider code, not a rewrite.

## 9. Railway/Vercel

Suggested Railway services:

1. `praest-api`
2. `praest-worker`
3. `praest-bridge`
4. `praest-relayer`

Deploy `apps/web` to Vercel. Set `PRAEST_API_URL` server-side in the web project and provider values in their respective services.

## 10. Commercial/integration providers

Stripe is optional (`STRIPE_ENABLED=false` by default - humans use PRAEST free without it); if enabling it, configure test products/prices/meter event and a signed webhook endpoint. Configure a Brevo verified sender (`BREVO_FROM_EMAIL`, once verified in the Brevo dashboard - do not fabricate this value), Sentry/OTel, the x402 facilitator, a TLSNotary verifier (not yet built - see `docs/IMPLEMENTATION_STATUS.md`) and Internet Court adapter credentials where available.

## 11. Release acceptance

Do not mark the release live until:

```bash
npm run verify:repo
npm run typecheck
npm test
forge test
cargo test --manifest-path contracts/solana/Cargo.toml
```

and the credential-bound proof matrix in `docs/IMPLEMENTATION_STATUS.md` has been updated with real addresses/transaction IDs.
