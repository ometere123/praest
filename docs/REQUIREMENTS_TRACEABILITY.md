# Requirements Traceability

| Requirement | Primary implementation |
| --- | --- |
| customer product | `apps/web`, Product entries in route manifest |
| control plane | `apps/web`, Control entries + protected API modules |
| developer platform | `apps/api`, SDKs, CLI, MCP, x402 |
| service registry | database `services`, domain/resource controllers |
| versioned agreements / party acceptance | `domains.ts`, agreement tables |
| monitoring | `monitoring.ts`, `safe-fetch.ts`, `apps/probe` |
| incident state | incidents table/resources/workflows |
| evidence/provenance | `evidence.ts`, R2 integration, evidence tables |
| GenLayer adjudication | `contracts/genlayer/*`, `genlayer.ts`, `lifecycle.ts` |
| appeals/finality | `genlayer.ts`, `lifecycle.ts`, adjudication/appeal tables |
| deterministic remedy execution | `settlement-engine.ts` |
| escrow | `PraestEscrow.sol`, Solana program, `domains.ts` funding actions |
| Hyperlane decision transport | `StudioDecisionGateway.sol`, receiver, `apps/bridge`, relayer config |
| EVM routes | chain registry + EVM receiver/escrow deployments |
| Solana Testnet | `contracts/solana`, route registry, web funding action |
| x402 | `x402.ts`, developer surface |
| agents/tasks/liability | database/GenLayer resolver/product routes |
| event resolution | `EventResolver.py`, event product routes |
| Internet Court interop | `internet-court.ts` |
| TLS evidence | `tlsnotary.ts`, `tls_proofs` table |
| REST/OpenAPI | NestJS Swagger/API |
| TypeScript SDK | `packages/sdk-typescript` |
| Python SDK | `packages/sdk-python` |
| CLI | `packages/cli` |
| MCP | `packages/mcp` |
| enterprise auth/RBAC | WorkOS + auth guard + permissions |
| billing | `billing.ts`, Stripe tables/routes |
| notifications/webhooks | `notifications.ts`, webhook tables/actions |
| TVG/reputation | ledger tables + product/explorer routes |
| observability | `telemetry.ts`, Sentry/OpenTelemetry configuration |
| security/DR/ops | guards, crypto, destination policies, CI, docs/runbooks |
