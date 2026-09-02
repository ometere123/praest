# PRAEST Trust Model

## What PRAEST trusts

### WorkOS
Authenticates human/enterprise users and supplies organisation context. PRAEST maps WorkOS identities to internal UUIDs and enforces organisation-scoped database access and permissions.

### Privy
Provides embedded wallet ownership/signing for authenticated identities. The application does not treat the wallet as the account identity; a user may link multiple wallets and agent/system wallets are distinct principals.

### PRAEST control plane
Stores policy, evidence metadata, cases and workflow state. It may sponsor GenLayer fees and relay StudioNet decisions, but it may not override a finalized GenLayer decision or invent settlement beneficiaries outside the funded escrow policy.

### GenLayer StudioNet
Owns consequential evidence-based judgment. `ACCEPTED` is provisional. PRAEST authorizes settlement only after `FINALIZED` and a successful execution result.

### Studio relay
Because StudioNet has no general EVM execution, `apps/bridge` is a deliberate trust boundary. It must read the canonical StudioNet `DecisionOutbox`, cross-check payload/instruction/decision/destination against PRAEST state, and dispatch exactly those bytes. It does not hold customer settlement assets.

### Hyperlane
Hyperlane relayers provide liveness/transport. They are not trusted to decide authenticity. The destination Mailbox selects an actual Interchain Security Module (ISM) and verifies metadata before invoking the recipient.

Production contracts do not implement an always-true ISM and do not advertise `ModuleType.Unused` as security. Unit tests may use an explicit mock ISM only inside test code.

### Destination escrow/program
Destination state is the final economic authority. The receiver/program validates:

- Hyperlane process/Mailbox authority
- trusted origin and sender
- destination/target binding
- finality timestamp and expiry
- application instruction replay
- local agreement/escrow identity
- asset/mint
- provider/customer beneficiaries
- customer remedy cap
- remaining balance

## Replay model

PRAEST intentionally has multiple replay layers:

1. Hyperlane `messageId` / Mailbox delivery tracking — transport replay protection.
2. `processedInstructions[instructionId]` or Solana escrow processed set — business instruction replay protection.
3. Escrow state and remaining balance — economic double-execution protection.

## Evidence trust

Evidence is provenance-labelled. A customer/provider upload is a claim input, not trusted truth. Preferred evidence is independently collected or validator-retrievable: PRAEST probe measurements, public APIs/status pages, validator-fetched web sources, TLS proofs, signed execution receipts and payment receipts.

A PRAEST collector failure returns `COLLECTOR_ERROR` / `UNKNOWN`, never `SERVICE_DOWN` merely because the collector could not observe the service.

## Key separation and rotation

Maintain separate secrets/keys for:

- WorkOS / Privy applications
- service/provider credentials encrypted with PRAEST data-encryption key
- StudioNet submitter
- zkSync gateway deployer/owner
- Hyperlane relayer
- Hyperlane validator/ISM configuration
- destination contract owners
- Solana program authority
- Stripe/Resend/R2/AWS/Temporal/etc.

Do not reuse a relayer key as a validator or contract-owner key. Rotation should update the route/ISM/gateway configuration before old keys are decommissioned.

## Recovery

- **Studio relay stuck:** no destination settlement occurs; a verified instruction can be safely redispatched because `instructionId` makes execution idempotent.
- **Hyperlane relayer stuck:** another permissionless relayer may deliver the same authenticated message.
- **Bad recipient/gateway deployment:** pause the affected route and deploy/register a new receiver; never silently redirect an already-authorized target.
- **Compromised relay:** destination origin/sender/escrow policy still restricts execution, but Studio relay compromise remains material and must trigger route pause/key rotation/reconciliation review.
- **Compromised validator/ISM:** pause the destination receiver/route, rotate the security module/validator set and review unfinalized/unreconciled messages.
- **Unknown settlement state:** do not retry economic execution blindly. Reconcile destination state first.
