#!/usr/bin/env bash
# Creates the planned backlog in one run. Requires an authenticated `gh`.
#   ./scripts/create-issues.sh            # repo inferred from the git remote
#   ./scripts/create-issues.sh owner/repo
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "creating issues in $REPO"

# Labels are created idempotently; gh errors if they already exist, hence || true.
for label in "complexity: low:0e8a16" "complexity: medium:fbca04" "complexity: high:b60205" \
             "area: contract:1d76db" "area: app:5319e7" "area: tooling:c2e0c6" \
             "type: feature:0e8a16" "type: bug:d73a4a" "type: docs:0075ca" "type: test:bfd4f2"; do
  name="${label%%:*}"; rest="${label#*:}"; color="${rest##*:}"
  gh label create "$name" --color "$color" --repo "$REPO" >/dev/null 2>&1 || true
done

create() {
  local title="$1" body="$2"; shift 2
  gh issue create --repo "$REPO" --title "$title" --body "$body" "$@"
}

create "feat(registry): watch declared persistent data keys" \
"## Summary
v1 watches only the contract instance and code entries. A contract's persistent
data entries have their own TTLs and can archive while the instance stays live.
They cannot be enumerated over RPC, so each key must be declared at registration.

## Acceptance Criteria
- [ ] \`register\` accepts an optional list of persistent keys (encoded \`ScVal\`)
- [ ] Each declared key's TTL is read and extended by the keeper
- [ ] A policy with more than N keys is rejected with a documented error
- [ ] Tests cover a key that archives while the instance is healthy

## Tech Stack
Rust, soroban-sdk 29, stellar-cli 30" \
  --label "area: contract" --label "complexity: high" --label "type: feature"

create "feat(registry): batch registration" \
"## Summary
Registering twenty policies costs twenty transactions. A deployer with several
contracts pays that cost once per contract.

## Acceptance Criteria
- [ ] \`register_many\` takes up to MAX_POLICIES_PER_OWNER entries in one call
- [ ] Per-owner cap and validation apply to every element
- [ ] Ids are allocated in order and never skipped on validation failure
- [ ] Tests cover a batch where the last element is invalid

## Tech Stack
Rust, soroban-sdk 29" \
  --label "area: contract" --label "complexity: medium" --label "type: feature"

create "test(registry): property tests for id monotonicity under remove" \
"## Summary
Ids must never be reused. The current test covers one remove/register cycle;
a property test should cover arbitrary interleavings.

## Acceptance Criteria
- [ ] A generated sequence of register/remove operations never yields a
      previously issued id
- [ ] \`count\` is monotonic across the sequence
- [ ] \`list_by_owner\` never returns a removed id

## Tech Stack
Rust, soroban-sdk testutils" \
  --label "area: contract" --label "complexity: medium" --label "type: test"

create "feat(indexer): verify extension landed before reporting" \
"## Summary
The keeper reports \`report\` immediately after a confirmed extension transaction.
It should re-read the TTL and only report when the entry actually moved, so a
silently ineffective extension cannot be recorded as success.

## Acceptance Criteria
- [ ] After extending, the keeper re-reads both instance and code TTLs
- [ ] \`report\` is skipped, with a warning, when the TTL did not increase
- [ ] Tests cover the no-change path

## Tech Stack
TypeScript, @stellar/stellar-sdk 17" \
  --label "area: app" --label "complexity: low" --label "type: bug"

create "feat(indexer): prometheus metrics for passes, extensions and rent spent" \
"## Summary
Operators cannot see whether the keeper is healthy without reading logs.

## Acceptance Criteria
- [ ] \`/metrics\` exposes pass count, policies scanned, extensions, failures,
      TTL read errors and total stroops spent on extensions
- [ ] Metrics are labelled by policy id only, never by key material
- [ ] A documented scrape config example

## Tech Stack
TypeScript, prom-client" \
  --label "area: app" --label "complexity: medium" --label "type: feature"

create "feat(scripts): restore flow for archived contracts" \
"## Summary
Extension keeps entries alive; it cannot revive them. Once archived, recovery
needs \`RestoreFootprintOp\`. The keeper currently throws and leaves the operator
to work it out.

## Acceptance Criteria
- [ ] \`scripts/restore.sh\` restores an archived contract's instance and code
- [ ] The keeper detects an archived target and emits a distinct alert
- [ ] Docs explain why restore costs more than extension and who pays

## Tech Stack
Rust/Toml, stellar-cli 30, bash" \
  --label "area: tooling" --label "complexity: medium" --label "type: feature"

create "docs: runbook for a keeper whose rent balance is running out" \
"## Summary
Extensions spend XLM. When the keeper's account runs dry, everything silently
stops being extended.

## Acceptance Criteria
- [ ] Runbook covers detecting the condition, topping up, and expected burn rate
- [ ] Keeper logs a warning below a configurable balance threshold
- [ ] Documented in the README

## Tech Stack
Markdown, TypeScript" \
  --label "type: docs" --label "complexity: low"

echo
echo "done. Verify with: gh issue list --repo $REPO"
