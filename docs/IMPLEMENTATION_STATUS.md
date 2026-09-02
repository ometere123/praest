# Implementation Status

Status vocabulary:

- **IMPLEMENTED** — source exists for the frozen capability.
- **STATIC VERIFIED** — repository/static syntax checks have run successfully in the assembly environment.
- **NATIVE PROOF REQUIRED** — implementation exists but the required native compiler/toolchain was unavailable in the assembly environment.
- **LIVE PROOF REQUIRED** — requires user credentials, provider accounts, funded testnet keys or deployed addresses.

| Subsystem | Source status | Verification status |
| --- | --- | --- |
| Product / Control / Developer / Explorer route surfaces | IMPLEMENTED | STATIC VERIFIED route manifest (165 URLs) |
| Next.js auth/API relay | IMPLEMENTED | STATIC VERIFIED; WorkOS live proof required |
| WorkOS → Privy custom JWT + embedded wallets | IMPLEMENTED | LIVE PROOF REQUIRED |
| NestJS/Fastify API | IMPLEMENTED | TS syntax verified; dependency-resolved typecheck required |
| PostgreSQL/Drizzle domain model + migration | IMPLEMENTED | migration/live Postgres proof required |
| Upstash limits/cache | IMPLEMENTED | LIVE PROOF REQUIRED |
| Temporal workflows | IMPLEMENTED | LIVE PROOF REQUIRED |
| ClickHouse measurements | IMPLEMENTED | init/live ingestion proof required |
| R2 evidence storage | IMPLEMENTED | LIVE PROOF REQUIRED |
| AWS regional probe | IMPLEMENTED | Terraform/live regions proof required |
| monitoring DNS/TCP/TLS/TTFB/assertions/SSRF controls | IMPLEMENTED | TS syntax verified; live network matrix required |
| evidence bundles/provenance/hashes | IMPLEMENTED | local/API proof required |
| TLSNotary integration | IMPLEMENTED adapter | verifier/provider LIVE PROOF REQUIRED |
| GenLayer Intelligent Contracts | IMPLEMENTED | Python syntax verified; GenVM lint/Direct Mode/StudioNet LIVE PROOF REQUIRED |
| GenLayer decided/appeal/finality lifecycle | IMPLEMENTED | StudioNet LIVE PROOF REQUIRED |
| deterministic settlement engine | IMPLEMENTED | TS syntax/static review; DB integration proof required |
| Studio DecisionOutbox relay | IMPLEMENTED | StudioNet + zkSync LIVE PROOF REQUIRED |
| EVM gateway/receiver/escrow | IMPLEMENTED | NATIVE PROOF REQUIRED (Foundry unavailable here) |
| Hyperlane real-ISM design / route config | IMPLEMENTED | LIVE PROOF REQUIRED |
| Solana Testnet recipient/escrow | IMPLEMENTED | NATIVE PROOF REQUIRED (Cargo/Solana CLI unavailable here) |
| EVM/Solana non-custodial escrow funding + independent confirmation | IMPLEMENTED | wallet/testnet LIVE PROOF REQUIRED |
| destination reconciliation/receipts | IMPLEMENTED | cross-chain LIVE PROOF REQUIRED |
| x402 V2 facilitator lifecycle | IMPLEMENTED | facilitator/payment LIVE PROOF REQUIRED |
| agents/tasks/execution/liability data paths | IMPLEMENTED | end-to-end live proof required |
| event/prediction resolution | IMPLEMENTED | StudioNet/live proof required |
| Internet Court interoperability adapter | IMPLEMENTED | provider LIVE PROOF REQUIRED |
| billing/meter events/webhooks | IMPLEMENTED | Stripe LIVE PROOF REQUIRED |
| Resend/webhook notifications | IMPLEMENTED | LIVE PROOF REQUIRED |
| TypeScript SDK | IMPLEMENTED | dependency-resolved build required |
| Python SDK | IMPLEMENTED | local import/API test required |
| CLI | IMPLEMENTED | dependency-resolved build required |
| MCP v2 server | IMPLEMENTED | dependency-resolved build/client proof required |
| CI/security workflows | IMPLEMENTED | GitHub Actions proof required after push |

## Assembly-environment limitations

- `npm install` was attempted previously but did not complete reliably in the provided environment; `node_modules` cannot be assumed.
- Foundry (`forge`) is not installed.
- Rust/Cargo and Solana CLI are not installed.
- Provider secrets and funded testnet wallets are intentionally not available.

These are verification limitations, not deferred product scope. `scripts/doctor.mjs` exposes them explicitly.
