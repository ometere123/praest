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

## Corrected runner pin

The pin `9b8kjyda2y...` (pulled from `genlayerlabs/genlayer-studio`'s main-branch example
contracts) turned out to be a different, unrelated `py-genlayer` build - not what studio-dev
actually expects. The correct pin, confirmed by the user from GenLayer's own docs, is:
`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`. All 9 contracts and
`test_contracts.py`'s pin-check use this corrected value.

## Live proof: `run_nondet_default` works on the pinned studio-dev runner (2026-09-05)

Local `genvm-lint` (version `0.11.0`) flags every contract using `gl.vm.run_nondet_default` with:
```
gl.nondet.* call in '<Contract>._resolve.<locals>.leader_fn' not reachable from equivalence principle block
```
It also cannot load the SDK bundle for the corrected runner pin locally
(`Failed to load SDK: "filename 'runners/py-genlayer/5j/ycge4q8k23...tar' not found"`), which
predates the runner and can't be used to validate against it either way.

**A live semantic call proves the tooling warning is a version-lag false positive, not a contract
defect.** All 6 contracts using `gl.vm.run_nondet_default` were exercised live against
`studioDevnet` (chain `61997`, `https://studio-dev.genlayer.com/api`), each forcing genuine
`gl.nondet.web.render` + `gl.nondet.exec_prompt` execution inside `leader_fn` (a real `https://`
URL in the agreement, not a bypass). All 6 reached `FINALIZED` / `FINISHED_WITH_RETURN`:

1. **`ServiceAssuranceResolver`** (`0xAB67b705917Bb275af830d5015FF20aD5C2558ca`) - call tx
   `0x1d3f14c1d3060c675ee33a99d518c4445668f662fd0c3ae8cff44c6f20f1c830`. Result:
   `{"outcome":"fulfilled","reason_code":"SERVICE_REACHABLE_NORMAL_RESPONSE","remedy_bps":0,...}`.
   Fee deposited `621204000010352`, refunded `541272500009529` at finalization.
2. **`LiabilityResolver`** (`0xEFA69e324Eaba9F49B4C597B50783d56eCd58891`, the structurally most
   complex validator - custom `_liability_matches` array comparison) - call tx
   `0xd3a3aaf0b666a130c39ffe9927d2566c294287a379c0430ff85170fb24fd6be2`. Result:
   `{"outcome":"undetermined","reason_code":"INSUFFICIENT_EVIDENCE","liability":[],...}` - correctly
   declined to fabricate a liability allocation when the fetched evidence showed no actual outage,
   exactly the "don't guess" behavior `_normalize_liability` was designed for.
3. **`DisputeResolver`** (`0xDB21697e97a9A5b8b44A9F9FAFc6c116e6f744aA`) - call tx
   `0x3344b36b2327d52d2558aac9c927bb02bd2bde6e8a0f6323de6d849bd876a6d8`. Result:
   `{"outcome":"undetermined","reason_code":"INSUFFICIENT_EVIDENCE",...}`.
4. **`AgentAgreementResolver`** (`0x1D92a75A61EdE76BE75F42d72B00A5C993C0600E`) - call tx
   `0x336b98442880e811f2e1f4de9856fb674a4e87341f3557d74d4a5fbb6a70440e`. Result:
   `{"outcome":"undetermined","reason_code":"INSUFFICIENT_EVIDENCE",...}` - reasoning correctly
   noted the empty task spec and treated the agent's self-report as an unverified allegation.
5. **`EventResolver`** (`0x9FD22e352ddc75Aa1B88f2cb7F75C2D6Ab55551f`) - call tx
   `0x8cabe3d7e2f50af5b9a1d386215d7dc46e833cd5f3ca14a5d01120a868a4effc`. Result:
   `{"outcome":"fulfilled","reason_code":"SITE_ONLINE","remedy_bps":10000,...}` - correctly resolved
   the binary factual claim and applied the full-remedy default for a `fulfilled` event.
6. **`EvidenceAssessor`** (`0xcd007f5352C8aD38fbAeCf3E301c694b385f0b61`, via `assess()`/
   `get_assessment()` rather than `resolve()`) - call tx
   `0x1ab048a45b46a53c2e8a27543face5ff1ac55203c45f585383ee25bfb7d56339`. Result:
   `{"sufficient":false,"conflicts":false,"reason_code":"INSUFFICIENT_EVIDENCE"}`.

**Classification**: local tooling lag - installed `genvm-lint` (`0.11.0`) does not yet recognize
`run_nondet_default` as the current v0.3 equivalence boundary, while the pinned studio-dev runner
executes it successfully across all 6 contracts that use it. `run_nondet_default` was not removed
or replaced to silence this warning - the pre-deploy pin correction was the only change made, and
the same warning persisted with the corrected pin (confirming it's the linter, not the pin, that's
stale).

All 9 contracts are deployed to `studioDevnet` and have live proof - see
`deployments/studioDevnet.json` for addresses/tx hashes. The 3 contracts with no `nondet` calls
(`AgreementRegistry`, `SettlementEntitlement`, `DecisionOutbox`) are proven by successful
deploy+finalize (no lint warning applies to them); all 6 `run_nondet_default` users now have a
live semantic call exercising their actual prompt/validator logic, not just a deploy.

## What's still open

- **`client.advanced.getTransactionLifecycle()` in `LifecycleService.finalize()`**: now wired
  (`apps/api/src/genlayer.ts`'s `getLifecycle()` + `resolutionAction === "Finalize"` gate in
  `apps/api/src/lifecycle.ts`) - no longer open.
- **Live semantic proof for all 6 `run_nondet_default` contracts**: done - no longer open.
- **`docs/DEPLOYMENT.md`/`docs/ENVIRONMENT.md`**: still reference the old `studionet` addresses in
  places - need a pass to point at `deployments/studioDevnet.json` and `GENLAYER_NETWORK`.
- **`.env.local` GenLayer contract address variables**: still need updating to the new
  `studioDevnet` addresses in `deployments/studioDevnet.json` (the old `studionet` addresses
  won't resolve on this network).
