# Registry contract reference

Testnet: `CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P`
([explorer](https://stellar.expert/explorer/testnet/contract/CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P))

Full behaviour spec: [`SPEC.md`](../SPEC.md). This page is the surface.

## Types

```rust
pub struct WatchPolicy {
    pub id: u32,
    pub owner: Address,
    pub target: Address,
    pub threshold: u32,
    pub extend_to: u32,
    pub active: bool,
    pub registered_at: u32,
    pub last_reported: u32,
}
```

`threshold` is "act when remaining TTL is at or below this many ledgers".
`extend_to` is "extend so remaining TTL is at least this many ledgers" — the
keeper converts that target into the ledger delta the protocol operation takes.

## Functions

| Function | Parameters | Returns | Who may call |
| --- | --- | --- | --- |
| `init` | `admin` | `Result<(), Error>` | `admin`, once |
| `admin` | — | `Result<Address, Error>` | anyone |
| `keeper` | — | `Result<Address, Error>` | anyone |
| `set_keeper` | `keeper` | `Result<(), Error>` | admin |
| `transfer_admin` | `new_admin` | `Result<(), Error>` | admin |
| `count` | — | `u32` | anyone |
| `register` | `owner, target, threshold, extend_to` | `Result<u32, Error>` | `owner` |
| `get` | `id` | `Result<WatchPolicy, Error>` | anyone |
| `list` | `page, limit` | `Vec<WatchPolicy>` | anyone |
| `list_by_owner` | `owner` | `Vec<WatchPolicy>` | anyone |
| `update` | `id, threshold, extend_to` | `Result<(), Error>` | policy owner |
| `pause` | `id` | `Result<(), Error>` | policy owner |
| `resume` | `id` | `Result<(), Error>` | policy owner |
| `remove` | `id` | `Result<(), Error>` | policy owner |
| `report` | `id, extended_at` | `Result<(), Error>` | keeper |

## Limits

`MIN_THRESHOLD = 100` · `MAX_EXTEND = 3_110_400` (~180 days) ·
`MAX_POLICIES_PER_OWNER = 20` · `LIST_LIMIT_MAX = 50`.

## Errors

`1 AlreadyInitialized` · `2 NotInitialized` · `4 PolicyNotFound` ·
`5 ThresholdOutOfRange` · `7 ExtendTooLarge` · `9 TooManyPolicies` ·
`10 ReportInFuture`.

`3 Unauthorized`, `6 TargetOutOfRange` and `8 LimitOutOfRange` are reserved
numbers; auth failures surface as host errors and `list` clamps its limit instead
of rejecting it.

## Events

`Initialized` · `KeeperSet` · `AdminChanged` · `Registered` · `Updated` ·
`Paused` · `Resumed` · `Removed` · `Extended`, all as `#[contractevent]` structs
with the policy id as an indexed topic where one applies.

## Example

```bash
stellar contract invoke --id CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P \
  --source deployer --network testnet -- \
  register --owner G... --target C... --threshold 1000 --extend_to 2000000
```
