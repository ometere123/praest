# API

The NestJS service exposes `/healthz`, Swagger at `/docs`, and versioned APIs under `/v1`.

Major namespaces include bootstrap, resources, services/agreements/escrows, evidence, monitoring, probes, wallets, resolutions/lifecycle, GenLayer, x402, billing, notifications, workflows, explorer/public verification, Internet Court and TLSNotary.

Generic resource endpoints are deliberately limited to allowlisted organisation-scoped tables. Security/economic writes such as agreement activation, API-key creation, secret storage, adjudication, escrow funding and settlement use dedicated domain endpoints.

Use `packages/sdk-typescript`, `packages/sdk-python`, CLI or MCP instead of duplicating direct HTTP logic in integrations.
