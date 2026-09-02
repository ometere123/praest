# Security

## Implemented controls

- WorkOS authentication and organisation context.
- API-key hashing; raw keys are returned only on creation.
- Explicit permission checks on security/economic lifecycle endpoints.
- Tenant `organizationId` ownership on tenant-visible case/adjudication/settlement records.
- AES-256-GCM application encryption boundary for service/integration/webhook secrets.
- Rate-limiting boundary backed by Upstash when configured.
- Audit interceptor and audit log table.
- HTTPS-only monitoring/webhook destinations with private/loopback/link-local/metadata network rejection.
- DNS-rebinding mitigation by connecting to vetted IP while preserving TLS SNI/hostname verification.
- Bounded response bodies/timeouts.
- Immutable agreement-version hashing.
- Evidence bundle/manifests hashed before adjudication.
- GenLayer finality gate before settlement construction.
- Deterministic payout construction from policy, not arbitrary LLM addresses.
- Hyperlane Mailbox/origin/sender/target/finality/expiry checks.
- Business-level `instructionId` replay protection.
- Destination-local beneficiary/remedy/balance enforcement.
- Non-custodial customer funding plus independent on-chain confirmation.
- Stripe webhook signature validation/raw body support.
- Webhook delivery signing/retry state.

## Required operational controls

Before internet exposure:

1. Use a strong random `PRAEST_DATA_ENCRYPTION_KEY_BASE64` (32 raw bytes) and store it in managed secrets/KMS.
2. Use independent keys for StudioNet, EVM deployer, relayer, validators and Solana authority.
3. Restrict Control Plane access with WorkOS roles/MFA; require recent auth for highly sensitive operator actions.
4. Configure real Hyperlane multisig/aggregation security. Do not replace it with test ISM code.
5. Keep route pause/emergency controls available and test recovery runbooks.
6. Configure database backups and periodically restore-test them.
7. Enable R2 retention/object-lock policies appropriate for evidence.
8. Restrict AWS probe IAM to logs and the exact probe runtime needs.
9. Keep static egress allowlists for private enterprise monitoring where required.
10. Run all CI/security jobs below on every merge.

## CI security gates

The repository includes workflows/configuration for:

- dependency installation and TypeScript checks
- GenLayer Python syntax/lint where tool available
- Foundry build/test/fuzz/invariants
- Rust/Solana cargo check/test
- CodeQL
- Semgrep
- Gitleaks
- Trivy filesystem scan
- Slither for Solidity when available
- SBOM generation

A missing native tool in a developer workstation is not a pass; `npm run doctor` reports it separately.

## Threats explicitly considered

- cross-tenant reads/writes
- forged API keys / privilege escalation
- leaked provider credentials
- SSRF / cloud metadata access / DNS rebinding
- evidence tampering
- prompt injection in external evidence
- provisional GenLayer result settled as final
- relay fabrication
- bad Hyperlane sender/origin
- fake/permissive ISM
- duplicate message delivery
- duplicate business settlement
- arbitrary beneficiary injection
- excess remedy allocation
- chain/asset mismatch
- webhook replay/failure
- stale/unknown destination state

Prompt/evidence text must always be treated as untrusted data; GenLayer prompts instruct validators to judge supplied evidence and never follow instructions embedded inside evidence as system policy.
