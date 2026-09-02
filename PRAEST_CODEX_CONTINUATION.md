# PRAEST — Codex continuation handoff

You are continuing an already-built PRAEST repository. Do not restart, redesign, simplify, or reduce scope.

## Immutable starting artifact

Use `PRAEST_FULL_PRODUCT.zip` as the source of truth.

- Files in ZIP: **160**
- ZIP SHA-256: `4113c6d0edaae8690f6e95b981a97965d3c88d8bd897ae1b8b851e387427f43a`
- Canonical Git root tree SHA from the exact ZIP contents: `c4098372650faca28aa918bcceb262c969f16e56`
- Only executable file mode in the canonical tree: `scripts/solana-deploy.sh` = `100755`
- Target repository: `github.com/ometere123/praest`

The existing GitHub `main` contains failed/partial import staging attempts. Do not treat it as authoritative. The ZIP is authoritative.

## First task — restore GitHub cleanly

1. Extract the ZIP to a clean directory.
2. Read these before changing anything:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `CODEX.md`
   - `docs/HANDOFF.md`
   - `docs/IMPLEMENTATION_STATUS.md`
   - `docs/DEPLOYMENT.md`
   - `docs/TRUST_MODEL.md`
   - `docs/REQUIREMENTS_TRACEABILITY.md`
3. Clone `github.com/ometere123/praest`.
4. Preserve the existing bad/staging branch only as an optional backup branch such as `pre-praest-import`; it is not source of truth.
5. Replace the entire working tree with the ZIP contents. Remove all temporary import debris if present, including:
   - `.bootstrap/`
   - `bootstrap/`
   - `.import*/`
   - `.exact-import/`
   - temporary importer workflows/payload archives
6. Configure Git so line endings do not change the source:
   ```bash
   git config core.autocrlf false
   ```
7. Preserve executable mode:
   ```bash
   chmod +x scripts/solana-deploy.sh
   ```
8. Before making any functional changes, stage the exact ZIP tree and prove:
   ```bash
   git add -A
   git write-tree
   ```
   It **must equal**:
   `c4098372650faca28aa918bcceb262c969f16e56`
9. If it does not equal that SHA, do not continue. Find the path/content/mode mismatch first.
10. Commit this exact baseline, e.g. `feat: publish complete PRAEST source`, and update `main` using the safest appropriate method (`--force-with-lease` is acceptable because current `main` is failed staging, but preserve a backup ref first).
11. Fetch GitHub `main` again and verify its commit tree SHA is exactly `c4098372650faca28aa918bcceb262c969f16e56` before doing any further code work.

## Second task — validate the existing build, do not rebuild it

The source already contains the Product, Control Plane, Developer Platform, Explorer, NestJS API, Drizzle/Postgres model, Temporal workflows, StudioNet Intelligent Contracts, settlement engine, zkSync Sepolia → Hyperlane path, EVM settlement contracts, Solana Testnet recipient/escrow, probes, evidence, x402, billing, SDKs, CLI, MCP, CI/security and deployment docs.

Run the real validation suite from a clean environment:

```bash
node --version
npm --version
python --version
npm install
npm run doctor
npm run verify:repo
npm run typecheck
npm test
npm run build
```

Then validate native stacks rather than marking them passed without execution:

### EVM / Foundry

Install Foundry and Foundry-ZKsync as required by the existing deployment architecture. Then run at minimum:

```bash
cd contracts/evm
forge install foundry-rs/forge-std --no-commit   # only if not already installed
forge build
forge test -vvv
```

Use the zkSync-aware deployment path already present in the repo. Do not silently replace it with standard EVM deployment if zkSync requires Foundry-ZKsync behavior.

### Solana Testnet

Install Rust/Cargo + Agave/Solana tooling and run:

```bash
cargo check --manifest-path contracts/solana/Cargo.toml
cargo test --manifest-path contracts/solana/Cargo.toml
cd contracts/solana
cargo build-sbf
```

Do not hard-code a fake program ID. After live deployment, sync the real deployed program ID/config.

### GenLayer StudioNet

The frozen current GenLayer environment is **StudioNet**. Do not redesign around Bradbury.

Validate:

- Python syntax for every IC
- current GenVM lint/tooling where supported
- Direct Mode tests against the actual IC code
- live StudioNet deployment/transaction lifecycle when credentials/funds are supplied
- `ACCEPTED` is provisional; settlement is allowed only after `FINALIZED`
- DecisionOutbox publisher authority stays restricted

Do not fabricate addresses or claim live proof without actual transactions.

## Frozen architecture — do not reopen unless a verified blocker forces it

Core flow:

`identity → service/agent → agreement → monitoring/execution → evidence → incident/case → deterministic evaluation → GenLayer adjudication → appeal/finality → deterministic settlement instruction → DecisionOutbox → Studio relay → zkSync Sepolia gateway → Hyperlane GMP → destination receiver/program → destination-local escrow → reconciliation → receipt/reputation/TVG`

Important invariants:

- GenLayer is the adjudication infrastructure; do not brand PRAEST as “a GenLayer service”.
- Deterministic work stays outside GenLayer; GenLayer resolves ambiguity.
- `ACCEPTED != FINALIZED`.
- No irreversible settlement before finality.
- StudioNet cannot directly call Hyperlane/EVM; the Studio bridge worker is an explicit trust boundary.
- Hyperlane relays finalized decision instructions; destination-local assets execute locally.
- Do not use a fake or always-true production ISM.
- `instructionId` is distinct from `decisionHash` and provides business idempotency.
- Destination escrow independently constrains agreement, asset, provider/customer beneficiaries, remedy cap and remaining amount.
- One failing probe region must not itself create a service outage; respect the configured multi-region quorum.
- Collector failures are `UNKNOWN/COLLECTOR_ERROR`, not service failures.
- No mock production data, fake deployment addresses, or “success” responses to hide missing integrations.
- No major agreed scope should be deferred to “v2” simply to get a green build.

## Third task — fix only actual issues found by validation

If clean install/typecheck/test/build/native compilation finds an issue:

1. diagnose it against current official package/API docs;
2. make the smallest correct fix while preserving the frozen architecture;
3. add or update tests for the fix;
4. rerun the relevant validation;
5. commit the fix clearly;
6. keep `docs/IMPLEMENTATION_STATUS.md` truthful.

Do not rewrite working subsystems for style or preference.

## Fourth task — complete credential-bound live proof when credentials are supplied

The remaining live proof may require user credentials/funded testnet accounts for:

- Supabase/Postgres
- WorkOS
- Privy
- Upstash
- ClickHouse
- R2
- Temporal Cloud
- AWS probes
- StudioNet submitter
- zkSync/EVM testnet deployers
- Hyperlane relayer/ISM
- Solana Testnet deployment keypair/test mint
- Stripe/Resend/Sentry/etc.

Follow `docs/DEPLOYMENT.md` and `docs/HANDOFF.md`.

When credentials are absent, stop only at the genuine credential boundary and report exactly what is needed. Do not replace a live integration with a mock.

## Required live cross-chain proof bundle

For a representative successful settlement collect and record:

- StudioNet adjudication tx ID
- decided/appeal/finalized lifecycle evidence
- decision hash
- DecisionOutbox instruction + payload hash
- zkSync Sepolia gateway dispatch transaction
- Hyperlane message ID
- destination process transaction/signature
- destination receiver/program execution state
- escrow state/balances before and after
- final PRAEST receipt hash

Repeat on at least one EVM destination and Solana Testnet when funded credentials are available.

## Definition of done

Do not say “done” until:

- exact baseline source was first published to GitHub and proven by tree SHA `c4098372650faca28aa918bcceb262c969f16e56`;
- current post-fix `main` is clean and GitHub Actions are green or any unavoidable external blocker is explicitly documented;
- JS/TS install, typecheck, tests and build have actually run;
- EVM and Solana native compile/tests have actually run;
- GenLayer Direct Mode/native validations have actually run where tooling permits;
- every source change after the baseline is justified by a real validation failure or current official API incompatibility;
- no temporary import/bootstrap files remain;
- `docs/IMPLEMENTATION_STATUS.md` accurately distinguishes implemented, compiled/tested, and live-testnet-verified work.

Start by restoring the exact ZIP tree to GitHub. Do not start a new PRAEST implementation.
