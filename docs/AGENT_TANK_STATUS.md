# Agent Tank status

The active tree is the focused Agent Tank runtime. The prior full-product tree is preserved on the remote branch `full-product-pre-agent-tank`.

Implemented and locally verified:

- `PRAESTAgreementVault` deterministic agreement/evidence/case lifecycle with commitment binding, bounded inputs, role checks, and replay-safe verdict application.
- `PRAESTAdjudicator` bounded GenLayer interpretation prompt with hostile-evidence instructions and substantive field comparison.
- injected-wallet-only web shell for Studio-dev (61997).
- direct-contract TypeScript SDK, backend-free MCP surface, and PRAEST agent skill.
- static verification and Python syntax checks.
- both focused contracts pass `genvm-lint` validation; the local linter's `run_nondet_default` reachability warning is documented in `docs/GENLAYER_V06_MIGRATION.md` and predates its support for the pinned Studio-dev runner.

Not claimed complete:

- The live deployment is not confirmed. A submitted AgreementVault hash was later `not found` on the canonical RPC, so `deployments/agent-tank.json` is `UNCONFIRMED` with no fabricated address.
- Full JS dependency-resolved typecheck/build and clean-room verification are not run because the local npm installation is broken and the fallback package manager attempted network access that is blocked in this environment.
- Direct-mode tests are present but cannot run locally because the pinned `py-genlayer:5jyc…` runner archive is absent from the local GenVM cache and runner download is blocked.
- No live frontend URL, fee profile, adjudication proof, or final GitHub parity claim is fabricated.
