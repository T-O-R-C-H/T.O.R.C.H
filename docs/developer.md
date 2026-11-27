# Developer guide

## Repositories

| Repo | Contents |
| --- | --- |
| `T-O-R-C-H/T.O.R.C.H` | the registry contract (this repo), spec, deploy script, docs |
| `torch-app` | `packages/sdk`, `indexer`, and the planned `apps/web` |

## Contract

```bash
rustup target add wasm32v1-none
curl -fsSL https://github.com/stellar/stellar-cli/install.sh | bash   # 30.0.1

cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
stellar contract build
```

`cargo build` for wasm is blocked from `soroban-sdk` 28 onward; use
`stellar contract build`.

Layout: `lib.rs` is wiring only, one module per concern (`types`, `storage`,
`admin`, `register`, `policy`, `report`, `events`), tests in `src/test.rs`.

## SDK

Install from the app repo. All reads simulate, all writes sign and poll.

```ts
import { Keypair } from '@stellar/stellar-sdk'
import {
  contractFor, serverFor, readContractTtl, extendContractTtl, remainingFor,
} from '@torch/sdk'

const network = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  contractId: 'C...',
}

const server = serverFor(network)
const contract = contractFor(network)

// TTL of the instance and the code, whichever expires first
const ttl = await readContractTtl(server, 'C...')
console.log(ttl.archived, ttl.instanceLiveUntil, ttl.wasmHash, remainingFor(ttl))

// Extend to a target. Returns { status: 'already' } when nothing is needed.
const result = await extendContractTtl({
  server,
  networkPassphrase: network.networkPassphrase,
  signer: Keypair.fromSecret(process.env.KEEPER_SECRET_KEY!),
  target: 'C...',
  extendTo: 2_000_000,
})
```

### RPC patterns that matter

- **Reads** use a throwaway source account with sequence `0` and are never
  submitted. Reading costs nothing and needs no funded key.
- **Writes** go through `server.prepareTransaction` (simulation, footprint, fee),
  then sign, then `sendTransaction`, then poll `getTransaction` until `SUCCESS`
  or `FAILED`. Never hardcode a fee.
- **Contract errors** arrive as `HostError: Error(Contract, #5)`. `describeError`
  maps the code to a sentence; the codes are in the contract enum and in the
  reference page.

## Environment

| Variable | Used by |
| --- | --- |
| `STELLAR_RPC_URL` | keeper, dashboard |
| `STELLAR_NETWORK_PASSPHRASE` | keeper, dashboard |
| `REGISTRY_CONTRACT_ID` | keeper |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | dashboard bundle |
| `KEEPER_SECRET_KEY` | keeper only, never `NEXT_PUBLIC_` |
| `DATABASE_URL` | keeper (optional) |
| `ALERT_WEBHOOK_URL` | keeper (optional) |
| `KEEPER_POLL_SECONDS` | keeper |

## Testing

- Contract: `cargo test` — 32 tests, one per behaviour plus auth failures.
- App: `pnpm -r test` — TTL math, error decoding, work selection.
- Live: `REGISTRY_CONTRACT_ID=C... KEEPER_SECRET_KEY=S... pnpm prove -- --force`
  extends a real contract and reports it.

## Docs site

```bash
pip install mkdocs-material
mkdocs serve     # http://127.0.0.1:8000
mkdocs build --strict
```

Deployed to GitHub Pages by `.github/workflows/docs.yml` on every push that
touches `docs/` or `mkdocs.yml`.
