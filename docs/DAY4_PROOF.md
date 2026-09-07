# Day 4 — one real case, end to end

Recorded 2026-09-07. Every value below was read back from a live system, not asserted.

## The scenario

The scenario from the pitch, run for real: an outage happens, the provider claims it was scheduled
maintenance, and the notice turns out to have been short. That gap is the only part that needs
judgement — everything else is arithmetic.

| | |
|---|---|
| Provider | `https://praest-demo-provider-production.up.railway.app` (real service, real TLS) |
| Agreement | 99.9% availability, maintenance excluded **only with 48h notice**, remedy tiers 10% / 25%, cap 25% |
| Escrow | **20 USDC** (real Circle testnet USDC), Base Sepolia |
| Provider address | `0xfcef676044658B5402f590daBe9E04A0F640522f` |
| Customer address | `0x3EAEd122e4889403669D5D358b9638A450a97a09` |

## What actually happened

**1. Baseline, healthy.** `serviceStatus: UP`, HTTP 200, TTFB 11.99ms, response digest
`8eff3c40ab07…`. Real timings from a real request.

**2. The provider published a maintenance notice** claiming the window was scheduled —
`announcedAt 2026-09-05T21:09:15Z` for a window starting `2026-09-07T06:09:15Z`.
**33 hours of notice, against a 48-hour requirement.**

**3. The service was broken for real.** Not a flag: the process destroyed the socket. Observed
from four regions:

```
us-east       DOWN | collector OK | 502
eu-west       DOWN | collector OK | 502
ap-southeast  DOWN | collector OK | 502
sa-east       DOWN | collector OK | 502
```

`collectorStatus: OK` in all four is the point — the collectors were healthy, so this is a service
failure, not a measurement failure. Collector failure is not service failure (`AGENTS.md`).

**4. Evidence hashed and committed.** Three records, each SHA-256'd:

| Evidence | sha256 |
|---|---|
| Multi-region outage observations | `0x1015dd7d0427318f9938e114f6ad76ab956635fe907adfae3471de3a12e082e2` |
| Provider status page snapshot | `0x1696c6f97a455dd619b1ea353f304b746546f006257b30305ce17ab0f5b9ccea` |
| Healthy baseline | `0xfd4c30491ca14fe59a7b6800ad12b5c36d67c9d5b812a53ed00f373152917b08` |

Bundle `337db6b5-d21b-441d-91c6-de661be47c46`, locked. Locking called **EvidenceAssessor** on
GenLayer for an independent sufficiency judgment.

Every item carries `verificationStatus: "unverified"` — provenance-labelled, not TLSNotary-verified.
Stated, not hidden. Object storage was unreachable during the run, so provenance also records
`objectStorage: "unavailable"` with the reason; the integrity commitment is the hash, which is
computed before upload, so the evidence remains admissible.

**5. GenLayer decided.** Case `f1e077b0-1cc4-4cd3-aed0-f63c823043a4`.

```
contract   0xAB67b705917Bb275af830d5015FF20aD5C2558ca   (ServiceAssuranceResolver)
tx         0x8b09384dd423efe94ebaccbd1df90aea7df8a23bae0da3be4c2f39ce7a0ca3c1
status     accepted
execution  FINISHED_WITH_RETURN
elapsed    38 seconds
```

The verdict:

```json
{
  "outcome": "breached",
  "reason_code": "MAINTENANCE_NOTICE_INSUFFICIENT",
  "remedy_bps": 1000,
  "liability": [{"party": "provider", "bps": 1000}],
  "policy_version": 1
}
```

Its reasoning, verbatim from chain:

> "The agreement requires a minimum of 48 hours advance notice for maintenance windows to be
> excluded from availability calculations. The provider's own status page (directly fetched)
> confirms announcedAt 2026-09-05T21:09:15Z and startsAt 2026-09-07T06:09:15Z — a gap of exactly 33
> hours, well short of the 48-hour threshold... Therefore the maintenance exclusion does not apply."

**The validators fetched the provider's status page themselves.** They did not take PRAEST's word
for the notice timestamp, and they did not take the provider's word either. That is the entire
reason GenLayer is in this architecture rather than a single model call.

They also picked the *first* remedy tier — 1000 bps, not the 2500 bps cap — because availability
fell below 99.9% but not below 99%. The tier logic was applied, not just the maximum.

**6. Settlement was refused, correctly.**

```
attempted finalize at 06:29:44Z, appeal deadline 07:29:03Z
-> "appeal window still open"
-> escrow balance unchanged: 20000000
```

`ACCEPTED` is provisional. An accepted decision can still be appealed and recomputed, so PRAEST
will not move money against one. This is the invariant from `AGENTS.md`, enforced in code and
demonstrated live rather than asserted in a README.

## Measured, for the Day 7 script

- Adjudication: **38 seconds** from API call to `FINISHED_WITH_RETURN`
- Appeal window: **1 hour** (`acceptedAt` → `appealDeadline`)

The demo cannot show a live decision *and* a live settlement inside two minutes. Show a
pre-finalized case settling, and submit a fresh one live to prove it is not staged.

## Bugs this run surfaced

Four, all real, all pre-existing, all fixed:

1. `AgreementRegistry` was missing on studio-dev — the recorded address was wrong, almost certainly
   from the mid-batch RPC failure during the original deploy. Redeployed to
   `0x32e566AC403428E063bF9E567cbF03215667052E`.
2. The ClickHouse `praest` database and `measurements` table had never been created, so every
   monitor run returned 500 after collecting a perfectly good measurement.
3. Evidence creation died on an R2 TLS handshake failure, taking the whole request with it. Object
   storage is durability, not admissibility — it no longer blocks adjudication.
4. `POST /v1/evidence` always returned 500: the row was returned as-is and `sizeBytes` is a bigint,
   which `JSON.stringify` refuses. The evidence was written but the caller never learned its id.
