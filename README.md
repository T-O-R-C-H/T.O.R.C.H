# Torch

**A registry that stops Soroban contracts from going dark.**

[![ci](https://github.com/T-O-R-C-H/T.O.R.C.H/actions/workflows/ci.yml/badge.svg)](https://github.com/T-O-R-C-H/T.O.R.C.H/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![network](https://img.shields.io/badge/network-testnet-blueviolet)](https://stellar.expert/explorer/testnet/contract/CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P)
[![soroban-sdk](https://img.shields.io/badge/soroban--sdk-29.0.1-informational)](https://crates.io/crates/soroban-sdk)
[![stellar-cli](https://img.shields.io/badge/stellar--cli-30.0.1-informational)](https://github.com/stellar/stellar-cli)

## The problem

A Soroban contract is a set of ledger entries. Each entry has a TTL. When the TTL
runs out the entry is archived: the contract stops answering, balances sit
unreachable, and recovery needs a `RestoreFootprintOp` from whoever notices.

Extension is permissionless on purpose. CAP-0046-12:

> Any account may issue a TTL extension or restoration for any entry without
> authorization. TTL extension and restoration is defined to always be beneficial
> to the owner of the entry and can not be used maliciously.

Permissionless is the right protocol design, and it creates a public good with no
owner. Teams assume someone else's keeper is watching, or trust a cron job on a
laptop that eventually stops.

Second: Soroban RPC can fetch a specific ledger key but cannot enumerate a
contract's entries. A generic watchdog cannot discover what to watch. The list
has to be declared. That is why this is a contract and not a config file.

## How it works

```
register ──▶ Active ──▶ (pause ⇄ resume) ──▶ remove
                 │
                 └─▶ keeper reads list(), extends instance + code, report()s back
```

1. A contract or its deployer registers a watch policy: target, threshold,
   extend target.
2. A keeper reads the registry over RPC, reads the live TTL of the instance
   **and** the code entry, and extends whichever expires first.
3. The keeper reports the extension, so `last_reported` is public history.

## Deployed

| | |
| --- | --- |
| Network | Stellar **testnet** (mainnet not deployed, unaudited) |
| Contract | `CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P` |
| Explorer | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P) |
| Wasm hash | `a62609d9f3e1ed17556863690ab7812d19fea8b8ef85528c1ad0d1025c8c9c3b` |
| Wasm size | 9,814 bytes, 15 exported functions |

Proven end to end, not just compiled: extension transaction
`f7606e257bedce6d0d9a2310f482bfd43c172f7c29af351041af823bd9748c43`, report
transaction `acf8805445fd0ac296cf935eddace59c5dfea17e58c1915161c75e43d4e00a2b`,
and `last_reported` read back from chain as `5951776`.

## Quick start

```bash
rustup target add wasm32v1-none
curl -fsSL https://github.com/stellar/stellar-cli/install.sh | bash   # 30.0.1

cargo test                          # 32 tests
cargo fmt --check
cargo clippy --all-targets -- -D warnings
stellar contract build             # cargo build for wasm is blocked from SDK 28
```

Deploy your own:

```bash
export ADMIN=G... SOURCE=deployer
./scripts/deploy_testnet.sh         # builds, deploys, inits, prints the contract id
```

Register a policy:

```bash
stellar contract invoke --id <CONTRACT_ID> --source deployer --network testnet -- \
  register --owner G... --target C... --threshold 1000 --extend_to 2000000
```

## Architecture

```
contracts/registry/src/
  lib.rs        contract surface, wiring only
  types.rs      DataKey, WatchPolicy, Error, constants
  storage.rs    typed storage; every write extends that entry's TTL
  admin.rs      init, admin, keeper
  register.rs   register + read paths (paginated list)
  policy.rs     update, pause, resume, remove (owner-only)
  report.rs     keeper reports
  events.rs     9 contractevent structs
```

One contract, one responsibility: hold the list of what should stay alive. The
keeper lives in the app repo and needs no privilege on chain — extension is
permissionless; only `report` is keeper-gated.

Non-goals for v1, with reasons: no payments (a contract cannot read another
contract's TTL, so keeper claims cannot be verified on-chain), no persistent
data-key watching (keys cannot be enumerated, v2 declares them), no automated
upgrades (the client contract must hold an admin itself).

## Roadmap

See [`ROADMAP.md`](ROADMAP.md). Current position: M1 complete, M2 (dashboard)
not started.

## Documentation

- [`SPEC.md`](SPEC.md) — authoritative behaviour spec
- [`docs/contract-reference.md`](docs/contract-reference.md) — public surface
- [`SUBMISSION.md`](SUBMISSION.md) — what is deployed, proven and missing
- [`change.md`](change.md) — how this repo got here

## Maintainers

| Maintainer | Role | Contact |
| --- | --- | --- |
| [@Muyideen-js](https://github.com/Muyideen-js) | Founder, contract | GitHub issues |
| [@techAlhaji](https://github.com/techAlhaji) | Keeper and tooling | GitHub issues |

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md). Two rules that matter: `cargo fmt`,
`clippy -D warnings`, `cargo test` and `stellar contract build` must pass, and a
contract change without a `SPEC.md` change will be sent back.

Security: [`SECURITY.md`](SECURITY.md). This contract is **unaudited**. Report
privately, not in an issue.

## Contributors

<a href="https://github.com/T-O-R-C-H/T.O.R.C.H/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=T-O-R-C-H/T.O.R.C.H" alt="contributors" />
</a>

## Licence

MIT — see [`LICENSE`](LICENSE).
