# Agent Tank status

The active tree is the focused Agent Tank runtime. The prior full-product tree is preserved on the remote branch `full-product-pre-agent-tank`.

Implemented and locally verified:

- `PRAESTAgreementVault` deterministic agreement/evidence/case lifecycle with commitment binding, bounded inputs, role checks, and replay-safe verdict application.
- `PRAESTAdjudicator` bounded GenLayer interpretation prompt with hostile-evidence instructions and substantive field comparison.
- injected-wallet-only web shell for Studio-dev (61997).
- direct-contract TypeScript SDK, backend-free MCP surface, and PRAEST agent skill.
- static verification and Python syntax checks.

Not claimed complete:

- The live deployment is not confirmed. A submitted AgreementVault hash was later `not found` on the canonical RPC, so `deployments/agent-tank.json` is `UNCONFIRMED` with no fabricated address.
- Full JS dependency-resolved typecheck/build and clean-room verification are not run because the local npm installation is broken and the fallback package manager attempted network access that is blocked in this environment.
- No live frontend URL, fee profile, adjudication proof, or final GitHub parity claim is fabricated.
