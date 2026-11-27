# Register a contract

You need: the contract id of the contract you want kept alive, an account that
will own the policy, and enough XLM for the registration transaction.

## 1. Check the target is live

```bash
stellar contract invoke \
  --id CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P \
  --source deployer --network testnet -- count
```

`count` tells you how many policies exist. Your new policy gets that number as
its id.

## 2. Register

```bash
stellar contract invoke \
  --id CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P \
  --source deployer --network testnet -- \
  register \
  --owner  G... \      # account or contract that manages this policy
  --target C... \      # the contract to keep alive
  --threshold 1000 \   # act when 1000 ledgers (~83 minutes) remain
  --extend_to 2000000  # extend back to ~115 days
```

Rules the contract enforces, so you know before you sign:

- `threshold` must be at least 100 ledgers.
- `extend_to` must be strictly greater than `threshold`.
- `extend_to` must not exceed 3,110,400 ledgers (~180 days).
- One owner may hold at most 20 policies.

## 3. Choosing the numbers

`threshold` is your safety margin: how long the keeper has to notice and act
before archival. Too small and a failed transaction or an RPC outage is enough to
lose the entry. 1,000 ledgers is about 83 minutes; 17,280 is a day.

`extend_to` is how far back you want to be pushed. Longer means more rent per
extension but fewer extensions. There is no protocol benefit past 3,110,400.

A contract may watch itself, two owners may watch the same contract, and nothing
stops you from watching a contract you do not control.

## 4. Managing the policy

```bash
# change the margin
stellar contract invoke ... -- update --id 0 --threshold 5000 --extend_to 2500000

# stop and start
stellar contract invoke ... -- pause  --id 0
stellar contract invoke ... -- resume --id 0

# give up
stellar contract invoke ... -- remove --id 0
```

`update`, `pause`, `resume` and `remove` all require the **owner's** signature,
never the admin's. Removing a policy deletes it and its id is not reused.

## 5. If the contract is already archived

Torch cannot help. Extension keeps an entry alive; it cannot revive one. Recovery
is `RestoreFootprintOp`, submitted by anyone willing to pay, after which the
contract works again and a policy can be registered as normal.
