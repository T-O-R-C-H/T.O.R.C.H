# Torch registry — specification

Matches the code in `contracts/registry/src`. If they disagree, the spec is the
bug report and the code gets fixed.

## Why this contract exists

Soroban entries are archived when their TTL lapses. CAP-0046-12:

> Any account may issue a TTL extension or restoration for any entry without
> authorization. TTL extension and restoration is defined to always be beneficial
> to the owner of the entry and can not be used maliciously.

Permissionless is correct protocol design, and it produces a public good with no
responsible owner. Second, Soroban RPC can fetch a specific ledger key but cannot
enumerate a contract's entries, so a generic keeper cannot discover what to watch.
The registry is the declared list. That is the entire justification for on-chain
state here; remove the contract and the keeper has no work queue.

## Lifecycle

`register` → `Active` → (`pause` → `Paused` → `resume` → `Active`) → `remove`.

- Ids come from a monotonic counter and are **never reused**. `remove` does not
  decrement `count`, so an old link 404s instead of resolving to another team's
  contract.
- A `Paused` policy stays readable and keeps its id; a keeper skips it.
- `last_reported` is 0 until the configured keeper calls `report`.

## Storage

| Key | Space | Type |
| --- | --- | --- |
| `Admin` | instance | `Address` |
| `Keeper` | instance | `Address` |
| `Count` | instance | `u32` |
| `Policy(u32)` | persistent | `WatchPolicy` |
| `OwnerIndex(Address)` | persistent | `Vec<u32>` |

Instance storage shares one TTL with the contract instance and its code, so one
`extend_ttl` keeps the registry itself alive. Every persistent write extends that
entry with the same `SELF_THRESHOLD` / `SELF_EXTEND_TO` pair.

## Types

```rust
pub struct WatchPolicy {
    pub id: u32,
    pub owner: Address,
    pub target: Address,
    pub threshold: u32,     // act when remaining TTL <= threshold
    pub extend_to: u32,     // extend so remaining TTL >= extend_to
    pub active: bool,
    pub registered_at: u32,
    pub last_reported: u32,
}

pub enum Error {
    AlreadyInitialized = 1, NotInitialized = 2, Unauthorized = 3,
    PolicyNotFound = 4, ThresholdOutOfRange = 5, TargetOutOfRange = 6,
    ExtendTooLarge = 7, LimitOutOfRange = 8, TooManyPolicies = 9,
    ReportInFuture = 10,
}
```

`Unauthorized`, `TargetOutOfRange` and `LimitOutOfRange` are reserved: auth
failures surface as the host's own error, and `list` clamps its limit rather than
rejecting it. They are kept in the enum so the numbering never shifts.

Constants: `MIN_THRESHOLD = 100`, `MAX_EXTEND = 3_110_400` (~180 days of 5s
ledgers; confirm the protocol's current `maxEntryTTL` at deploy),
`MAX_POLICIES_PER_OWNER = 20`, `LIST_LIMIT_MAX = 50`,
`SELF_THRESHOLD = 518_400`, `SELF_EXTEND_TO = 3_110_400`.

## Functions

| Function | Parameters | Returns | Auth |
| --- | --- | --- | --- |
| `init` | `admin: Address` | `Result<(), Error>` | `admin` |
| `admin` | — | `Result<Address, Error>` | — |
| `keeper` | — | `Result<Address, Error>` | — |
| `set_keeper` | `keeper: Address` | `Result<(), Error>` | admin |
| `transfer_admin` | `new_admin: Address` | `Result<(), Error>` | admin |
| `count` | — | `u32` | — |
| `register` | `owner, target, threshold, extend_to` | `Result<u32, Error>` | `owner` |
| `get` | `id: u32` | `Result<WatchPolicy, Error>` | — |
| `list` | `page, limit` | `Vec<WatchPolicy>` | — |
| `list_by_owner` | `owner: Address` | `Vec<WatchPolicy>` | — |
| `update` | `id, threshold, extend_to` | `Result<(), Error>` | policy owner |
| `pause` / `resume` / `remove` | `id: u32` | `Result<(), Error>` | policy owner |
| `report` | `id, extended_at` | `Result<(), Error>` | keeper |

`admin()` and `keeper()` return `NotInitialized` rather than a sentinel address,
because there is no zero address in Soroban.

### Rules

- `register` rejects `threshold < MIN_THRESHOLD`, `extend_to <= threshold`
  (`ThresholdOutOfRange`), and `extend_to > MAX_EXTEND` (`ExtendTooLarge`). It
  rejects a 21st policy for one owner (`TooManyPolicies`).
- `register` does not deduplicate targets. Two owners may watch the same contract;
  a contract may watch itself.
- `update`, `pause`, `resume` and `remove` authorize the **policy owner** — never
  the admin, never the target.
- `report` authorizes the configured keeper and rejects `extended_at` greater than
  the current ledger sequence (`ReportInFuture`).
- `list` clamps `limit` into `1..=50`, returns an empty vector past the end, and
  skips ids removed after the counter advanced.
- Read functions never panic on a missing policy; `get` returns `PolicyNotFound`.
- Every mutating function extends instance TTL; every persistent write extends
  that entry.

### Function → user flow

| Function | The step it serves |
| --- | --- |
| `init`, `admin`, `transfer_admin`, `set_keeper` | Deploy and ops handover |
| `register` | A deployer adds their contract on the dashboard |
| `list`, `count` | Keeper pulls its work queue, paginated |
| `get` | Dashboard countdown for one policy |
| `list_by_owner` | Dashboard "my contracts" |
| `update` | Owner changes how early the keeper acts |
| `pause`, `resume`, `remove` | Pre-launch, holidays, abandonment |
| `report` | Keeper records an extension so history is public |

## Events

`#[contractevent]` structs in `src/events.rs`: `Initialized` (`admin` topic),
`KeeperSet` (`keeper` topic), `AdminChanged`, `Registered` (`id` topic, with
owner, target and both bounds), `Updated` (`id` topic), `Paused` / `Resumed`
(`id` topic), `Removed` (`id` topic, with owner), `Extended` (`id` topic, with
`extended_at`). `#[topic]` fields are indexed so an indexer filters without
decoding data.

## Tests

32 tests in `src/test.rs`, run with `cargo test`: init and re-init, auth failure
for every privileged path, bounds at each edge (including `MAX_EXTEND` exactly),
pagination and clamping, per-owner cap, duplicate and self targets, id
monotonicity across `remove`, and keeper report auth plus future-ledger rejection.
