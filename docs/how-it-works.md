# How it works

## Two clocks, not one

A deployed contract is more than one ledger entry, and the entries expire
separately:

| Entry | What it holds | Extended by |
| --- | --- | --- |
| Contract instance | the contract's instance storage | `extend_ttl` on instance storage, or `ExtendFootprintTTLOp` with the instance key |
| Contract code | the wasm | the same operation, with the code key |
| Persistent data entries | individual stored values | only individually, and only if their keys are known |

Inside a contract, `env.storage().instance().extend_ttl(...)` extends the
instance **and** the code together. Outside, an `ExtendFootprintTTLOp` touches
only the keys in its footprint — so a keeper that extends the instance and forgets
the code leaves a live instance pointing at archived code, which is still a dead
contract. The keeper in this project extends both.

Persistent data entries cannot be enumerated over RPC. That is why v1 covers the
instance and code only: knowing which data keys to extend requires the contract
to declare them. See the roadmap.

## Extension is relative, the registry is absolute

`ExtendFootprintTTLOp` extends a TTL **by** a number of ledgers. A watch policy
stores a TTL to **reach**. Passing one into the other overshoots: a policy asking
for 2,000,000 ledgers against a contract with 3,110,150 remaining adds two million
ledgers of rent and changes nothing useful.

The keeper computes the difference:

```
extendBy = max(0, policy.extend_to - remaining)
```

When `extendBy` is 0 it sends nothing. A keeper that keeps paying rent on a
healthy contract is a bug, not diligence.

## Policy lifecycle

```
        register
           │
           ▼
        ┌──────┐   pause   ┌────────┐
        │Active│ ────────▶ │ Paused │
        └──────┘ ◀──────── └────────┘
           │     resume
           │ remove
           ▼
      (deleted, id never reused)
```

- Ids come from a monotonic counter. `remove` deletes the policy but does not
  decrement the counter, so a stale link can never resolve to a different team's
  contract.
- `Paused` policies stay readable and keep their id. The keeper skips them.
- `last_reported` is 0 until the configured keeper records an extension.

## Who can do what

| Action | Authorized by |
| --- | --- |
| register, update, pause, resume, remove | the policy's `owner` |
| set_keeper, transfer_admin | the contract `admin` |
| report | the configured `keeper` |
| extend a TTL | **nobody** — permissionless under CAP-0046-12 |
| read anything | anyone |

`report` is a claim, not a proof: it is a signed operational log by a known key.
This is exactly why there is no payment layer — a claim nobody can verify should
not be worth money.

## What it costs

Two costs, both in XLM, both paid by the account that submits the extension:

- **Transaction fee** — per transaction, set by network conditions.
- **Rent** — proportional to the size of the entries and the length of the
  extension.

Protocol ceilings that bound the spend: `MAX_EXTEND = 3,110,400` ledgers, about
180 days at the 5-second ledger close. The exact fee and rent for a given target
are not fixed numbers you can quote from a document — measure them:

```bash
stellar contract extend --help
# or simulate the operation before signing and read the resulting resource fee
```

A policy with `threshold = 1000` and `extend_to = 2000000` acts when the contract
is roughly 83 minutes from archival and brings it back to about 115 days.

## Failure modes the design accepts

- **The keeper stops.** Nothing extends. The registry is only a list; it cannot
  act on itself. This is why `last_reported` exists: silence is visible.
- **The registry itself archives.** It extends its own instance TTL on every write,
  but a registry nobody touches will still expire. Registering it in itself is
  legal and is what the testnet deployment does for policy `0`.
- **A target is already archived.** Extension cannot fix that; recovery needs a
  restore, which the keeper refuses to attempt (`scripts/restore.sh` does not
  exist yet — see roadmap).
- **Two keepers extend at once.** Harmless: the second one re-reads, finds
  nothing due, and sends nothing.
