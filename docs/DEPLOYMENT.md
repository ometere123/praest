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
6. Configure Temporal Cloud namespace/API key.
7. Run `npm run seed:routes` after contract deployments; route metadata can be reseeded safely.

## 3. Identity and wallets

### WorkOS
Set client/API/cookie/redirect values. Use `apps/web/proxy.ts` for Next.js 16 AuthKit. Configure organisation roles/permissions and MFA as required.

### Privy custom JWT auth
Create a Privy app and configure its JWT/custom-auth provider against WorkOS issuer/JWKS and the WorkOS subject used by PRAEST. Set `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`.

On authenticated bootstrap PRAEST creates/synchronises the internal user/organisation and EVM+Solana embedded wallets. Customer escrow funding is signed in the browser; PRAEST does not custody those settlement assets.

## 4. GenLayer StudioNet

Fund a dedicated StudioNet submitter, set `GENLAYER_STUDIONET_PRIVATE_KEY` and run:

```bash
npm run genlayer:deploy
```

The script deploys all Intelligent Contracts and writes `deployments/studionet.json`. Populate the resulting addresses into the runtime environment. Do not proceed to cross-chain settlement until actual StudioNet adjudication reaches `FINALIZED` and `DecisionOutbox` can be read reproducibly.

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

Build `apps/probe`, upload the artifact to S3 and apply `infrastructure/terraform/probes`. The Terraform module deploys regional Lambdas and EventBridge schedules. Configure the shared internal token and restrict IAM.

## 9. Railway/Vercel

Suggested Railway services:

1. `praest-api`
2. `praest-worker`
3. `praest-bridge`
4. `praest-relayer`

Deploy `apps/web` to Vercel. Set `PRAEST_API_URL` server-side in the web project and provider values in their respective services.

## 10. Commercial/integration providers

Configure Stripe test products/prices/meter event, signed webhook endpoint, Resend verified sender, Sentry/OTel, x402 facilitator, TLSNotary verifier and Internet Court adapter credentials where available.

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
