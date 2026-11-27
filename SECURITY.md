# Security

## Status: unaudited

`contracts/registry` has **not** been audited. It has not been through the
[Soroban Audit Bank](https://stellar.org/grants-and-funding/soroban-audit-bank).
It is deployed to testnet only. Do not put funds behind it on mainnet.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository:
**Security → Report a vulnerability**. Do not open a public issue for anything
exploitable.

Include: what you did, what happened, what you expected, and the contract id if
it is a deployed instance. Expect an acknowledgement within 7 days.

## Scope

In scope:

- `contracts/registry` — storage layout, authorization, arithmetic, TTL handling
- `scripts/deploy_testnet.sh` — anything that could deploy the wrong artifact or
  initialize with the wrong admin

Out of scope:

- The keeper and dashboard (`vigil-app`)
- Testnet state and any keys committed by mistake (report those privately anyway)

## Known properties that are not vulnerabilities

Stated here so they are not reported as findings:

1. **TTL extension is permissionless.** CAP-0046-12 makes it so, deliberately.
   Anyone can extend any entry. A TTL is not a security boundary and no time
   guarantee may be derived from one.
2. **Registry data is public.** Owner addresses, targets, thresholds and reports
   are all readable. Nothing here is confidential.
3. **`report` is a claim, not a proof.** A contract cannot read another
   contract's TTL, so the keeper's report cannot be verified on-chain. It is an
   operational log signed by a known key, nothing more. This is why v1 has no
   payments.
4. **No upgrade path.** The registry has no admin-controlled upgrade function.
   Replacing it means deploying a new contract and re-registering policies.
5. **`remove` does not free the id.** Ids are monotonic by design, so a stale
   link can never resolve to a different team's contract.
