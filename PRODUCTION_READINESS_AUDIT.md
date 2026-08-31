# TORCH Week 1 Production Readiness Audit

Audit date: 2026-08-26

This document records observed repository behavior. The production master plan is the target; entries below describe what the current code actually does.

## Packaging baseline

### Exact command

```powershell
npm run build:win
```

Environment used for the baseline:

- Windows `10.0.26200`
- Node.js `24.18.0`
- npm `11.16.0`
- electron-builder `26.8.1`
- Electron `39.8.10`

Observed result:

1. Both TypeScript projects passed type-checking.
2. Electron main, preload, and renderer bundles compiled successfully.
3. Vite reported one non-fatal CSS optimizer warning for a nested `@keyframes` rule.
4. electron-builder created `dist/win-unpacked` and copied the full local `backend/venv` into it.
5. The normal command then failed while extracting `winCodeSign-2.6.0.7z`. Windows refused creation of the archive's `libcrypto.dylib` and `libssl.dylib` symlinks because Developer Mode/elevated symlink privilege was unavailable.
6. The exact command did not produce an NSIS setup executable.

An unsigned diagnostic build was also run with:

```powershell
npx electron-builder --win --config.win.signAndEditExecutable=false
```

That bypassed the local signing-helper extraction problem and completed successfully. It produced `dist/torch-1.0.0-setup.exe` at 695,339,510 bytes (663.13 MiB, SHA-256 `0C0781796D1824D7FC71D3347BA8CD90B78A3ED7D65331DC55517772C0C0B7CC`). The diagnostic artifact is not a release fix: disabling executable editing/signing would prevent the planned production signing path.

### Verified packaging gaps

- `electron-builder.yml:29` copies the entire development virtual environment. The completed unpacked app is 2,744,094,448 bytes (2,616.97 MiB); the external venv alone is 746,692,923 bytes (712.10 MiB).
- The general `files` rules do not exclude `backend`, so the venv is also embedded in `resources/app.asar` (16,031 venv entries were verified) before being copied again by `win.extraResources`. `app.asar` is 1,655,491,204 bytes (1,578.80 MiB). This duplication is the main packaging bloat.
- `src/main/index.ts:150` launches `resources/backend/venv/Scripts/python.exe` in production rather than a purpose-built backend bundle.
- A clean Windows 10/11 VM without Python was not available in this workspace, so clean-machine launch remains unverified.
- Playwright's Python package is included, but its Chromium download is stored outside the venv and is not provisioned by the installer.
- `package.json:6`, `package.json:7`, `electron-builder.yml:1`, and `electron-builder.yml:64` still contain template author, homepage, app id, or update URL values.
- No code-signing certificate is configured.

Week 2 should replace the copied venv with the planned PyInstaller `onedir` bundle, provision Chromium deliberately, and then make installer creation a CI gate.

## Automated quality baseline

| Check | Result |
| --- | --- |
| Backend tests | 137 passed |
| Frontend tests | 30 passed |
| Total tests | 167 passed |
| TypeScript | Passed for main/preload and renderer |
| ESLint | Exit code 0; 177 pre-existing warnings, no errors |

The existing `.github/workflows/ci.yml` has been upgraded to run these checks on Windows and build the Electron main/preload/renderer bundles after both test jobs pass. It intentionally does not claim to build a release installer until the backend bundle is fixed.

## Sidebar inventory

| Surface | Current behavior | Verdict |
| --- | --- | --- |
| Chat | Uses the authenticated WebSocket command pipeline and real task state. | Working |
| Today | Quick actions route into Chat. Task/action/success figures come from SQLite, but “time saved” is an assumed eight minutes per completed task (`backend/main.py:585`). | Partly honest |
| History | Reads and deletes `/api/history` in normal mode. A clearly labelled fallback demo mode uses `demoHistory`. | Working in live mode |
| Skills / shortcuts | CRUD and run operations use authenticated `/api/skills` endpoints. | Working |
| Inbox | Reads real Gmail data through authenticated endpoints. “Load more” uses plain `fetch` at `Inbox.tsx:95`, so pagination omits the session token and will be rejected. | Partly broken |
| Files | The visible Find button at `pages/tools/Files.tsx:30` has no handler. | Fake |
| Follow-ups | Descriptive empty shell only; no follow-up model or API. The sidebar also displays a hardcoded badge of `2` (`Sidebar.tsx:57`). | Fake |
| Clipboard | Reads real Electron clipboard history and can copy an entry back. | Working |
| Screen Watch | The toggle only changes Zustand state, and empty logs are replaced with fabricated VS Code/Chrome/Slack activity (`ScreenWatch.tsx:6`). The tray IPC event has no renderer consumer. | Fake and misleading |
| Insights | Weekly tasks, category counts, accuracy, automation, HITL rate, and time-saved breakdown are hardcoded (`Insights.tsx:101-196`). | Fake and misleading |
| Footer account tier | Shows “Pro account” whenever a Gemini key exists (`Sidebar.tsx:136`); it is not based on an account or subscription. | Misleading |
| Chat/Today green indicators | Both are statically green rather than derived from connection or activity state. | Misleading |

## Other visible UI surfaces

| Surface | Evidence | Required honesty action |
| --- | --- | --- |
| Onboarding permissions | File, app, and email toggles are component state only (`Onboarding.tsx:115-127`) and are never persisted or enforced. | Wire real policy or remove the permission step. |
| Onboarding first task | The fixed command is queued and onboarding closes before a real result is required. | Require a real successful result or label it as a demonstration. |
| Prompt “Enhance” | Defaults to `mockEnhance`, waits 2.2 seconds, and replaces any prompt with the same canned paragraph (`PromptInput.tsx:16-20`). | Wire a real operation or remove it. |
| Selected model metadata | A non-auto internal model id is rendered directly (`PromptInput.tsx:359`). | Render only the safe speed/depth label. |
| Approval “Edit” | `Command.tsx:120` only writes to the developer console. | Implement edit or remove the button. |
| Social connection status | Clicking “Open & login” immediately records “connected” in localStorage without checking a session (`Settings.tsx:150-154`). | Verify the browser session or say only that the site was opened. |
| Social posting/messaging | Backend tools open the site and return success-like text but do not post or send (`backend/tools/social.py:57`, `:112`). | Complete the action after HITL or report that TORCH only opened the site. |
| Wake-word sensitivity | Saved to `.env`, but no `WakeWordDetector` instance consumes it. | Wire it or hide it. |
| Voice model size | Saved to `.env`, while `voice.py:51` hardcodes Whisper `base`. | Use the setting or hide it. |
| Screen Watch interval | Saved to `.env`, but there is no capture worker. | Implement the worker or remove the setting. |
| Theme | Changes local component state only; the app remains on the light theme. | Remove the dark option or implement it. |
| Launch on login | Changes local component state only. | Wire Electron login-item settings or remove it. |
| Minimize to tray | Changes local component state only; the main process always uses tray behavior. | Wire the preference or remove it. |
| Clear memory / Export history / Reset habits | Buttons at `Settings.tsx:496-498` have no handlers. | Implement or remove them. |
| Playwright readiness | `/api/system-check` reports true when the Python module imports, even if Chromium is absent (`backend/main.py:152-159`). | Report browser readiness, not package presence. |
| Web Search page | Search button at `pages/tools/WebSearch.tsx:30` has no handler. | Route through Chat or remove the page. |
| Browser page | Open button at `pages/tools/Browser.tsx:31` has no handler. | Route through Chat or remove the page. |
| Messaging page | Static platform labels only; no controls or connection data. | Remove until real messaging exists. |
| Activity Log | Displays raw developer/terminal information and is linked from Settings. | Keep explicitly developer-only or hide in production builds. |

## Working surfaces that must be preserved

- Session-token authentication covers all REST routes and rejects unauthorized WebSockets before `accept()`.
- The backend binds to `127.0.0.1`.
- Planner-owned HITL policy overrides model-provided approval flags.
- Stop, failure recap, rollback registration, and rollback execution have regression coverage.
- The native menu is removed and custom window controls are wired.
- Onboarding is gated before the main layout renders.
- Clipboard history, live History, live Memory, Skills, task narration, and the control border have real data paths.

## Ordered next step

Week 2 is now unblocked at the repository level: implement the PyInstaller backend bundle, wire it into electron-builder, add backend-ready gating to `torchFetch`, and validate the resulting installer on clean Windows 10 and Windows 11 virtual machines.
