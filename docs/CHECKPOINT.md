# PRAEST — resume checkpoint

Written 2026-09-07 ~06:35Z, mid-Day-4. Read this first, then `docs/BUILD_PLAN.md` and
`docs/DAY4_PROOF.md`.

## One-line state

Days 1–3 complete and deployed. Day 4 is **7 of 8 steps done** — GenLayer has ruled `breached`
and the money has not moved yet, because the appeal window was still open when we stopped.

## The single next action

The appeal window on adjudication `c1a01b24-252c-4191-a019-f7445d42c541` closed at
**2026-09-07T07:29:03Z**. It is now long past, so finalize should be permitted:

```bash
curl -s -X POST \
  -H "x-praest-internal-token: $PRAEST_INTERNAL_TOKEN" \
  -H "x-praest-organization-id: af52d6fc-23f6-4081-9c71-eac47f95291d" \
  -H "content-type: application/json" -d '{}' \
  https://praest-api-production.up.railway.app/v1/adjudications/c1a01b24-252c-4191-a019-f7445d42c541/finalize
```

Expected: a decision + settlement instruction, then the bridge dispatches and `EscrowSettled`
fires on Base Sepolia — 2 USDC to the customer (1000 bps of 20), 18 USDC to the provider.

### Predicted failure, worth checking before running it

`finalize()` has never been executed. It reads the GenLayer lifecycle projection, writes to
`SettlementEntitlement`, builds an instruction via `SettlementEngine.build()`, then authorizes the
`DecisionOutbox` — four paths that have never run, in a session where **every** previously
unexercised path had a bug.

**Most likely break:** PRAEST's `escrows` table has no row for the on-chain escrow. It was funded
directly with Forge, bypassing `POST /v1/escrows` and `confirm-funding`, so
`SettlementEngine.build()` may not find the escrow id, asset or amounts it needs. Trace that path
before burning the attempt.

## Live IDs for the open case

| | |
|---|---|
| organization | `af52d6fc-23f6-4081-9c71-eac47f95291d` |
| service | `c90ae759-82fc-40e2-bdae-6d9fc25dbbb0` |
| agreement | `72f79b5d-0395-4ae6-9165-dca5dadb01cf` (active) |
| monitor | `6905ea75-05ed-4dd6-a6aa-e042c43e2c97` |
| evidence bundle | `337db6b5-d21b-441d-91c6-de661be47c46` (locked) |
| case | `f1e077b0-1cc4-4cd3-aed0-f63c823043a4` |
| adjudication | `c1a01b24-252c-4191-a019-f7445d42c541` |
| GenLayer tx | `0x8b09384dd423efe94ebaccbd1df90aea7df8a23bae0da3be4c2f39ce7a0ca3c1` |
| verdict | `breached` / `MAINTENANCE_NOTICE_INSUFFICIENT` / 1000 bps |

## Deployed addresses

**Base Sepolia** (settlement destination)
```
PraestEscrow               0x0878eaecB2D7AA4F1929F616E09eCaEf4a63e32e
PraestSettlementReceiver   0x04583fA43177D28D3408bF81D65a4dF7e5e70CC0
PraestTestSettlementToken  0x96Bab6Da11c85296802Ae9Ecc5FCFe28e1230f04   (ptUSD, labelled test asset)
Real USDC                  0x036CbD53842c5426634e7929541eC2318f3dCF7e
ISM                        0x2Cc2f83Bb13E7CC98810bca85Ab2e9884bef496A
```

**Ethereum Sepolia** (dispatch origin only)
```
StudioDecisionGateway      0x0878eaecB2D7AA4F1929F616E09eCaEf4a63e32e
```

**Wallets**
```
deployer / customer   0x3EAEd122e4889403669D5D358b9638A450a97a09   (~0.08 ETH Base, 20 USDC)
bridge (settler)      0xDfa6Fb3a2Cefee2Dd59a5E0569c2c960Bf0c78c6   (0.02 ETH Base)
provider (user-owned) 0xfcef676044658B5402f590daBe9E04A0F640522f
```

**GenLayer studio-dev** — 9 contracts, all present. Note `AgreementRegistry` was redeployed this
session to `0x32e566AC403428E063bF9E567cbF03215667052E`; the old recorded address was wrong.

**Live escrow** `0xe17495037ea4be7af7fa6bcbe5d7d582e88bb81027be1851bcb38d21f34093cf` — 20 USDC,
25% cap, provider/customer bound, untouched.

## Services

```
praest-api            https://praest-api-production.up.railway.app          Online
praest-worker         (3 sweeps green)                                      Online
praest-bridge         (four-state tracking, direct mode)                    Online
praest-demo-provider  https://praest-demo-provider-production.up.railway.app Online, mode=ok
praest-web            https://praest-web.vercel.app                          Online, WorkOS login works
```

Demo provider admin token is in `.env.local` as `DEMO_ADMIN_TOKEN`. Modes:
`POST /admin/mode?token=…&mode=ok|error|slow|down`, and
`POST /admin/maintenance?token=…&announcedAt=…&startsAt=…&endsAt=…&reason=…`.

## The plan I recommended for the next session

1. **Trace `finalize()` → `SettlementEngine.build()` → `authorizeOutbox()`** and pre-create any
   missing PRAEST-side records (see predicted failure above). Then finalize and settle — that
   closes Day 4.
2. **Open the other four resolver cases immediately and in parallel.** Appeal windows are one hour
   each and run concurrently, so opening them together settles Day 5 in one batch instead of five
   serial hours. This is the single biggest time saver available.
3. Only then Day 6 surface work — the receipt page should be built after seeing what a real settled
   receipt actually contains, not guessed at.

Still deliberately cut: TLSNotary, Internet Court adapter, Solana, zkSync, LayerZero, Stripe,
Temporal, and the five extra EVM chains.

## Known open items

- **R2 object storage is unreachable** (TLS handshake failure). Evidence is hash-only and records
  `objectStorage: "unavailable"` honestly. Fix the endpoint or accept hash-only for the demo.
- **`DATABASE_URL` password contains unescaped `@`** — works with `pg`, fails strict URL parsing.
  Worth percent-encoding.
- **Privy CSP still lists `localhost:3000`.**
- Day 2's escrow used the labelled test token; Day 4's uses real USDC. Both paths proven.

## Timings measured (for the Day 7 script)

- Adjudication: **38 seconds** to `FINISHED_WITH_RETURN`
- Appeal window: **1 hour**

A two-minute demo cannot show a live decision *and* a live settlement. Show a pre-finalized case
settling, and submit a fresh one live to prove nothing is staged.
