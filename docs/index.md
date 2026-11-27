# Torch

A registry that stops Soroban contracts from going dark.

## The problem

A Soroban contract is a set of ledger entries. Each entry has a TTL. When the TTL
expires the entry is **archived**: the contract stops answering, its balances
become unreachable, and recovery needs a `RestoreFootprintOp` from someone who
notices in time.

Extension is permissionless by design. From CAP-0046-12:

> Any account may issue a TTL extension or restoration for any entry without
> authorization. TTL extension and restoration is defined to always be beneficial
> to the owner of the entry and can not be used maliciously.

That is the right protocol design, and it produces a public good with no owner.
Every team assumes someone else's keeper is watching, or trusts a cron job on a
laptop that will eventually stop.

The second half of the problem is discovery: Soroban RPC can fetch a specific
ledger key but cannot enumerate the entries a contract owns. A generic watchdog
has no way to learn what to watch.

## The mechanism

Torch makes the responsibility explicit and the list public.

1. A contract, or the account that deployed it, registers a **watch policy** on
   chain: the target contract, the threshold at which to act, and the TTL to
   restore.
2. A **keeper** reads the registry, reads the live TTL of the target's instance
   and code entries, and extends whichever is closer to expiry.
3. The keeper **reports** the extension, so `last_reported` is public history
   rather than a promise in a status page.

```
register ──▶ Active ──▶ (pause ⇄ resume) ──▶ remove
                 │
                 └─▶ keeper reads list(), extends, report()s back
```

## Where it runs

| | |
| --- | --- |
| Network | Stellar testnet (mainnet not deployed) |
| Contract | `CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P` |
| Explorer | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P) |
| Wasm hash | `a62609d9f3e1ed17556863690ab7812d19fea8b8ef85528c1ad0d1025c8c9c3b` |

## What is honest about its state

- **Unaudited.** No Soroban Audit Bank review. Testnet only.
- **No payments.** A contract cannot read another contract's TTL, so a keeper's
  claim cannot be verified on chain. Paid claims would be trust-based.
- **No dashboard yet.** The keeper works; the UI does not exist.

Read [How it works](how-it-works.md) for the mechanics, or
[Register a contract](guides/register.md) to get started.
