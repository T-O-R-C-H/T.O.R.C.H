# TORCH Production Readiness — Week 2 Walkthrough

Covers the second ordered milestone from `TORCH_PRODUCTION_MASTER_PLAN.md`:
make the packaged app run without Python, and stop the renderer firing
requests before the backend is listening.

## Outcome

The two Week 2 goals are met at the repository level:

- The backend now ships as a self-contained PyInstaller bundle, verified
  running standalone with all 27 tools registered.
- Cold start no longer produces `ERR_CONNECTION_REFUSED`; the renderer waits
  for a readiness signal instead of failing.

Week 2 item 8 — installing on clean Windows 10 and 11 VMs — is **not done**.
No virtual machine was available in this environment. That verification still
stands between here and a shippable installer.

---

## 1. Why shipping the venv could never have worked

Week 1 recorded that `app.asar` was 1.65 GB and the venv appeared twice. The
underlying reason is worse than duplication:

```
backend/venv/pyvenv.cfg
  home = C:\Users\USER\AppData\Local\Programs\Python\Python311
  executable = C:\Users\USER\AppData\Local\Programs\Python\Python311\python.exe
```

A virtualenv is a set of pointers back to the interpreter that created it. On
any machine without Python at that exact path, the copied venv is inert. The
917 MB it added to the installer bought nothing.

## 2. PyInstaller bundle

`backend/build_backend.py` produces `dist-backend/torch-backend/`, embedding
the interpreter and dependencies.

Two failures had to be fixed before it ran:

**Tools silently missing.** The first bundle started but registered no tools:

```
Could not load module tools.browser: No module named 'tools.browser'
Could not load module tools.screen: No module named 'tools.screen'
Could not load module tools.system: No module named 'tools.system'
```

The executor and provider factory import these by name at runtime, so nothing
in the source graph references them and PyInstaller's static analysis left them
out. They are now listed explicitly in `TORCH_MODULES`.

**The ASGI app could not be found.**

```
ERROR: Error loading ASGI app. Could not import module "main".
```

`uvicorn.run("main:app", ...)` resolves that string by importing `main` from
disk. A frozen build has no `main.py`. The entry point now passes the `app`
object directly when `sys.frozen` is set, and only uses the import string —
which reload requires — when running from source.

**Verified standalone**, launched directly with no Python on `PATH`:

| Check | Result |
|---|---|
| `GET /api/status` without token | `401` |
| `GET /api/status` with token | `200` |
| Tools registered | `27` (same as development) |
| Module load errors | `0` |

## 3. What `app.asar` was actually carrying

Fixing the venv duplication brought the archive from 1.65 GB to 943 MB — still
far too large. Listing its contents showed the `files` config was excluding a
handful of paths and admitting everything else in the repository:

```
.venv            second virtualenv at the repository root
data             the local SQLite database
website          sub-project, own node_modules, includes torch-preview.mp4
promo            sub-project, own node_modules
build-backend    PyInstaller scratch directory
.claude          local tool permissions
backend.log, backend_err.log, dev.log, dev_err.log
.pytest_cache, test_fuzzy.py, branding, assorted .md files
```

`data/` is the significant one. It holds `torch.db`, the local task history, so
every installer built this way would have shipped one developer's recorded
activity to every user.

`files` is now an allowlist — `out/`, `resources/`, `package.json`,
`node_modules/` — so anything not named is excluded by default rather than by
remembering to exclude it.

## 4. Production startup path

`resolveBackendCommand()` in `src/main/index.ts` splits the two cases:

- Development: the project virtualenv running `main.py` from source.
- Packaged: `resources/backend/torch-backend.exe`, no arguments.

## 5. Cold start gating

The renderer reaches first paint long before Python is accepting connections,
so its opening requests failed and filled the console with
`ERR_CONNECTION_REFUSED`.

The main process now tracks a phase — `starting`, `ready`, `failed` — polls
`/api/status` until it answers, and pushes the phase to every window over IPC.
`torchFetch` and `buildWsUrl` await that signal before their first call, with a
90-second backstop so a dead backend surfaces an error rather than hanging.

A cold start is now slower rather than broken.

## 6. Also corrected

- `appId` was the boilerplate `com.electron.app`; now `com.torch.agent`.
- `productName` was `torch`; now `TORCH`.
- The auto-update feed pointed at `https://example.com/auto-updates`. It now
  points at the real GitHub repository. Auto-update itself is a Week 3 item;
  this only removes a placeholder that would have failed silently.

## 7. Build status

The exact `npm run build:win` still fails on this machine for the reason Week 1
documented — extracting `winCodeSign-2.6.0.7z` needs to create macOS symlinks
and Windows refuses without Developer Mode or elevation:

```
ERROR: Cannot create symbolic link : A required privilege is not held by the client.
  ...\winCodeSign\...\darwin\10.12\lib\libcrypto.dylib
```

This is a host restriction, not an application packaging fault: the same run
produced a valid `app.asar` and placed `resources/backend/torch-backend.exe`
correctly. Enabling Windows Developer Mode, or running the build elevated,
should clear it.

The unsigned diagnostic build is used to measure results, and now completes:

```powershell
npx electron-builder --win --config.win.signAndEditExecutable=false   # exit 0
```

## 8. Size results

| | Before | After |
|---|---|---|
| `app.asar` | 1.65 GB | **101 MB** |
| Archive entries | 21,442 | **2,879** |
| `win-unpacked` | 2.62 GB | **326 MB** |
| Installer | 663 MB | **260 MB** |

Installer: `dist/torch-1.0.0-setup.exe`
SHA-256: `59450057b834135c611e49439463c86596964ec4fb23abdf7746732331445189`

Unsigned. Not a release candidate.

## 9. Packaged application run

The built application was launched directly from `dist/win-unpacked/torch.exe`,
which takes the production branch of `resolveBackendCommand()`:

```
port 8000 served by : torch-backend.exe
                      dist\win-unpacked\resources\backend\torch-backend.exe
python processes     : none
window               : TORCH — AI Agent
GET  /api/status     : 401 without a token, 200 with one
WS   /ws?token=...   : accepted
```

No Python process is involved, which is the point of the exercise: the packaged
app runs its own bundled interpreter.

This is **not** a clean-machine test. Python is installed on this host, so the
run proves the packaged app *uses* the bundle rather than proving the bundle
works where Python is absent. Only a clean VM settles that.

## 10. Verification run

```bash
cd backend && python -m pytest      # 137 passed
npm run test                        # 30 passed
npm run typecheck                   # clean
python backend/build_backend.py     # bundle built
```

## Next ordered milestone

Week 3, per the master plan:

1. Remove or complete every fake feature — the audit in
   `PRODUCTION_READINESS_AUDIT.md` lists them.
2. Gate onboarding on first run.
3. Encrypt stored credentials with Electron `safeStorage`.
4. Auto-update via `electron-updater`.

Still outstanding from Week 2, and required before any release: install, first
launch, a real task, and uninstall verified on clean Windows 10 and Windows 11
machines with no Python present.
