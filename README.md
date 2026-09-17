# PRAEST

PRAEST is a focused GenLayer Agent Tank: a buyer and provider freeze a versioned agreement, lock bounded provenance-labelled evidence, open a dispute, and send only the ambiguous interpretation to GenLayer.

## Network

- Network: Studio-dev
- Chain ID: `61997`
- RPC: `https://studio-dev.genlayer.com/api`
- Explorer: `https://explorer-studio-dev.genlayer.com/`
- Runner: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`

The canonical deployment record is [`deployments/agent-tank.json`](deployments/agent-tank.json). It is `UNCONFIRMED` until both contracts have finalized with `FINISHED_WITH_RETURN`; a transaction hash alone is never treated as deployment proof.

## Runtime

The active submission has no persistent PRAEST backend, database, API key, server-held signer, WorkOS, Privy, EVM destination runtime, Solana runtime, or bridge. The browser uses an injected EIP-1193 wallet. Agents use the direct TypeScript SDK, direct Python JSON-RPC reader, MCP surface, or [`skills/praest/SKILL.md`](skills/praest/SKILL.md).

The two contracts are:

1. `PRAESTAgreementVault` — deterministic counterparties, versioned terms and policy, evidence lock, dispute binding, provisional result, finality gate, and exactly-once receipt materialization.
2. `PRAESTAdjudicator` — bounded GenLayer nondeterministic interpretation with substantive validator comparison and fail-closed `UNDETERMINED`.

Lifecycle:

```text
PROPOSED → ACTIVE → DELIVERY → DISPUTED → PROVISIONAL_RESULT → FINALIZED → receipt
```

`ACCEPTED`/provisional results are not final. Downstream materialization requires an explicitly finalized result and successful execution.

## Development

```bash
npm install
npm run verify:repo
npm run build
npm run typecheck
npm test
```

For a credentialed deployment, keep the private key in the ignored `.env.local` file:

```bash
GENLAYER_STUDIONET_PRIVATE_KEY=0x...
npm run genlayer:deploy
```

The deploy script obtains a fresh fee quote for each contract, deploys the vault first, passes its address as the adjudicator constructor argument, waits for finalization, verifies execution success, and only then writes addresses to the manifest.

## Verification boundary

`npm run verify:repo` performs focused static checks and Python syntax validation. Direct Mode, GenVM lint, dependency-resolved JavaScript checks, live Studio-dev deployment, live nondeterministic adjudication, Vercel/browser proof, and clean-room clone results are recorded as pending until they actually run. See [`docs/AGENT_TANK_STATUS.md`](docs/AGENT_TANK_STATUS.md).

The previous full-product implementation is preserved on the archival branch `full-product-pre-agent-tank`; it is not part of the active submission tree.
