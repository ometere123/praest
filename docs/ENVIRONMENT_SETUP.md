# Environment Setup

Copy `.env.example` to `.env.local` for local work. Railway/Vercel/provider deployments should set the same values through managed secrets rather than committing files.

## Secret generation

```bash
# 64-character internal service token
openssl rand -hex 32

# 32-byte AES key as base64
openssl rand -base64 32
```

Use the AES key as `PRAEST_DATA_ENCRYPTION_KEY_BASE64`.

## Environment ownership

- `apps/web`: WorkOS public/client values, `NEXT_PUBLIC_PRIVY_APP_ID`, server `PRAEST_API_URL`, optional public Solana Testnet RPC.
- `apps/api`: database/provider credentials, data encryption key, WorkOS verification/JWKS, Privy server secret, billing/evidence credentials.
- `apps/worker`: Temporal + internal API token.
- `apps/bridge`: database, StudioNet RPC/key for reads/writes as required, zkSync RPC/relayer key, destination RPCs.
- `apps/probe`: internal API URL/token only.
- `apps/relayer`: Hyperlane key/config/RPCs.

Never expose API keys/private keys through `NEXT_PUBLIC_*` variables.
