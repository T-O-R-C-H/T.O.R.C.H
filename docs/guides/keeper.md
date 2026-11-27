# Run a keeper

The keeper is a long-running Node process. It reads the registry, checks TTLs and
extends what is due. It needs a funded Stellar account whose address is the
`keeper()` configured on the contract.

## 1. Check you are the keeper

```bash
stellar contract invoke --id <CONTRACT_ID> --source admin --network testnet -- keeper
```

If that address is not your signer, `report` will fail on every pass. The keeper
refuses to start in that case rather than spinning quietly.

## 2. Configure

```bash
cp .env.example .env
```

| Variable | Meaning |
| --- | --- |
| `STELLAR_RPC_URL` | RPC endpoint, e.g. `https://soroban-testnet.stellar.org` |
| `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` for testnet |
| `REGISTRY_CONTRACT_ID` | the deployed registry (`C...`) |
| `KEEPER_SECRET_KEY` | signing key (`S...`). Server-side only |
| `DATABASE_URL` | optional Postgres for extension history |
| `ALERT_WEBHOOK_URL` | optional webhook for extended/failed events |
| `KEEPER_POLL_SECONDS` | poll interval, default 30 |

## 3. Run

```bash
pnpm install
pnpm --filter @torch/indexer start
```

One pass looks like this:

```json
{"scanned":1,"due":0,"extended":0,"failed":0,"msg":"pass complete"}
```

`due` counts policies at or below their threshold. `extended` counts successful
extensions. A pass that logs `scanned: 12, due: 0` is healthy. A pass that logs
`due: 3, extended: 0, failed: 3` means your account cannot pay — check the XLM
balance first, then the RPC endpoint.

## 4. Shutdown

`SIGINT`/`SIGTERM` let the current pass finish, then exit. Do not `kill -9` mid
pass: a half-sent transaction is fine (it either lands or it does not), but you
lose the report and the history row.

## 5. Keeping it alive

- **Rent.** Extensions spend XLM. A keeper that runs out stops silently. Watch the
  account balance; a warning threshold is on the roadmap.
- **Alerts.** Point `ALERT_WEBHOOK_URL` at a channel someone reads. The keeper
  posts on every extension and every failure, and never lets a dead webhook block
  an extension.
- **Hosting.** It is a worker, not a web service: see `render.yaml` in the app
  repo for a blueprint with a Postgres instance beside it.

## What the keeper will not do

- Extend a paused policy.
- Touch an archived contract (restore is a different operation).
- Retry a transaction the ledger rejected; a rejection is a result, not a glitch.
- Report an extension it did not make.
