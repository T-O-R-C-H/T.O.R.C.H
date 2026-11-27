# Roadmap

Status is stated as it is, not as it is hoped to be. A milestone is only "done"
when it is deployed and exercised.

## M0 — Contract (done)

Spec, implementation, tests, testnet deployment.

- [x] `SPEC.md` with storage, functions, auth, events, invariants
- [x] Registry contract, 15 functions, 32 tests
- [x] `cargo fmt`, `clippy -D warnings`, `cargo test`, `stellar contract build` clean
- [x] Deployed to testnet: `CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P`
- [x] `v0.1.0` tagged with the contract id in the body

## M1 — Keeper (done)

- [x] Typed SDK: reads by simulation, instance + code TTL lookup, all writes
- [x] Extension converts a TTL target into the ledger delta the op takes
- [x] Keeper loop: paginated scan, urgent-first, capped passes, graceful shutdown
- [x] Refuses to start when its signer is not `keeper()`
- [x] Proven against testnet: extension `f7606e25…`, report `acf8805…`
- [x] 27 app tests, both packages typecheck

## M2 — Dashboard (not started)

The product has no UI. This is the largest gap and the one a reviewer sees first.

- [ ] `apps/web`: register form with client-side bounds validation
- [ ] Policy list with live TTL countdown (instance and code, whichever is shorter)
- [ ] Policy detail: extension history from the indexer
- [ ] Wallet connection, owner-only controls (pause / resume / remove)
- [ ] Deployed, with the URL in `SUBMISSION.md`

Blocked on: nothing technical. It is work.

## M3 — Operational honesty (partly built, untested)

- [x] Optional Postgres history and webhook alerts (code only; never run against a DB)
- [ ] Verify the extension landed before reporting it
- [ ] Prometheus metrics: passes, extensions, failures, stroops spent
- [ ] Restore flow for already-archived contracts
- [ ] Runbook for a keeper whose rent balance is running out

## M4 — Multi-keeper (design needed)

Today one keeper is configured on chain. Extending is permissionless, so several
keepers *could* serve the same registry, but `report` is single-key and there is
no payment for the work.

- [ ] Decide: multiple reporting keepers, or one operator with redundancy
- [ ] Only then consider paid extensions. A contract cannot read another
      contract's TTL, so a claim cannot be verified on chain — payments need an
      off-chain attestation plus a dispute or bond design. Do not ship paid
      claims that cannot be checked.

## M5 — Mainnet (blocked)

Blocked on audit, not on code.

- [ ] Soroban Audit Bank review or equivalent
- [ ] Mainnet deploy with a real admin key held by more than one person
- [ ] Minimum keeper balance monitoring with paging alerts
- [ ] Load test against mainnet RPC rate limits

## Explicitly not on the roadmap

- Automatic contract upgrades. Upgrading requires the client contract to hold an
  admin and call `update_current_contract_wasm` itself. That is their code.
- Token or payment handling in the registry. Nothing here should ever hold funds.
- A branded "AI agent" layer. The value is the uptime, not the vocabulary.
