# Implementation Status

Status vocabulary:

- **IMPLEMENTED** — source exists for the frozen capability.
- **STATIC VERIFIED** — repository/static syntax checks have run successfully.
- **DEPENDENCY-RESOLVED VERIFIED** — real toolchain, real `node_modules`/crates/pip packages: typecheck, build, unit tests and/or the relevant linter actually ran and passed against this exact source.
- **NATIVE PROOF REQUIRED** — implementation exists but the required native compiler/toolchain was unavailable in the current session's environment.
- **LIVE PROOF REQUIRED** — requires user credentials, provider accounts, funded testnet keys or deployed addresses.

This session (2026-09-02/03) did what the previous assembly environment explicitly could not: ran a real `npm install`, a full dependency-resolved `typecheck`/`test`/`build` across all 16 workspace packages, `forge build`/`forge test` for the EVM contracts, `gltest`/`genvm-lint` for the GenLayer Intelligent Contracts, and pushed to a real `github.com/ometere123/praest` with GitHub Actions actually executing on Linux runners. That surfaced and fixed a number of real bugs that had never been caught because nothing had ever actually run before (see the git log for full detail on each).

| Subsystem | Source status | Verification status |
| --- | --- | --- |
| Product / Control / Developer / Explorer route surfaces | IMPLEMENTED | STATIC VERIFIED route manifest (165 URLs). Frontend redesigned this session (design system, component library, marketing site) and visually verified in a real browser (light/dark theme, desktop/mobile) for the public/unauthenticated surfaces; authenticated Product/Control/Developer/Explorer views require real WorkOS sign-in to render — LIVE PROOF REQUIRED for those |
| Next.js auth/API relay | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED (typecheck + `next build`). Three real config bugs found and fixed this session: `.env.example` named the wrong WorkOS redirect-URI variable, the AuthKit middleware's route matcher was silently blocking `/public` static assets, and Next 16 needs `moduleResolution: bundler` (never previously exercised). Real WorkOS sign-in still LIVE PROOF REQUIRED |
| WorkOS → Privy custom JWT + embedded wallets | IMPLEMENTED | LIVE PROOF REQUIRED |
| NestJS/Fastify API | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED (typecheck + build). Real bugs fixed: missing `Inject` import, a nonexistent `TooManyRequestsException` export, `noUncheckedIndexedAccess` violations, and a real TLS-verification-disabled bug in the Postgres connection (see security fix commit) |
| PostgreSQL/Drizzle domain model + migration | IMPLEMENTED | typecheck/build pass; migration/live Postgres proof required |
| Upstash limits/cache | IMPLEMENTED | LIVE PROOF REQUIRED |
| Temporal workflows | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED (typecheck + build). Real bug fixed: `@temporalio/worker` has no `Connection` export — the worker-side connection type is `NativeConnection`. Live Temporal Cloud proof still required |
| ClickHouse measurements | IMPLEMENTED | init/live ingestion proof required |
| R2 evidence storage | IMPLEMENTED | LIVE PROOF REQUIRED |
| Regional probes (Globalping default, `native` provider available, AWS Lambda retired) | IMPLEMENTED | typecheck/build/test pass; live Globalping measurement proof required |
| monitoring DNS/TCP/TLS/TTFB/assertions/SSRF controls | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED; live network matrix required |
| evidence bundles/provenance/hashes | IMPLEMENTED | local/API proof required |
| TLSNotary integration | IMPLEMENTED adapter | verifier/provider LIVE PROOF REQUIRED |
| GenLayer Intelligent Contracts | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED: `genvm-lint check` (lint + SDK-based ABI/semantic validation) passes for all 9 Intelligent Contracts; `gltest` runs the GenVM-runner-pin test successfully against the (fixed) `gltest.config.yaml`. A newer GenVM runner hash is available upstream (informational `I200` warning only) — deliberately not bumped without a product decision. StudioNet deployment/live transaction proof still required |
| GenLayer decided/appeal/finality lifecycle | IMPLEMENTED | StudioNet LIVE PROOF REQUIRED |
| deterministic settlement engine | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED (typecheck/build); DB integration proof required |
| Studio DecisionOutbox relay | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED (typecheck/build); StudioNet + zkSync LIVE PROOF REQUIRED |
| EVM gateway/receiver/escrow | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED: `forge build` + `forge test -vvv` pass (9/9) both locally and in CI. Two real bugs fixed: a brace-less-if syntax error in `StudioDecisionGateway.sol` that current solc rejects, and a "stack too deep" in the settlement test requiring `via_ir = true` |
| Hyperlane real-ISM design / route config | IMPLEMENTED | `scripts/hyperlane-smoke.ts` typechecks/builds; live route/ISM proof required |
| Solana Testnet recipient/escrow | IMPLEMENTED | A real type-mismatch bug (`H256` vs `[u8;32]` in the trusted-sender check) was found and fixed via GitHub Actions' Linux runner, which — unlike this session's Windows machine — has a working linker and reached actual compilation. NATIVE PROOF REQUIRED locally: this session's Windows environment has Rust/Cargo installed but lacks MSVC Build Tools (needs admin elevation not available) and the Solana/Agave CLI install also requires admin elevation; `cargo build-sbf` and live deployment remain undone |
| EVM/Solana non-custodial escrow funding + independent confirmation | IMPLEMENTED | `EscrowFundingAction.tsx` typechecks/builds; wallet/testnet LIVE PROOF REQUIRED |
| destination reconciliation/receipts | IMPLEMENTED | cross-chain LIVE PROOF REQUIRED |
| x402 V2 facilitator lifecycle | IMPLEMENTED | facilitator/payment LIVE PROOF REQUIRED |
| agents/tasks/execution/liability data paths | IMPLEMENTED | end-to-end live proof required |
| event/prediction resolution | IMPLEMENTED | StudioNet/live proof required |
| Internet Court interoperability adapter | IMPLEMENTED | provider LIVE PROOF REQUIRED |
| billing/meter events/webhooks | IMPLEMENTED | Stripe LIVE PROOF REQUIRED |
| Resend/webhook notifications | IMPLEMENTED | LIVE PROOF REQUIRED |
| TypeScript SDK | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED (typecheck + build) |
| Python SDK | IMPLEMENTED | local import/API test required |
| CLI | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED (typecheck + build; required the turbo task-graph fix below to resolve `@praest/sdk`'s types) |
| MCP v2 server | IMPLEMENTED | DEPENDENCY-RESOLVED VERIFIED (typecheck + build). Real bug fixed: `serveStdio()` returns a synchronous handle, not a Promise |
| CI/security workflows | IMPLEMENTED | Pushed to `github.com/ometere123/praest`; GitHub Actions now actually execute (previously never proven). `CI` and the `semgrep`/`gitleaks`/`codeql` jobs of `Security` are green. `Security`'s `trivy` job is a known, deliberate red: real HIGH/CRITICAL vulnerabilities in `@privy-io/react-auth`'s and `@hyperlane-xyz/relayer`'s own transitive dependencies, not fixable without a breaking downgrade — see git log |

## Environment limitations (this session, Windows)

- `npm install`, `forge build`/`forge test`, and `gltest`/`genvm-lint` all work reliably now.
- Rust/Cargo installed via rustup, but linking requires MSVC Build Tools, which requires admin elevation this session did not have. `cargo check`/`cargo build-sbf` for `contracts/solana` are blocked locally; GitHub Actions' Linux runner does not have this limitation and is the actual source of the Solana bug fix above.
- Solana/Agave CLI install also requires admin elevation; not installed.
- Provider secrets and funded testnet wallets are intentionally not available.

These are verification limitations, not deferred product scope. `scripts/doctor.mjs` exposes them explicitly.
