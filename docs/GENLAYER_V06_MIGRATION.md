# GenLayer v0.6 / Studio-dev record

PRAEST's active Agent Tank targets Studio-dev on chain `61997` at
`https://studio-dev.genlayer.com/api`. The active contracts use the runner declared in
their headers:

```text
py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
```

This is the pin used by the referenced Caveat and ReferralRail Studio-dev deployments. The
`9b8…` pin from an unrelated upstream example must not be substituted for it.

## Fee and finality rule

Every deployment and write obtains a fresh fee estimate from the network and submits its
`distribution` and `feeValue` unchanged. A transaction is usable only after finalization and
successful GenVM execution (`FINISHED_WITH_RETURN`). `ACCEPTED` is provisional.

The focused deployment script follows the verified pattern used by ReferralRail: deploy the
vault, pass its address as the immutable adjudicator constructor argument, wait for finality,
check execution success, and write the manifest only with confirmed addresses. It refuses to
claim success when the RPC returns a missing or unsuccessful transaction.

## Nondeterministic execution

`PRAESTAdjudicator` uses `gl.vm.run_nondet_default` with leader and validator functions. Both
interpret the same frozen case and hostile/untrusted evidence, compare substantive fields, and
force `UNDETERMINED` when evidence is insufficient or the outcome is outside policy.

The local lint/runtime toolchain may lag the pinned runner and report a reachability warning for
this current equivalence boundary. That warning is recorded as a toolchain limitation, never
converted into a pass. Run the current GenVM linter and Direct Mode against the pinned runner
before claiming those gates.

## References

- [GenLayer v0.6 migration guide](https://docs.genlayer.com/developers/consensus-v06-migration)
- [Caveat Studio helpers](https://github.com/lolaaa00/caveat/blob/main/scripts/studio.py)
- [ReferralRail deployment](https://github.com/ometere123/referralrail/blob/main/deploy/001_deploy_referralrail.ts)
