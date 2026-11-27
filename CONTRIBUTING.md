# Contributing

## Setup

```bash
rustup target add wasm32v1-none
curl -fsSL https://github.com/stellar/stellar-cli/install.sh | bash   # stellar-cli 30.0.1
cargo --version   # any stable toolchain
```

## Before you open a PR

All four must be green. CI runs the same commands.

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
stellar contract build
```

`cargo build` for wasm is blocked from `soroban-sdk` 28 onward. Use
`stellar contract build`, which targets `wasm32v1-none` and strips unreachable
spec entries.

## Commits

- Conventional commits: `feat(registry): add pause`, `test(registry): cover
  id reuse`, `docs: …`, `fix(registry): …`, `chore: …`.
- One logical unit per commit.
- Stage explicit paths. `git add .` hides files you did not mean to commit.

## Pull requests

- Branch from `main`, one concern per PR.
- Describe behaviour change, not file changes. If it alters the contract's
  public surface, say which functions and who is affected.
- A change to `SPEC.md` and a change to `src/` must land together. The spec is
  the contract; if they disagree that is a bug.
- Anything touching auth, arithmetic bounds or TTL handling needs a test that
  fails before the fix.

## Labels

`good first issue` · `complexity: low` · `complexity: medium` ·
`complexity: high` · `area: contract` · `area: app` · `type: bug` ·
`type: feature` · `type: docs` · `type: test`

## Reporting bugs

Include the contract id, the function called, the arguments, the error text
(`Error(Contract, #n)`), and the ledger. Without those it is not reproducible.
Security issues go through `SECURITY.md`, not the issue tracker.
