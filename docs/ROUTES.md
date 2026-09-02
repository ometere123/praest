# Routes

## UI routes

`packages/config/src/routes.json` is the canonical UI route catalog. It contains Product, Control Plane, Developer Platform and Explorer routes. The Next.js catch-all page resolves the entire manifest; high-impact actions use dedicated API actions rather than generic CRUD.

## Chain routes

`packages/config/src/chains.json` seeds verified testnet route metadata. Route records in Postgres attach PRAEST receiver/escrow deployment addresses at deployment time.

A route is not considered live merely because a chain is EVM-compatible; Mailbox/ISM/receiver/escrow and health checks must be configured.
