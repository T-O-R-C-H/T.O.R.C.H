# TORCH Production Readiness — Week 1 Walkthrough

This walkthrough covers the first ordered milestone from `TORCH_PRODUCTION_MASTER_PLAN.md`: establish the real packaging baseline, correct repository documentation, put the existing tests in CI, and inventory every misleading UI surface.

## Outcome

Week 1 is complete at the repository level:

- Windows packaging is no longer an unknown.
- The current 167-test suite is represented in CI.
- `CLAUDE.md` now describes the code that actually exists.
- `PRODUCTION_READINESS_AUDIT.md` contains the verified packaging and UI honesty inventory.

The release installer is not yet production-ready. The exact normal build is blocked on this machine by electron-builder's symlink privilege requirement, and the diagnostic installer is 663.13 MiB because the development venv is packaged twice.

## 1. Packaging baseline

The required command was run unchanged:

```powershell
npm run build:win
```

What passed:

- Node and renderer TypeScript checks
- Electron main-process bundle
- Electron preload bundle
- React renderer bundle
- Creation of `dist/win-unpacked`

What failed:

- electron-builder downloaded `winCodeSign-2.6.0.7z`.
- Extraction tried to create two macOS library symlinks.
- Windows rejected the symlinks because Developer Mode/elevated symlink privilege was unavailable.
- The exact command exited with code 1 before producing the NSIS installer.

To isolate that host restriction from application packaging, this diagnostic command was run:

```powershell
npx electron-builder --win --config.win.signAndEditExecutable=false
```

It completed and produced:

- Installer: `dist/torch-1.0.0-setup.exe`
- Size: 695,339,510 bytes (663.13 MiB)
- SHA-256: `0C0781796D1824D7FC71D3347BA8CD90B78A3ED7D65331DC55517772C0C0B7CC`
- Unpacked application: 2,744,094,448 bytes (2,616.97 MiB)
- External bundled venv: 746,692,923 bytes (712.10 MiB)
- `app.asar`: 1,655,491,204 bytes (1,578.80 MiB)

The venv appears both inside `app.asar` and again in `resources/backend/venv`. The diagnostic installer is useful evidence, but it is unsigned and is not a release candidate. Build outputs remain ignored by Git.

## 2. Documentation correction

`CLAUDE.md` was reconciled with the current source:

- React/Electron/provider details now match `package.json` and `backend/agent/providers`.
- SQLite is documented as the implemented memory store; the installed but unused ChromaDB dependency is no longer presented as working functionality.
- Rollback now names the real `register_step()` and `rollback(message_id)` API.
- The actual four Electron windows are documented: main, floating overlay, guidance overlay, and control border.
- The bottom-center pill and right task panel are explicitly labelled as a later production-plan milestone.
- Packaging, cold-start, credential-storage, and visible honesty gaps are listed as open work.

## 3. Continuous integration

`.github/workflows/ci.yml` replaces the previous import-only placeholder with three Windows jobs:

1. Frontend checks: `npm ci`, type-check, lint, and Vitest.
2. Backend tests: Python 3.11, runtime/test dependencies, and pytest.
3. Desktop renderer build: runs only after both test jobs pass and compiles main, preload, and renderer bundles.

Installer packaging is deliberately not called a CI gate yet. That gate becomes trustworthy after Week 2 replaces the copied venv with PyInstaller.

Repository administrators still need to make the three CI checks required in GitHub branch protection; a workflow file cannot change that repository setting by itself.

## 4. UI honesty audit

The detailed table is in `PRODUCTION_READINESS_AUDIT.md`. The highest-priority findings are:

- Screen Watch displays fabricated activity and has no capture worker.
- Insights is made entirely from hardcoded analytics.
- Follow-ups is an empty shell with a hardcoded count.
- Files, Web Search, and Browser pages have inert primary buttons.
- Messaging describes capabilities that are not implemented.
- Onboarding permission toggles do not persist or enforce anything.
- Prompt Enhance returns the same canned paragraph for every prompt.
- The approval Edit button only logs to the console.
- Social accounts are marked connected merely because a login page was opened.
- Social tools open pages but do not actually post or send.
- Several Settings controls and all three data-management buttons are unwired.
- Gmail pagination uses unauthenticated `fetch`, so Load more will receive a 401.
- “Time saved” is estimated as eight minutes per completed task rather than measured.

The audit also identifies working surfaces to preserve, including auth, HITL, rollback, History, Skills, Clipboard, onboarding gating, custom window controls, and the control border.

## 5. Verification performed

```powershell
python -m pytest                  # from backend/
npm run test
npm run typecheck
npm run lint
npm run build:win
npx electron-builder --win --config.win.signAndEditExecutable=false
```

Results:

- Backend: 137 passed
- Frontend: 30 passed
- Total: 167 passed
- TypeScript: passed
- ESLint: passed with 177 pre-existing warnings and no errors
- Exact Windows build: failed at signing-helper symlink extraction
- Unsigned diagnostic build: completed

## Next ordered milestone

Week 2 should:

1. Build the backend with PyInstaller `onedir`.
2. Exclude source/backend venv duplication from `app.asar`.
3. Point production startup at `torch-backend.exe`.
4. Gate all renderer requests on backend readiness.
5. Provision Playwright Chromium deliberately.
6. Test install, first launch, a real task, and uninstall on clean Windows 10 and Windows 11 virtual machines with no Python installed.
