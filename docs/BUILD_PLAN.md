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
   ├─ PRIMARY  → PraestSettlementReceiver on Base Sepolia (same chain)
   └─ STRETCH  → Hyperlane Mailbox → receiver on Ethereum Sepolia
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

### Networks (locked)

| Role | Network | Chain ID |
|---|---|---|
| Judgment | GenLayer studio-dev | 61997 |
| Settlement (primary) | Base Sepolia | 84532 |
| Settlement (cross-chain proof) | Ethereum Sepolia | 11155111 |

Hyperlane mailboxes (verified against hyperlane-registry, 2026-09-06):

- Base Sepolia `0x6966b0E55883d49BFB24539356a2f8A673E02039`
- Sepolia `0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766`
- Base Sepolia ISM `0x21176a591be546f40fDf013A80e63dB6b65905da`

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

Same-chain settlement on Base Sepolia — bridge dispatches straight to the receiver on Base — is the primary path and has no bridge in it. Cross-chain (Base → Sepolia) is Day 5 and is a **bonus**, because message delivery depends on relayer availability we do not control.

If Hyperlane delivery works: two proofs. If it doesn't: one proof, still complete, still honest.

---

## 3. Phases

### Day 1 — Foundation green
Nothing new is built. Everything downstream depends on this.

- [ ] Remove Temporal from the demo path; replace the 4 workflows with interval loops in `apps/bridge`
- [ ] Delete `temporal-server` + `temporal-postgres` Railway services (frees the plan limit)
- [ ] Fix why `praest-api` has failed every deploy since Sept 4 — note it builds from commit `291d67f6`, which is **not** in local history
- [ ] Real secrets into `praest-api`, `praest-worker`, `praest-bridge`
- [ ] Vercel `web` green (WorkOS + Privy)
- [ ] Fill `SEPOLIA_RPC_URL` (still blank)

**Done when:** `/health` returns 200 on the deployed API and the web app loads signed-in.

### Day 2 — Money on chain
- [ ] `forge build` + `forge test` clean
- [ ] Deploy `PraestEscrow` + `PraestSettlementReceiver` → Base Sepolia
- [ ] Deploy the same pair → Ethereum Sepolia
- [ ] Set each receiver's ISM to the real registry ISM (never a mock — `AGENTS.md`)
- [ ] Grant `SETTLER_ROLE` on each escrow to its receiver
- [ ] Fund one escrow with test USDC from the browser wallet
- [ ] Record addresses into `.env.local` + `deployments/`

**Done when:** `EscrowFunded` is visible on Basescan.

### Day 3 — Bridge wired
- [ ] `apps/bridge`: poll `DecisionOutbox` → confirm FINALIZED → build instruction → dispatch
- [ ] Same-chain path: dispatch directly to the Base Sepolia receiver
- [ ] Idempotency: an already-dispatched `instructionId` is never sent twice
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
- [ ] Base Sepolia → Sepolia via Hyperlane; if undelivered in a set window, document it and keep same-chain as the proof
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
| Hyperlane doesn't deliver on testnet | Medium | Day 4 demo is same-chain and needs no bridge |
| `praest-api` build stays broken | Medium | Day 1 blocks everything else; treat as P0 |
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
