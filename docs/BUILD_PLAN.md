# PRAEST — Locked Architecture & 7-Day Build Plan

**Locked 2026-09-06. Do not redesign during the build window.**
Deviations require a verified external blocker, recorded in this file with evidence.

## Goal: the full product working on testnet — not a demo path

PRAEST is already built: 6 apps, 8 packages, 42 tables, 165 routes, 9 Intelligent Contracts,
5 Solidity contracts. Almost nothing here is new construction.

The 7 days are spent turning written-and-tested code into **deployed and proven** code.
The gap is not features. The gap is that **no Solidity contract has ever touched a chain**
and three of five Railway services are down.

"Fully" means all six resolver types settle real money, not one golden path.

### What "fully" does not include

These stay cut for the window. Each is config-gated off, not deleted, and documented below:
Solana, TLSNotary, Internet Court adapter, Stripe, Temporal, zkSync, LayerZero,
and the five extra EVM chains.

---

## 1. Locked architecture

```
identity → organisation → service → agreement (terms + remedy caps)
   ↓
observation (Globalping probes) → evidence (R2 + hashes)
   ↓
deterministic pre-check  ── unambiguous? ──→ settle directly, no GenLayer call
   ↓ contested / interpretive only
GenLayer Intelligent Contract resolver  (studio-dev, chain 61997)
   run_nondet_default → leader proposes → validators check
   ↓
ACCEPTED (provisional)  →  appeal window  →  FINALIZED (irreversible)
   ↓
DecisionOutbox.py records the versioned settlement instruction
   ↓
apps/bridge polls, confirms FINALIZED, dispatches
   ↓
   ├─ PRIMARY  → PraestSettlementReceiver on Base Sepolia (same chain, no message)
   └─ STRETCH  → Sepolia Mailbox → Hyperlane → receiver on Base Sepolia
   ↓
PraestEscrow.execute()  — caps enforced, replay blocked
   ↓
funds released → receipt → reputation
```

### Trust boundary

| Concern | Who is trusted |
|---|---|
| Was the promise kept? | GenLayer validators (many, independent) |
| Is the decision final? | GenLayer protocol (appeal window → Finalized) |
| Can PRAEST steal funds? | **No** — `PraestEscrow` only pays provider or customer |
| Can PRAEST over-award? | **No** — `maxCustomerRemedyBps` capped at agreement time |
| Can a decision replay? | **No** — `executedInstructions` |
| Did the message really come from PRAEST? | Receiver checks origin + sender + expiry |

PRAEST never custodies funds. The payer funds the escrow from their own wallet.

**Known trust assumption, stated rather than hidden.** The destination chain cannot verify GenLayer
finality — there is no light client. Something must vouch that a settlement instruction corresponds
to a real finalized decision, and today that is `trustedSender`: a single bridge key. A production
system would make this an M-of-N attestor quorum signing the settlement payload.

What bounds the damage today is `PraestEscrow`, not the key. A compromised bridge key can only:

- pay the **provider or the customer** — every other beneficiary reverts
  ([PraestEscrow.sol:132](../contracts/evm/src/PraestEscrow.sol#L132))
- award the customer at most `maxCustomerRemedyBps` of the deposit
  ([PraestEscrow.sol:137](../contracts/evm/src/PraestEscrow.sol#L137))
- never exceed the deposit, never replay an `instructionId`

So a stolen key misdirects funds **between the two parties who signed the agreement**. It cannot
extract to an attacker's address. That is a collusion/griefing vector, not a drain. Say this plainly
in the submission; do not build the quorum inside the 7 days.

### Networks (locked)

| Role | Network | Chain ID / Domain |
|---|---|---|
| Judgment | GenLayer studio-dev | 61997 |
| **Settlement destination (all money moves here)** | **Base Sepolia** | **84532** |
| Cross-chain dispatch origin (Day 6 only) | Ethereum Sepolia | 11155111 |

**Base Sepolia is the destination, not the origin.** This direction is measured, not assumed.
Counting Hyperlane `Process(origin, sender, recipient)` events on each testnet Mailbox over a
6-hour window on 2026-09-06:

| Destination | Deliveries in 6h |
|---|---|
| **Base Sepolia** | **121** |
| Ethereum Sepolia | 0 |
| Arbitrum Sepolia | 0 (60,300 blocks scanned) |
| Optimism Sepolia | 0 |
| Linea Sepolia | 0 |
| Polygon Amoy / Scroll Sepolia | RPC unreachable |

By origin into Base Sepolia: domain `1328` → 50, domain `1337090` → 38,
**`sepolia` → 33** (~5.5/hour).

Conclusions that follow from the measurement:

1. **Base Sepolia is the only testnet anyone is delivering into.** Every other candidate is dead
   as a destination, so the escrow must live on Base Sepolia.
2. **Sepolia → Base Sepolia is the one live route** among chains PRAEST already has configured.
3. **No testnet pair works in both directions.** That is fine: PRAEST's settlement flow is
   one-directional. Reconciliation reads destination state over plain RPC, never over Hyperlane.
4. Hyperlane's own validators and relayers serve this route. PRAEST does **not** need to run
   validators or a relayer, and `apps/relayer` stays unused.

Re-run the measurement before Day 6 — relayer coverage shifts, and today's numbers are a snapshot.
Script: count `Process` events per Mailbox grouped by origin domain.

Addresses (verified against hyperlane-registry, 2026-09-06 — these match `chains.json` already):

- Base Sepolia Mailbox `0x6966b0E55883d49BFB24539356a2f8A673E02039`
- Base Sepolia ISM `0x21176a591be546f40fDf013A80e63dB6b65905da`
- Base Sepolia IGP `0x28B02B97a850872C4D33C3E024fab6499ad96564`
- Base Sepolia USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (same chain x402 already uses)
- Sepolia Mailbox `0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766`

Note Base Sepolia has a full Hyperlane deployment (IGP, ISM, routing, protocol fee); zkSync
Sepolia has mailbox and factories only — another reason it is cut.

### Cut from scope

| Cut | Why |
|---|---|
| **Temporal** | 34 lines of sleep-loops. Replaced by an interval loop in `apps/bridge`. Frees 2 Railway services. |
| **zkSync Sepolia** | Only existed as a bridge hop. Its Hyperlane deployment is a stub (no IGP, no ISM). |
| **LayerZero** | Only carries hub→destination in GenLayer's boilerplate. Hyperlane does the same leg, already wired. |
| **Stripe** | Not an agent-native rail. Revenue = x402 + settlement bps + GenLayer developer share. |
| **Solana** | Toolchain blocked. Two EVM chains prove cross-chain. |
| **5 extra EVM chains** | Each is another escrow to deploy, fund and babysit. |
| **TLSNotary** | Optional evidence enrichment. Globalping already gives independent measurement. |
| **Internet Court adapter** | Standards write-back, not demo-critical. |

Nothing above is deleted from git. Config-gated off, documented here.

### Revenue (replaces Stripe)

1. **GenLayer developer share** — 10% of the fee pool for contracts linked to a Developer NFT. Native, automatic.
2. **x402 per-call** — on the Resolution API. Already built; point it at a real endpoint.
3. **Settlement bps** — small skim on released remedy value, computed deterministically.

---

## 2. The one rule that protects the demo

**Day 4's end-to-end run must not depend on Hyperlane.**

Same-chain settlement on Base Sepolia — bridge dispatches straight to the receiver on Base — is the primary path and has no message, no validators and no relayer in it. Cross-chain (**Sepolia → Base Sepolia**) is Day 6 and is a **bonus**, because delivery depends on relayer availability we do not control.

If Hyperlane delivery works: two proofs. If it doesn't: one proof, still complete, still honest.

---

## 3. Phases

### Day 1 — Foundation green ✅ COMPLETE (2026-09-06)
Nothing new was built. Everything downstream depended on this.

- [x] Remove Temporal — 4 workflows replaced by an interval scheduler in `apps/worker`
- [x] Delete `temporal-server` + `temporal-postgres` Railway services (3 services left, 2 slots free)
- [x] Fix `praest-api`, failing every deploy since Sept 4. **Four separate bugs, none of them secrets:**
  1. `@praest/database`, `/protocol`, `/schemas`, `/config` all declared `"main": "./src/index.ts"`,
     so Node loaded TypeScript source at runtime and died on `ERR_MODULE_NOT_FOUND` for
     `schema.js`. Repointed all four at their `dist/` output.
  2. `@fastify/static` was only present transitively via the Temporal packages; removing them broke
     Swagger UI. Added explicitly at `^10.1.3` (`^8` fails peer resolution against
     `@nestjs/platform-fastify@11`).
  3. `DATABASE_URL` was never set on the Railway service at all.
  4. Supabase's pooler cert → `SELF_SIGNED_CERT_IN_CHAIN`; `createDatabase()` hardcoded
     `rejectUnauthorized: true`. Now configurable, still secure by default.
- [x] **The Supabase database had zero tables** — migrations had never been run. All 42 now exist.
- [x] Real secrets into `praest-api`, `praest-worker`, `praest-bridge` (80 vars each, piped from
      `.env.local` via stdin so values never transit a shell argument or a log)
- [x] Fill `SEPOLIA_RPC_URL`
- [x] Vercel `web` green

**Done when:** `/healthz` returns 200 on the deployed API and an authenticated DB-backed endpoint
returns 200. Both confirmed.

### Day 2 — Money on chain
Everything settles on **Base Sepolia**. Ethereum Sepolia gets the dispatch gateway only.

- [ ] `forge build` + `forge test` clean
- [ ] Deploy `PraestEscrow` → **Base Sepolia**
- [ ] Deploy `PraestSettlementReceiver` → **Base Sepolia**, constructor args:
      mailbox `0x6966b0E55883d49BFB24539356a2f8A673E02039`,
      localDomain `84532`,
      trustedOrigin `11155111` (Sepolia),
      trustedSender = the Sepolia gateway address (set after the gateway deploy, via
      `setTrustedRoute`),
      ism `0x21176a591be546f40fDf013A80e63dB6b65905da` (the real registry ISM — never a mock,
      per `AGENTS.md`)
- [ ] Deploy `StudioDecisionGateway` → **Ethereum Sepolia** (dispatch side only, no escrow there)
- [ ] `escrow.setSettler(receiver, true)` on Base Sepolia
- [ ] `receiver.setTrustedRoute(11155111, bytes32(gateway))` once the gateway address exists
- [ ] Fund one escrow with Base Sepolia USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
      from the browser wallet
- [ ] Record addresses into `.env.local` + `deployments/baseSepolia.json`

**Done when:** `EscrowFunded` is visible on Basescan.

### Day 3 — Bridge wired
- [ ] `apps/bridge`: poll `DecisionOutbox` → confirm GenLayer FINALIZED **and** a successful
      execution result (`FINISHED_WITH_RETURN`) → build instruction → dispatch
- [ ] Same-chain path: dispatch directly to the Base Sepolia receiver — no Hyperlane message
- [ ] Idempotency: an already-dispatched `instructionId` is never sent twice
- [ ] Track the four states separately in `hyperlane_messages`, never collapsed into one flag:
      `DISPATCHED` → `DELIVERED` → `PROCESSED` → `SETTLED`.
      Dispatched is not delivered; delivered is not settled.
- [ ] Dispatch one hand-built instruction end to end

**Done when:** `EscrowSettled` fires on Base Sepolia from a bridge-dispatched instruction.

### Day 4 — First full loop closes (service assurance)
The reference path. Every other resolver reuses this machinery.

- [ ] Create a real agreement (99.9% uptime, maintenance exception, 10%/25% remedy)
- [ ] Fund its escrow
- [ ] Break the monitored service for real
- [ ] Probes record it; evidence is stored and hashed
- [ ] Deterministic pre-check runs; contested question goes to GenLayer
- [ ] `ServiceAssuranceResolver` returns a structured decision
- [ ] Appeal window passes → FINALIZED (**measure how long this takes — it sets Day 7's script**)
- [ ] Bridge dispatches → escrow releases → receipt written

**Done when:** one agreement produces a settled payout with every hash and tx recorded.

### Day 5 — All six resolver types settle
This is what makes it a product instead of a demo. All six are already live-proven on
studio-dev; what is missing is each one's route to settlement.

- [ ] `DisputeResolver` — contested case → remedy
- [ ] `AgentAgreementResolver` — agent task judged → payout or refund
- [ ] `EventResolver` — binary condition → full remedy or nothing
- [ ] `LiabilityResolver` — multi-party apportionment → split allocation
- [ ] `EvidenceAssessor` — sufficiency gate before adjudication
- [ ] `SettlementEntitlement` + `AgreementRegistry` read by the API on the real path
- [ ] One settled case per resolver type, each recorded

**Done when:** six resolver types have each moved money at least once.

### Day 6 — Surface, cross-chain, revenue
Judges look at the screen, not the repo.

- [ ] Main product routes work signed-in — services, agreements, evidence, cases, decisions, escrows, settlements, receipts
- [ ] Receipt page shows the full chain: agreement → evidence → decision → tx → payout
- [ ] Every link resolves to a real explorer
- [ ] Failure states show honestly (UNCONFIGURED / PENDING / FAILED — never fake success)
- [ ] **Re-run the route measurement first** (Process events per Mailbox by origin). Only attempt the
      cross-chain leg if `sepolia → basesepolia` still shows recent deliveries.
- [ ] Cross-chain leg: dispatch from the **Sepolia** gateway → Hyperlane → **Base Sepolia** receiver.
      Never the reverse: Base Sepolia is the only testnet being delivered into.
- [ ] If undelivered within a set window, document it with the measurement and keep same-chain as
      the proof. Do not stand up validators to rescue it — that is days of work for a bonus.
- [ ] x402 pointed at a real Resolution API endpoint (not the demo route)
- [ ] Settlement bps skim in the instruction builder

**Done when:** a stranger can follow any of the six case types start to finish on screen.

### Day 7 — Record and submit
No new code.

- [ ] Under-2-minute demo video: escrow funded → service breaks → decision → money moves
- [ ] README rewritten around the locked architecture
- [ ] Evidence doc: every address, tx hash, decision hash
- [ ] Submit

---

## 4. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Hyperlane doesn't deliver on the cross-chain leg | **Medium** | Measured: `sepolia → basesepolia` ran ~5.5 deliveries/hour on 2026-09-06, so the route is live today. But Day 4's proof is same-chain and contains no message at all, so this can only cost the bonus. Re-measure before Day 6. |
| Cross-chain built in the wrong direction | **Closed** | Measured. Base Sepolia is the only testnet receiving deliveries (121 in 6h vs 0 everywhere else). Origin is Sepolia, destination is Base Sepolia. |
| `praest-api` build stays broken | **Closed** | Fixed 2026-09-06: four bugs (source-as-entrypoint in 4 packages, missing `@fastify/static`, absent `DATABASE_URL`, Supabase TLS). `/healthz` and an authenticated DB endpoint both return 200. |
| Bridge signing key compromised | Low | Bounded by `PraestEscrow`, not by the key: only provider/customer can be paid, capped at `maxCustomerRemedyBps`. Griefing vector, not a drain. Stated openly in the submission; M-of-N attestor quorum is roadmap, not scope. |
| studio-dev loses state (no persistence) | **Low** | GenLayer team assured the user 2026-09-06 that nothing is wiped until the hackathon is judged. Docs still say studio-dev "offers no state persistence", so keep `deploy-genlayer.ts` idempotent and re-verify addresses each morning — but do not plan around a wipe. |
| Test USDC unobtainable on Sepolia | Low | Any ERC-20 works — escrow is token-agnostic |
| Appeal window too long for a live demo | Medium | Measure it Day 4; if long, show a pre-finalized case alongside a live-submitted one |

---

## 5. Definition of done

A stranger can open one URL and see:

1. An agreement with real terms
2. Real money in escrow on a public testnet
3. Real evidence of a real failure
4. A GenLayer decision with validator consensus, linked to its explorer
5. Money that actually moved, linked to its explorer
6. A receipt tying all five together

If any of the six is faked or mocked, the build is not done.

**And, because the goal is the product and not a demo:** the six above hold for
**all six resolver types**, not just service assurance. One settled case each,
each independently verifiable on a public explorer.

### "Settled" is an assertion, not a status field

Never treat Hyperlane's `delivered` as proof that money moved. A case counts as settled only when
**all** of these hold — check them independently:

1. `Mailbox.delivered(messageId) == true` (cross-chain leg only)
2. `receiver.processedInstructions(instructionId) == true`
3. escrow state shows the deposit consumed and `EscrowSettled` emitted
4. payout amounts equal the finalized decision's allocation, exactly
5. the database row is reconciled to `SETTLED`
6. the receipt links agreement → evidence hash → decision hash → tx

If the on-chain state says settled and the database disagrees, the chain wins and reconciliation
repairs the row.
