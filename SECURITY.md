# Security

## Incident: malicious code in the repository (found 13 Nov 2026)

**What was there.** The merge commit `eb30254` ("Merge pull request #49",
31 Aug 2026) contained changes that were in neither of its parents:

| File | Change |
| --- | --- |
| `init`, `website/init` | New. A harmless-looking 28-line script, then one line that calls `init();`, pads with ~500 spaces, and continues into ~13 KB of obfuscated JavaScript given `global` and `require`. |
| `eslint.config.mjs` | The same payload appended as a final line, so it ran whenever ESLint or an editor loaded the config. |
| `package.json`, `website/package.json` | `node init &&` prefixed onto `dev`, `start`, `build` and every `build:*` script. |
| `.gitignore` | `.env` and `.vscode/` removed; `temp_auto_push.bat`, `config.bat`, `branch_structure.json` added. |

The ignore-file changes are the signature of a self-propagating worm: it runs
on a developer's machine, commits itself into their repositories through
helper batch files it hides from git, and stops ignoring `.env` so secrets
get committed along the way. All four remote branches carried it.

**What was done here.** The six files were restored from `b94c510`, the last
clean parent. `package-lock.json` was checked: every package resolves to
registry.npmjs.org with an integrity hash, and it did not change in the merge.

**What still has to be done by a person. This is not optional.**

1. **Assume any machine that ran `npm run dev/build/start` or opened the repo
   in an editor with ESLint since 31 Aug 2026 is compromised.** The payload
   was not reverse-engineered; treat it as able to read files, tokens and
   browser data. Scan those machines, and rebuild them if in doubt.
2. **Rotate everything those machines could reach:** GitHub tokens and SSH
   keys, the Gmail app password, every AI provider API key, npm tokens, and
   anything in a `.env`.
3. **Find the source.** The merge is authored by the `Muyideen-js` account.
   Either that account or the machine that made the merge was compromised.
   Check the account's security log, sessions, and authorised apps.
4. **Check every other repository** those developers pushed to for an `init`
   file, `node init` in scripts, or a very long last line in a config file.
5. **Push the clean tree to every branch**, and tell all ten contributors to
   re-clone rather than pull over an infected working copy.
6. **Protect `main`:** require pull-request review and block direct pushes,
   so a change cannot arrive inside a merge commit unseen.
7. Check whether any installer or website build was published from an
   infected tree. The payload runs at build time on the builder's machine;
   whether it also alters build output is unknown.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository rather than a
public issue.
