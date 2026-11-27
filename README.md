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

Contract implemented and tested. **Not deployed.** No contract id exists yet and
none should appear in this repo until `stellar contract deploy` prints one.

- 32 tests: happy paths, auth failures, bounds, pagination, id monotonicity.
- `cargo test`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`
  all clean.
- `stellar contract build` has not been run here — no Stellar CLI or wasm target
  in this environment. That is the first thing to do before deploying.

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
