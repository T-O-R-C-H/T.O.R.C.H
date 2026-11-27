# What changed in this project

This repository began as TORCH, a Windows desktop automation agent: an Electron 39
front end, a Python 3.11 FastAPI backend that drove the real mouse and keyboard,
a Vite marketing site, a promo bundle, and seventeen process documents. It was
274 tracked files and roughly 116,000 lines, pre-launch, with ten contributors.
None of it had anything to do with Stellar. On 27 November 2026 that tree was
removed from the branch in a single commit (`c6e4ab4`, 322 files changed, 70,205
deletions) and the repository became a Soroban contract workspace. The old tree
is not lost: it is preserved in the annotated tag `torch-archive`, which points at
`b54e7dc`, so `git checkout torch-archive -- .` restores it exactly. The tag was
pushed to GitHub before `main` was overwritten, deliberately.

Before any of that, the repository was carrying malware. Merge `27ccf50` had
reintroduced the supply-chain worm that `ac95fd2` removed months earlier: two
34 KB `init` scripts, a 33,733-character obfuscated payload appended to
`eslint.config.mjs`, `node init &&` prefixed onto nine npm scripts across two
package files, and `.env` and `.vscode/` dropped from `.gitignore`. It ran on any
`npm run dev`, `build` or lint. Commit `b54e7dc` restored all six files from the
clean commit, verified the lockfile was untouched (11,124 changed lines were pure
CRLF noise, all 774 packages resolving to `registry.npmjs.org` with integrity),
and pushed. That commit is why this repository is safe to open in an editor
today. Rotating the credentials those scripts could reach is still a human task
and is not done.

The contract itself is `contracts/registry`: one crate, fifteen public functions,
1023 lines of Rust including tests. It holds a declared list of contracts that
should be kept alive, because Soroban RPC cannot enumerate a contract's ledger
entries and TTL extension is permissionless under CAP-0046-12 — a public good
with no responsible owner. It was built against `soroban-sdk 29.0.1`, compiled
with `stellar-cli 30.0.1` to a 9,814-byte wasm, and deployed to Stellar testnet at
`CAPABMYRGX54YT5DODZL43ZMA73HEUZOGAD6DKHD2LZ7RMAPMGVARD5P`, where it was
initialised, given a keeper, and given one real policy. Thirty-two tests cover
authorisation per privileged path, the bounds, pagination, and id monotonicity
across removal; `fmt` and `clippy -D warnings` are clean.

The application layer lives in a second repository, `vigil-app` as it was built
and now named Torch: a typed SDK and the keeper that reads the registry, checks
the instance *and* code TTL, and extends whichever expires first. It was proven
against the live testnet contract rather than walked through on paper — extension
transaction `f7606e25…`, report `acf8805…`, and `last_reported` read back from
chain. That exercise found a real bug: `ExtendFootprintTTLOp` extends a TTL *by* a
count, while the registry stores a target to *reach*, so the keeper was queuing
about two million ledgers of rent and changing nothing on an already-healthy
contract. The SDK now computes the delta and sends nothing when it is zero.

What remains is not code but reach. The dashboard does not exist, so the product
has no interface; the Postgres history path typechecks but has never run against
a database; the docs are one reference page rather than a site; and nothing is on
mainnet, which needs an audit. The app repository is also not on GitHub: the
available token may push but cannot create repositories, so its two commits are
local. `ROADMAP.md` tracks all of this with the same rule the rest of the repo
follows — a milestone counts as done when it is deployed and exercised, not when
it compiles.
