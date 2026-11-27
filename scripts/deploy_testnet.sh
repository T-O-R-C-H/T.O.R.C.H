#!/usr/bin/env bash
# Build, deploy and initialize the registry on a Stellar network.
# Requires: stellar-cli 30.0.1 and a funded SOURCE key on the target network.
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-deployer}"
ADMIN="${ADMIN:?set ADMIN to the admin address (it must be the SOURCE signer)}"
KEEPER="${KEEPER:-}"

WASM="target/wasm32v1-none/release/vigil_registry.wasm"

command -v stellar >/dev/null || {
  echo "stellar-cli not found. Install it first: https://github.com/stellar/stellar-cli" >&2
  exit 1
}

echo "==> building contract"
stellar contract build

[ -f "$WASM" ] || {
  echo "build produced no wasm at $WASM — check the crate name and target" >&2
  exit 1
}

echo "==> deploying to $NETWORK"
CONTRACT_ID="$(stellar contract deploy \
  --wasm "$WASM" \
  --source "$SOURCE" \
  --network "$NETWORK")"
echo "    deployed: $CONTRACT_ID"

echo "==> initializing (admin = $ADMIN)"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- init --admin "$ADMIN"

if [ -n "$KEEPER" ]; then
  echo "==> setting keeper ($KEEPER)"
  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- set_keeper --keeper "$KEEPER"
fi

cat <<EOF

Deployed and initialized.

REGISTRY_CONTRACT_ID=$CONTRACT_ID

Next:
  1. put REGISTRY_CONTRACT_ID and NEXT_PUBLIC_REGISTRY_CONTRACT_ID in the app repo
  2. verify the keeper's public key equals keeper() before starting it
  3. tag this commit with the contract id in the body
EOF
