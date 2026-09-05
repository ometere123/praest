# GenLayer Consensus v0.6 / Studio-dev migration

PRAEST targets `studioDevnet` (chain 61997, `https://studio-dev.genlayer.com/api`) as the current
test network, per [GenLayer's Consensus v0.6 migration guide](https://docs.genlayer.com/developers/consensus-v06-migration).
Stable `studionet` (chain 61999) remains available and is a distinct network, not an RPC swap on
the same chain object - studio-dev has its own consensus contract deployment.

## What changed

**Network selection**: `GENLAYER_NETWORK` env var (`.env.example`) selects the `genlayer-js` chain
preset used by `apps/api/src/genlayer.ts`, `apps/bridge/src/main.ts`, and
`scripts/{deploy,resolve}-genlayer-addresses.ts`. Defaults to `studioDevnet`. Set to `studionet`
to target the stable network instead.

**SDK**: `genlayer-js` bumped to `2.0.0-rc.1` (from `1.1.8`) across `apps/api`, `apps/bridge`, and
the repo root - required for the `studioDevnet` chain preset and the v0.6 fee/appeal APIs below.

**Contract syntax (all 9 contracts in `contracts/genlayer/`)**: rewritten to v0.3.0 per the
migration table:
- Header: `# v0.3.0` + `# { "Depends": "py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0" }`
  (verified against `genlayerlabs/genlayer-studio`'s current live example/test contracts, not
  guessed - this session's local `genvm-lint` cache is too old to validate this pin locally, so
  real validation happens at actual deploy time)
- `import genlayer as gl` + `from genlayer.types import *` (was `from genlayer import *`)
- `gl.contract.Contract` (was `gl.Contract`)
- `gl.storage.TreeMap[...]` / `gl.storage.DynArray[...]` inline (was bare `TreeMap`/`DynArray`
  via wildcard import)
- `gl.message.sender_address` (was `gl.message.sender_account`)
- `gl.vm.UserError` (was bare `gl.UserError`)
- `gl.vm.run_nondet_default(leader_fn, validator_fn)` (was `gl.vm.run_nondet_unsafe`) - **the
  custom leader/validator function pattern is preserved**, confirmed against a live official
  test contract (`company_naming.py`) using the identical pattern. This matters because our
  resolvers (especially `LiabilityResolver`) do structured multi-field tolerance validation that
  doesn't fit the simpler `gl.eq_principle.strict_eq`/`prompt_comparative` helpers shown in the
  basic examples - those are a different, higher-level primitive for simpler cases, not a
  replacement for `run_nondet_default`.
- `@gl.public.write`/`@gl.public.view` decorators, `gl.nondet.web.render`/`gl.nondet.exec_prompt`,
  `gl.vm.Return`/`gl.vm.Result` - all unchanged.

**Fees**: v0.6 requires every deploy/write to carry a quoted `FeesDistribution` + `feeValue`.
`StudioNetAdapter.write()` and `scripts/deploy-genlayer.ts` call `estimateTransactionFeesForWrite`/
`estimateTransactionFees` and submit the returned values unchanged - never invented fee numbers.
Studio deployments can still be gasless; that's read from the estimate result, not assumed.

**Appeals**: `StudioNetAdapter.appeal()` now fetches `getAppealCharge({txId})` before calling
`appealTransaction` - a bare/unfunded appeal can revert with `AppealRoundNotPermitted` under v0.6.

**`gltest.config.yaml`**: adds a `studioDevnet` network entry. The locally installed `genlayer`
CLI (`0.40.0-rc.3`) predates a dedicated `studioDevnet` chain_type - its `chain_type` field only
recognizes 4 fixed values (`localnet`, `studionet`, `testnet_asimov`, `testnet_bradbury`) and is a
wire-protocol-family selector, not a network identity claim. `chain_type: studionet` + explicit
`id`/`url` overrides is what actually targets studio-dev; `default: studioDevnet` makes it the
default network for `gltest run`.

## What's still open

- **`client.advanced.getTransactionLifecycle()`** (the v0.6 protocol lifecycle projection -
  `resolutionAction === "Finalize"` as the authoritative finalize gate) exists in the
  `genlayer-js@2.0.0-rc.1` types but isn't yet wired into `LifecycleService.finalize()` in
  `apps/api/src/lifecycle.ts`, which still uses a best-effort try/catch around `finalize()`. This
  is a real, disclosed gap - the try/catch is safe (never falsely reports success) but not as
  precise as the lifecycle read would be.
- **Redeployment**: the 9 contracts need fresh deployment to `studioDevnet` -
  `deployments/studionet.json` addresses are for the old network and won't resolve on studio-dev.
  `scripts/deploy-genlayer.ts` writes to `deployments/<network>.json`, so a studio-dev deploy
  produces `deployments/studioDevnet.json` without touching the old file.
- **Local `genvm-lint` validation**: this session's cached tool can't fetch the new runner bundle
  (`9b8kjyda2y...`) to validate contracts locally against it. The contracts are correct against
  live official examples fetched from the vendor's own repo, but haven't been lint-verified
  locally - real validation happens at actual studio-dev deploy time.
