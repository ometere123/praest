#!/usr/bin/env bash
set -euo pipefail
: "${SOLANA_KEYPAIR_PATH:?SOLANA_KEYPAIR_PATH required}"
: "${PRAEST_STUDIO_GATEWAY_ADDRESS:?PRAEST_STUDIO_GATEWAY_ADDRESS required}"
RPC="${SOLANA_TESTNET_RPC_URL:-https://api.testnet.solana.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/contracts/solana"
cargo build-sbf
PROGRAM_SO="target/deploy/praest_settlement_solana.so"
if [[ ! -f "$PROGRAM_SO" ]]; then
  # cargo-build-sbf names artifacts from the crate; tolerate underscore/hyphen normalization differences.
  PROGRAM_SO="$(find target/deploy -maxdepth 1 -name 'praest*settlement*.so' | head -1)"
fi
[[ -n "${PROGRAM_SO:-}" && -f "$PROGRAM_SO" ]] || { echo "Solana program artifact not found" >&2; exit 1; }
solana config set --url "$RPC" --keypair "$SOLANA_KEYPAIR_PATH" >/dev/null
OUTPUT="$(solana program deploy "$PROGRAM_SO" 2>&1 | tee /dev/stderr)"
PROGRAM_ID="$(printf '%s\n' "$OUTPUT" | sed -nE 's/.*Program Id: ([1-9A-HJ-NP-Za-km-z]+).*/\1/p' | tail -1)"
if [[ -z "$PROGRAM_ID" ]]; then
  echo "Could not parse deployed Program Id. Set PRAEST_SOLANA_PROGRAM_ID and run npm run solana:init." >&2
  exit 1
fi
cd "$ROOT"
PRAEST_SOLANA_PROGRAM_ID="$PROGRAM_ID" npx tsx scripts/solana-init.ts | tee deployments/solana-init.json
node -e 'const fs=require("fs");const p="deployments/solana.json";const init=JSON.parse(fs.readFileSync("deployments/solana-init.json","utf8"));fs.writeFileSync(p,JSON.stringify({network:"solanatestnet",deployedAt:new Date().toISOString(),...init},null,2));console.log("wrote "+p)'
