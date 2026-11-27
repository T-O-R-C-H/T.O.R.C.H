# Contributing

The full guide is in
[CONTRIBUTING.md](https://github.com/T-O-R-C-H/T.O.R.C.H/blob/main/CONTRIBUTING.md)
in the repository. This page is the short version.

## Before a pull request

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
stellar contract build
```

All four, in that order. CI runs the same commands and a red check is not merged.

## Rules

- Conventional commits: `feat(registry): …`, `test(registry): …`, `docs: …`.
- One logical unit per commit; stage explicit paths.
- A contract change and its `SPEC.md` change land in the same pull request. The
  spec is the contract; disagreement is a bug.
- Anything touching auth, arithmetic bounds or TTL handling needs a test that
  fails before the fix.

## Where the work is

The [roadmap](https://github.com/T-O-R-C-H/T.O.R.C.H/blob/main/ROADMAP.md) lists
milestones and their real status. Open issues are scoped with acceptance
criteria; anything without them is not ready to pick up.

Good places to start: docs corrections, the dashboard (not built at all), and the
keeper metrics listed in the roadmap. Auth and storage changes are not first
issues.

## Security

Do not open a public issue for a vulnerability. Use private reporting, described
in
[SECURITY.md](https://github.com/T-O-R-C-H/T.O.R.C.H/blob/main/SECURITY.md). The
contract is unaudited and testnet-only.
