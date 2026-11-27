# Vigil

A registry for Soroban contracts that should not be allowed to archive.

Soroban ledger entries expire. When a contract's instance and code entries pass
their TTL they are archived: the contract stops answering, balances stay
unreachable, and recovery needs a `RestoreFootprintOp` from whoever notices.
Extension is deliberately permissionless (CAP-0046-12), which is the right
protocol design and also means **nobody is responsible for it**.

Vigil makes responsibility explicit. A team registers a watch policy — which
contract, how close to archival to act, how far to extend — and a keeper reads
that registry and extends before anything archive.

The registry exists because Soroban RPC cannot enumerate a contract's ledger
entries. A generic watchdog has no way to discover what to watch, so the list has
to be declared by someone who knows. That is this contract.

```
register ──▶ Active ──▶ (pause ⇄ resume) ──▶ remove
                 │
                 └─▶ keeper reads list(), extends TTL, report()s back
```

## Status

Deployed on Stellar **testnet** and exercised end to end.

| | |
| --- | --- |
| Contract id | `CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P` |
| Wasm hash | `a62609d9f3e1ed17556863690ab7812d19fea8b8ef85528c1ad0d1025c8c9c3b` |
| Wasm size | 9,814 bytes, 15 exported functions |
| Explorer | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P) |

Testnet transactions:

| Step | Transaction |
| --- | --- |
| deploy | `48adec032d52f12a00b491df11005014d6ec0d7109e6b7419506c2b35622d706` |
| init | `34430f179703e8554e9c5e221402c7d7c0ba9dfeded19bdccade0091e37b1abb` |
| set_keeper | `93e16c030cc59b46445c6d237779d2bc68c11dcd8e9eb1b6db8dfc8224b6de71` |
| first `register` | `9b50c5510abfe89e471553a0f5423a6ff5e1227f28ddf119fc96ce19b1dcb27e` |

Current testnet state: `count` is 1, and policy `0` watches the registry itself
(threshold 1,000 ledgers, extend to 2,000,000) — a live policy for the keeper to
exercise, not a mock.

- 32 tests: happy paths, auth failures, bounds, pagination, id monotonicity.
- `cargo test`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`
  clean.
- `stellar contract build` clean under stellar-cli 30.0.1.

**This is testnet only.** No mainnet deploy, no audit. The contract has not been
through the Soroban Audit Bank.

`SPEC.md` is the behaviour spec. Where code and spec disagree, the spec is the
bug report.

## Layout

```
Cargo.toml                     workspace
contracts/registry/
  src/lib.rs                   contract surface, wiring only
  src/types.rs                 DataKey, WatchPolicy, Error, constants
  src/storage.rs               typed storage, TTL extension on every write
  src/admin.rs                 init, admin, keeper
  src/register.rs              register + read paths
  src/policy.rs                update, pause, resume, remove
  src/report.rs                keeper reports
  src/events.rs                contractevent structs
  src/test.rs                  32 tests
scripts/deploy_testnet.sh
```

## Build and test

```bash
rustup target add wasm32v1-none
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
stellar contract build          # requires stellar-cli 30.0.1
```

From `soroban-sdk` 28 onward a plain `cargo build` for wasm fails by design; the
CLI strips unreachable spec entries after compiling. Use `stellar contract build`.

## Deploy

```bash
export ADMIN=G...              # admin address, funded on testnet
export SOURCE=deployer         # stellar keys name, must equal ADMIN to call init
./scripts/deploy_testnet.sh
```

The script prints `REGISTRY_CONTRACT_ID=...` at the end. Put that into the app
repo's `.env`; do not hand-edit a contract id anywhere.

## Non-goals for v1

- **No payments.** A contract cannot read another contract's TTL, so a keeper's
  claim that it extended something cannot be verified on-chain. Paid claims would
  be trust-based, which is worse than not offering them.
- **No persistent data-key watching.** Each key must be declared; v1 watches the
  instance and code entries, which is where "contract went dark" usually starts.
- **No automated upgrades.** Upgrading requires the client contract to hold an
  admin and call `update_current_contract_wasm` itself. That is their code, not a
  service performed from outside.

## Licence

MIT.
