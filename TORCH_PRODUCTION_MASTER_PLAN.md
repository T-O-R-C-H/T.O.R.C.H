# TORCH — Production Readiness Master Plan

**Read this entire document before writing any code.**

This is the complete, ordered plan to take TORCH from its current state (~58/100 production readiness) to a genuinely shippable product. Nothing here is optional. Nothing here is aspirational filler. Every item is either a real blocker or a real quality gap that users will hit.

Work through the phases in order. Do not jump ahead. Phase 1 items block everything else.

---

# PART A — CURRENT STATE (verified, not assumed)

## What is genuinely working

- Session token auth: Electron generates token → env var → Python. REST via `Authorization` header, WebSocket via `?token=`, rejected before `accept()`. Bound to `127.0.0.1` only.
- `shell=True` removed from `open_app` fallback.
- 167 tests passing (137 backend pytest + 30 frontend vitest).
- WebSocket send-site bug fixed — all six send sites resolve the live socket, sends wait for connection instead of vanishing.
- Web search fixed — POST + fallback endpoint + headless Playwright fallback, honest refusal messaging.
- HITL approval gate verified working — blocked, cancelled, nothing sent.
- Undo/rollback verified — delete restored with content intact, move reversed.
- Failed tasks send a plain-language message instead of ending silently.
- Model names removed from picker, live caption, and History.
- Core tools verified live: find a file, screenshot, open_app, list/create/move/zip/delete, voice with speechSynthesis fallback.

## What is still broken or unverified

1. **`build:win` has never been run.** Packaging is a complete unknown.
2. **No bundled Python runtime.** Fresh Windows machine = broken app.
3. **No code signing certificate.** Every user sees a Windows Defender warning.
4. **No auto-update mechanism.** Bug fixes cannot reach installed users.
5. **Playwright Chromium not provisioned** in the installer.
6. **Vision control unusable** — 183s/step at 100% CPU on non-GPU hardware.
7. **Cold-start `ERR_CONNECTION_REFUSED`** — REST calls fire before Python boots, no retry.
8. **No CI** — 167 tests run only when someone remembers.
9. **CLAUDE.md documents `rollback_last_batch()`** which does not exist (it is `register_step` / `rollback`).
10. **Fake features still visible**: Screen Watch toggle does nothing, Inbox and Follow-ups have no routes, History may still show demo data, metrics may be hardcoded.
11. **Credentials stored in plaintext** — Gmail password and API keys in `.env`.
12. **Untested surfaces**: vision loop, email tool, browser tool, `useWebSocket.ts`.
13. **Onboarding not gated** on first run.
14. **Native menu bar visible** (File / Edit / View / Window / Help).

---

# PART B — ARCHITECTURE DECISION: SCREEN CONTROL

**This supersedes all previous plans for vision-based screen control.**

Measured performance on real hardware:

| Method | Time per action | Accuracy | Cost |
|---|---|---|---|
| Qwen2.5-VL local (no GPU) | 183,000ms | Coordinate guessing | Free |
| Gemini Vision (cloud) | 5,600ms | Coordinate guessing | API quota |
| **Windows UI Automation** | **66ms** | **Exact, by element name** | **Free** |

Windows UI Automation is roughly 2,700x faster than local vision and does not guess — it reads the actual accessibility tree, so it knows a button is literally named "Search" and where it is.

## The new screen control architecture

```
User command requiring screen interaction
    ↓
TIER 1 — Named tool exists?  (find_file, send_email, open_app…)
    → Use it. Fastest, most reliable. ~50ms
    ↓ no named tool
TIER 2 — Windows UI Automation
    → Read UIA element tree of the active window
    → Find element by name/type/automation-id
    → Click/type via UIA pattern invoke
    → 66ms per action, exact coordinates
    ↓ UIA cannot read this app (canvas app, game, some Electron)
TIER 3 — Gemini Vision (cloud, requires internet + quota)
    → Screenshot → Gemini → coordinates → PyAutoGUI
    → 5.6s per action
    ↓ no internet or no quota
TIER 4 — Local vision (Qwen2.5-VL)
    → Only if user has a GPU. Detect at startup.
    → If no GPU: do not offer this path, tell the user honestly
```

## Implementation: `backend/tools/uia_control.py`

Use the `uiautomation` Python package (pip install uiautomation) or `pywinauto`'s UIA backend.

```python
"""
TORCH UI Automation Control — Windows accessibility tree driven screen control.
2,700x faster than vision. Exact element targeting by name.
"""

import logging
import time
from typing import Optional, List, Dict, Any

logger = logging.getLogger("torch.uia")

try:
    import uiautomation as auto
    UIA_AVAILABLE = True
except ImportError:
    UIA_AVAILABLE = False
    logger.warning("uiautomation not installed — UIA control unavailable")


def get_active_window_tree(max_depth: int = 4) -> Dict[str, Any]:
    """
    Read the UI element tree of the currently focused window.
    Returns a structured dict the LLM can reason about.
    """
    if not UIA_AVAILABLE:
        raise RuntimeError("UI Automation is not available on this system.")

    window = auto.GetForegroundControl()
    if not window:
        raise RuntimeError("Could not read the active window.")

    def walk(control, depth=0):
        if depth > max_depth:
            return None
        try:
            rect = control.BoundingRectangle
            node = {
                "name": control.Name or "",
                "type": control.ControlTypeName,
                "automation_id": control.AutomationId or "",
                "enabled": control.IsEnabled,
                "x": (rect.left + rect.right) // 2,
                "y": (rect.top + rect.bottom) // 2,
                "clickable": control.ControlTypeName in {
                    "ButtonControl", "HyperlinkControl", "MenuItemControl",
                    "ListItemControl", "TabItemControl", "CheckBoxControl",
                    "RadioButtonControl", "ComboBoxControl"
                },
                "editable": control.ControlTypeName in {"EditControl", "DocumentControl"},
                "children": []
            }
            for child in control.GetChildren():
                child_node = walk(child, depth + 1)
                if child_node:
                    node["children"].append(child_node)
            return node
        except Exception:
            return None

    return {
        "window_title": window.Name,
        "tree": walk(window)
    }


def flatten_interactive(tree: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Flatten the tree to a list of only interactive elements, for the LLM prompt."""
    out = []

    def walk(node):
        if not node:
            return
        if (node.get("clickable") or node.get("editable")) and node.get("name"):
            out.append({
                "name": node["name"],
                "type": node["type"],
                "x": node["x"],
                "y": node["y"],
                "enabled": node["enabled"]
            })
        for child in node.get("children", []):
            walk(child)

    walk(tree.get("tree"))
    return out


def click_element_by_name(name: str, exact: bool = False) -> str:
    """Find and click an element by its accessible name."""
    if not UIA_AVAILABLE:
        raise RuntimeError("UI Automation is not available.")

    window = auto.GetForegroundControl()
    target = None

    def find(control, depth=0):
        nonlocal target
        if target or depth > 6:
            return
        try:
            control_name = control.Name or ""
            matches = (control_name == name) if exact else (name.lower() in control_name.lower())
            if matches and control.IsEnabled:
                target = control
                return
            for child in control.GetChildren():
                find(child, depth + 1)
        except Exception:
            pass

    find(window)

    if not target:
        raise ValueError(f"Could not find anything named '{name}' on screen.")

    try:
        # Prefer the invoke pattern — more reliable than clicking coordinates
        if hasattr(target, "GetInvokePattern"):
            pattern = target.GetInvokePattern()
            if pattern:
                pattern.Invoke()
                return f"Clicked '{target.Name}'"
    except Exception:
        pass

    # Fall back to coordinate click
    target.Click()
    return f"Clicked '{target.Name}'"


def type_into_element(name: str, text: str) -> str:
    """Find a text field by name and type into it."""
    if not UIA_AVAILABLE:
        raise RuntimeError("UI Automation is not available.")

    window = auto.GetForegroundControl()
    target = None

    def find(control, depth=0):
        nonlocal target
        if target or depth > 6:
            return
        try:
            if (name.lower() in (control.Name or "").lower()
                    and control.ControlTypeName in {"EditControl", "DocumentControl", "ComboBoxControl"}):
                target = control
                return
            for child in control.GetChildren():
                find(child, depth + 1)
        except Exception:
            pass

    find(window)

    if not target:
        raise ValueError(f"Could not find a text field named '{name}'.")

    target.Click()
    time.sleep(0.1)
    try:
        pattern = target.GetValuePattern()
        if pattern:
            pattern.SetValue(text)
            return f"Typed into '{target.Name}'"
    except Exception:
        pass

    auto.SendKeys(text, waitTime=0.02)
    return f"Typed into '{target.Name}'"


def uia_control(task: str, client_id: str = "main") -> str:
    """
    Entry point registered as a tool.
    Reads the screen, sends the element list to the LLM, executes the returned action.
    Loop until done or max steps.
    """
    # Full loop implementation:
    # 1. get_active_window_tree()
    # 2. flatten_interactive() → compact list of elements with names and coords
    # 3. Send to LLM: "Here are the clickable elements on screen: [...]. Task: {task}. What is the next action?"
    # 4. LLM returns {"action": "click", "target": "Search", "reason": "..."}
    # 5. click_element_by_name(target)
    # 6. Repeat until {"action": "done"} or max 20 steps
    # Emit uia_control_start / uia_control_end WS events for the blue border
    ...
```

**Critical difference from vision:** the LLM receives a text list of element names, not an image. That means it can use the fast local text model (Llama 3.1 8B) instead of a vision model. Cheap, fast, offline.

## GPU detection — required

At startup, detect GPU availability and disable the local vision tier honestly if absent:

```python
def has_gpu() -> bool:
    """Detect NVIDIA or AMD GPU without importing heavy ML libraries."""
    import subprocess
    try:
        subprocess.run(["nvidia-smi"], capture_output=True, timeout=3, check=True)
        return True
    except Exception:
        pass
    try:
        result = subprocess.run(
            ["wmic", "path", "win32_VideoController", "get", "name"],
            capture_output=True, text=True, timeout=3
        )
        out = result.stdout.lower()
        return "nvidia" in out or "radeon" in out or "amd" in out
    except Exception:
        return False
```

If no GPU: never offer local vision. In Settings show "Local vision requires a graphics card. TORCH will use Windows automation instead, which is faster anyway."

---

# PART C — PHASE 1: SHIP BLOCKERS

**Nothing else matters until every item in this phase is complete and verified.**

## 1.1 Run `build:win` and report exactly what happens

This is the single biggest unknown in the project. Do this first, before writing any other code.

```
npm run build:win
```

Report exactly: does it complete, does it produce an installer, what is the file size, does the installer run on a machine without Python.

Whatever breaks, fix it. Document every step required.

## 1.2 Bundle the Python backend

The installer must work on a clean Windows machine with no Python installed.

**Approach: PyInstaller**

Create `backend/build_backend.py`:

```python
"""Bundle the TORCH backend into a single executable with PyInstaller."""
import PyInstaller.__main__
import os

PyInstaller.__main__.run([
    'main.py',
    '--name=torch-backend',
    '--onedir',              # onedir not onefile — faster cold start
    '--noconfirm',
    '--clean',
    '--distpath=../dist-backend',
    # Hidden imports FastAPI/uvicorn need
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.protocols',
    '--hidden-import=uvicorn.protocols.http',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.protocols.websockets',
    '--hidden-import=uvicorn.protocols.websockets.auto',
    '--hidden-import=uvicorn.lifespan',
    '--hidden-import=uvicorn.lifespan.on',
    # Data files
    '--add-data=config;config',
    '--add-data=memory/schema.sql;memory',
    # Exclude what we do not need — keeps size down
    '--exclude-module=matplotlib',
    '--exclude-module=tkinter',
    '--exclude-module=PyQt5',
])
```

**Wire into electron-builder.yml:**

```yaml
extraResources:
  - from: "dist-backend/torch-backend"
    to: "backend"
    filter: ["**/*"]
```

**Update `src/main/index.ts`:**

```typescript
function getBackendCommand(): { exe: string; args: string[]; cwd: string } {
  if (is.dev) {
    const backendDir = join(__dirname, '..', '..', 'backend')
    const venvPython = join(backendDir, 'venv', 'Scripts', 'python.exe')
    return {
      exe: existsSync(venvPython) ? venvPython : 'python',
      args: ['main.py'],
      cwd: backendDir
    }
  }
  // Production — bundled executable
  const backendDir = join(process.resourcesPath, 'backend')
  return {
    exe: join(backendDir, 'torch-backend.exe'),
    args: [],
    cwd: backendDir
  }
}
```

**Acceptance:** installer runs on a clean Windows 10 and Windows 11 VM with no Python installed. TORCH launches, backend starts, a real task completes.

## 1.3 Cold start — eliminate ERR_CONNECTION_REFUSED

REST calls fire before Python is listening. Fix with a proper startup gate.

**In `src/main/index.ts`:**

```typescript
type BackendPhase = 'starting' | 'ready' | 'failed'
let backendPhase: BackendPhase = 'starting'

async function waitForBackendReady(maxWaitMs = 60000): Promise<boolean> {
  const start = Date.now()
  const pollInterval = 400

  while (Date.now() - start < maxWaitMs) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 1500)
      const res = await fetch('http://127.0.0.1:8000/api/status', {
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
      })
      clearTimeout(t)
      if (res.ok) {
        backendPhase = 'ready'
        broadcastPhase()
        return true
      }
    } catch {
      // still booting — expected, do not log
    }
    await new Promise(r => setTimeout(r, pollInterval))
  }
  backendPhase = 'failed'
  broadcastPhase()
  return false
}

function broadcastPhase(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('backend:phase', backendPhase)
  }
}
```

**In the renderer**, add a `torchFetch` guard:

```typescript
let backendReady = false
window.torchAPI.onBackendPhase((phase) => { backendReady = phase === 'ready' })

export async function torchFetch(path: string, init?: RequestInit): Promise<Response> {
  // Wait for backend readiness before first call
  if (!backendReady) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (backendReady) { clearInterval(check); resolve() }
      }, 200)
      // Hard timeout so we never hang forever
      setTimeout(() => { clearInterval(check); resolve() }, 60000)
    })
  }

  const token = await window.torchAPI.getSessionToken()
  return fetch(`http://127.0.0.1:8000${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
}
```

**Acceptance:** zero `ERR_CONNECTION_REFUSED` in the console on a cold start. The UI shows a starting state until the backend is ready.

## 1.4 Auto-update

Without this, every bug you fix is invisible to installed users forever.

```bash
npm install electron-updater
```

**In `src/main/index.ts`:**

```typescript
import { autoUpdater } from 'electron-updater'

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function setupAutoUpdate(): void {
  if (is.dev) return

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', { version: info.version })
  })
  autoUpdater.on('download-progress', (p) => {
    mainWindow?.webContents.send('update:progress', { percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:ready')
  })
  autoUpdater.on('error', (err) => {
    console.error('[TORCH] Update error:', err)
  })

  autoUpdater.checkForUpdates()
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000) // every 4h
}

ipcMain.on('update:install', () => autoUpdater.quitAndInstall())
```

**In `electron-builder.yml`:**

```yaml
publish:
  provider: github
  owner: T-O-R-C-H
  repo: T.O.R.C.H
  releaseType: release
```

**UI:** a small, dismissible bar at the top of the Command Center — "A new version of TORCH is ready. Restart to update." with a Restart button. Never force it.

## 1.5 Code signing

Windows Defender SmartScreen will warn every user without this. It is the single largest install drop-off cause for unsigned desktop apps.

**Options, cheapest first:**
- Standard OV code signing certificate: ~$200-400/year (Sectigo, SSL.com). Warning disappears after enough installs build reputation.
- EV code signing certificate: ~$400-600/year. Warning disappears immediately.

**Wire into `electron-builder.yml`:**

```yaml
win:
  certificateFile: "${env.CSC_LINK}"
  certificatePassword: "${env.CSC_KEY_PASSWORD}"
  signingHashAlgorithms: ["sha256"]
  target:
    - target: nsis
      arch: [x64]
```

**If the certificate cannot be afforded before launch:** ship anyway, but add a page on the website titled "Windows says TORCH might be unsafe — here is why" explaining exactly what the warning means and how to proceed. Link it from the download button. Honesty beats a scary unexplained warning.

## 1.6 Playwright Chromium provisioning

```typescript
// In src/main/index.ts, after backend is ready
async function ensurePlaywright(): Promise<void> {
  const res = await fetch('http://127.0.0.1:8000/api/system-check', {
    headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
  })
  const status = await res.json()
  if (!status.playwright_ready) {
    mainWindow?.webContents.send('setup:playwright-needed')
    // Backend runs: playwright install chromium
    // Frontend shows a progress state: "Setting up browser automation (one time, ~2 min)"
  }
}
```

Backend endpoint `POST /api/setup/playwright` runs the install and streams progress over WebSocket.

## 1.7 Encrypt stored credentials

Gmail password and API keys currently sit in plaintext `.env`.

```typescript
// src/main/index.ts
import { safeStorage } from 'electron'

ipcMain.handle('secure:encrypt', (_, plaintext: string) => {
  if (!safeStorage.isEncryptionAvailable()) return null
  return safeStorage.encryptString(plaintext).toString('base64')
})

ipcMain.handle('secure:decrypt', (_, encrypted: string) => {
  if (!safeStorage.isEncryptionAvailable()) return null
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
})
```

All credentials go through this before being written. `.env` stores only the encrypted blob.

## 1.8 Remove or complete every fake feature

Go through every UI surface. Each item is either wired to real functionality or removed. No exceptions.

| Feature | Action |
|---|---|
| Screen Watch toggle | Wire to a real background worker, or remove from Settings and sidebar |
| Inbox sidebar item | Add real route + real inbox data, or remove from sidebar |
| Follow-ups sidebar item | Add real route + real detection, or remove from sidebar |
| History page | Confirm it reads `/api/history` from SQLite. Delete any `demoHistory` array |
| Metrics bar | Confirm it reads `/api/metrics` from SQLite. Delete any hardcoded values |
| Insights page | Wire to real data or remove from sidebar |
| Clipboard page | Verify it shows real clipboard history |

**Rule:** if a user can click it, it must do the thing it says it does.

## 1.9 Gate onboarding on first run

In `src/renderer/src/App.tsx`, before any layout renders:

```tsx
export default function App() {
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem('torch_onboarding_completed') === 'true'
    setNeedsOnboarding(!done)
    setOnboardingChecked(true)
  }, [])

  if (!onboardingChecked) return <BootScreen />

  if (needsOnboarding) {
    // ONLY onboarding renders. No sidebar, no topbar, no metrics.
    return <Onboarding onComplete={() => {
      localStorage.setItem('torch_onboarding_completed', 'true')
      setNeedsOnboarding(false)
    }} />
  }

  return <MainLayout />  // sidebar, topbar, routes
}
```

## 1.10 Remove the native menu bar and build a custom title bar

```typescript
// src/main/index.ts — main window creation
mainWindow = new BrowserWindow({
  frame: false,
  titleBarStyle: 'hidden',
  // ...rest unchanged
})
Menu.setApplicationMenu(null)  // kills File/Edit/View/Window/Help entirely
```

**Custom title bar component** — see Part E for full design spec.

## 1.11 Fix CLAUDE.md drift

CLAUDE.md documents `rollback_last_batch()` which does not exist. The real API is `register_step` / `rollback`. Correct this and audit the entire file against the actual codebase. This file is the source of truth for every future session — if it is wrong, every future session inherits the error.

## 1.12 CI

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main, develop, 'feat/**']
  pull_request:
    branches: [main, develop]

jobs:
  frontend:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint          # must FAIL the build on error
      - run: npm run test          # vitest, 30 tests

  backend:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt
      - run: pip install pytest pytest-asyncio
      - run: pytest backend/tests -v   # 137 tests

  build:
    needs: [frontend, backend]
    runs-on: windows-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: npm ci
      - run: pip install -r backend/requirements.txt pyinstaller
      - run: python backend/build_backend.py
      - run: npm run build:win
      - uses: actions/upload-artifact@v4
        with:
          name: torch-installer
          path: dist/*.exe
```

**Branch protection on `main`:** all three jobs must pass before merge.

---

# PART D — PHASE 2: THE COMPLETE UI REDESIGN

This is the full specification for the redesigned TORCH interface. Every measurement, every animation, every state.

## D.1 Design tokens — define once, use everywhere

Create `src/renderer/src/styles/tokens.css`:

```css
:root {
  /* Surfaces — dark theme */
  --surface-base:      #000000;
  --surface-raised:    #0a0a0a;
  --surface-overlay:   #0d0d0d;
  --surface-hover:     #141414;
  --surface-active:    #1a1a1a;

  /* Borders */
  --border-subtle:     #141414;
  --border-default:    #1c1c1c;
  --border-strong:     #2a2a2a;
  --border-focus:      #3a3a3a;

  /* Text */
  --text-primary:      #ffffff;
  --text-secondary:    #a1a1a1;
  --text-tertiary:     #6e6e6e;
  --text-quaternary:   #454545;
  --text-disabled:     #2e2e2e;

  /* The single accent — used ONLY for active screen control */
  --accent-control:    #3b82f6;
  --accent-control-dim:#1d4ed8;

  /* Status — expressed through opacity and weight, not hue */
  --status-active:     #ffffff;
  --status-done:       #6e6e6e;
  --status-pending:    #2e2e2e;
  --status-failed:     #6e6e6e;

  /* Typography */
  --font-ui:    'Inter', -apple-system, 'Segoe UI', sans-serif;
  --font-mono:  'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;

  --text-xs:    11px;
  --text-sm:    12px;
  --text-base:  13px;
  --text-md:    14px;
  --text-lg:    16px;
  --text-xl:    20px;
  --text-2xl:   28px;
  --text-3xl:   36px;

  /* Spacing — 4px base scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Motion — the single most important part of feeling premium */
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:   cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);

  --dur-instant:  100ms;
  --dur-fast:     160ms;
  --dur-base:     240ms;
  --dur-slow:     360ms;
  --dur-slower:   500ms;

  /* Radius — zero everywhere except message bubbles */
  --radius-none:   0;
  --radius-bubble: 10px;
  --radius-pill:   999px;
}
```

**Every component reads from these. No hardcoded hex values anywhere in the codebase.**

## D.2 Motion principles — how everything moves

These rules make the difference between "a web app in a window" and "a real desktop product."

**Rule 1: Nothing appears instantly.** Every element that enters the screen fades and moves. Minimum 160ms.

**Rule 2: Enter is slower than exit.** Entering uses `--dur-base` (240ms). Leaving uses `--dur-fast` (160ms). This makes the UI feel responsive, not sluggish.

**Rule 3: Use `--ease-out` for entrances, `--ease-in-out` for state changes.** Never use `linear` for anything a human sees.

**Rule 4: Stagger lists.** When multiple items appear, delay each by 40ms. Never all at once.

**Rule 5: Respect `prefers-reduced-motion`.**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Standard animation library** — put in `globals.css`:

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes slideUpPanel {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes pulseSoft {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.45; }
}

@keyframes breathe {
  0%, 100% { transform: scale(1);    opacity: 1; }
  50%      { transform: scale(0.92); opacity: 0.6; }
}

@keyframes stepDotFill {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

@keyframes borderPulse {
  0%, 100% {
    border-color: var(--accent-control);
    box-shadow: 0 0 24px rgba(59,130,246,0.35), inset 0 0 24px rgba(59,130,246,0.06);
  }
  50% {
    border-color: #60a5fa;
    box-shadow: 0 0 44px rgba(59,130,246,0.55), inset 0 0 32px rgba(59,130,246,0.1);
  }
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position: 200% 0; }
}
```

## D.3 The four windows

TORCH runs four Electron windows. Each has one clear job.

### Window 1 — Main (Command Center)

Frameless, 1400×900, min 1100×700, custom title bar.

**Custom title bar spec:**

```
┌──────────────────────────────────────────────────────────────┐
│  TORCH                                          ─   ▢   ✕    │  32px tall
└──────────────────────────────────────────────────────────────┘
```

- Height: 32px exactly
- Background: `var(--surface-base)`
- Bottom border: 1px `var(--border-subtle)`
- `-webkit-app-region: drag` on the bar, `no-drag` on the buttons
- Wordmark left, 16px from edge, `var(--text-md)`, weight 700, letter-spacing -0.4px
- Window controls right: 46px wide × 32px tall each, no radius
  - Hover: background `var(--surface-hover)`
  - Close hover: background `#c42b1c`, icon white (the ONE place red is allowed — it is the OS convention and users expect it)
- Icons: 10px stroke icons, `var(--text-secondary)`

### Window 2 — Command Pill (bottom center)

The always-available input when the main window is minimized.

```
Position: bottom center of primary display
          x = (screenWidth - pillWidth) / 2
          y = screenHeight - taskbarHeight - pillHeight - 12
Size: 240 × 44 (collapsed) → 420 × 44 (focused)
```

**Visual:**
- Background: `rgba(10, 10, 10, 0.88)` with `backdrop-filter: blur(24px) saturate(1.4)`
- Border: 1px `rgba(255,255,255,0.1)`
- Radius: `var(--radius-pill)` — this is the one place a full pill radius is correct, it is a floating control not a container
- Shadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`

**Contents left to right:**
1. TORCH mark, 22×22, 12px from left edge
2. Input field, flex-1, `var(--text-sm)`, placeholder `var(--text-quaternary)`
3. Mic button, 26×26, circular, `rgba(255,255,255,0.06)` background

**States and transitions:**

| State | Width | Transition |
|---|---|---|
| Idle | 240px | — |
| Hover | 252px | `width var(--dur-fast) var(--ease-out)` |
| Focused | 420px | `width var(--dur-base) var(--ease-out)` |
| Listening | 420px | mic pulses, border shifts to `rgba(255,255,255,0.2)` |

**Mic listening animation:**

```css
.pill-mic.listening {
  background: var(--text-primary);
  color: var(--surface-base);
  animation: micPulse 1.4s var(--ease-in-out) infinite;
}

@keyframes micPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.35); }
  50%      { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
}
```

**Waveform while listening** — 5 vertical bars replacing the mic icon, each animating height independently:

```css
.waveform { display: flex; align-items: center; gap: 2px; height: 16px; }
.waveform span {
  width: 2px;
  background: var(--surface-base);
  animation: wave 0.9s var(--ease-in-out) infinite;
}
.waveform span:nth-child(1) { animation-delay: 0s;    height: 6px; }
.waveform span:nth-child(2) { animation-delay: 0.1s;  height: 12px; }
.waveform span:nth-child(3) { animation-delay: 0.2s;  height: 16px; }
.waveform span:nth-child(4) { animation-delay: 0.15s; height: 10px; }
.waveform span:nth-child(5) { animation-delay: 0.05s; height: 7px; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.4); }
  50%      { transform: scaleY(1); }
}
```

### Window 3 — Task Panel (right edge)

Appears ONLY while a task is running. Shows live step-by-step narration.

```
Position: right edge, vertically centered
          x = screenWidth - panelWidth
          y = (screenHeight - panelHeight) / 2
Size: 300 × auto (max 480)
```

**Entry animation:** slides in from the right over 360ms with `--ease-out`, opacity 0→1 simultaneously.
**Exit animation:** slides out right over 240ms, then window hides.

**Layout:**

```
┌─────────────────────────────────────┐
│ TORCH WORKING              ● LIVE   │  header, 44px
├─────────────────────────────────────┤
│ CURRENT TASK                        │
│ Play Doja by Central Cee on Spotify │  task context, ~56px
├─────────────────────────────────────┤
│  ●  Opening Chrome            0.3s  │
│  │                                  │
│  ●  Navigating to Spotify     1.1s  │  step list, scrollable
│  │                                  │
│  ◉  Searching for track...          │  ← active, pulsing
│  │                                  │
│  ○  Playing track                   │
├─────────────────────────────────────┤
│ ■ Stop                        4.2s  │  footer, 44px
└─────────────────────────────────────┘
```

**Step indicator specification:**

- Done: 8px filled circle, `var(--status-done)`, label struck through at 30% opacity
- Active: 8px filled circle, `var(--text-primary)`, `animation: pulseSoft 1.2s infinite`, label white weight 500
- Pending: 8px circle, transparent fill, 1px border `var(--status-pending)`, label at `var(--text-disabled)`
- Failed: 8px circle with an × glyph, `var(--status-failed)`, label `var(--text-tertiary)`

**Connector line** between steps: 1px wide, 20px tall, `var(--border-subtle)`, centered under each dot.

**Each new step enters with:** `animation: slideInRight var(--dur-base) var(--ease-out)`.

**When a step transitions from active to done:** the dot scales 1 → 1.3 → 1 over 300ms while the fill color transitions. Subtle, but it registers.

### Window 4 — Control Border (full screen)

Full-screen transparent overlay that appears ONLY during UIA or vision screen control.

- Size: full primary display bounds
- `setIgnoreMouseEvents(true, { forward: true })` — clicks pass through completely
- `focusable: false`, `skipTaskbar: true`, `alwaysOnTop: true`

**Visual:**

```css
.control-border {
  position: fixed;
  inset: 0;
  pointer-events: none;
  border: 3px solid var(--accent-control);
  box-shadow:
    0 0 0 1px var(--accent-control-dim),
    inset 0 0 0 1px var(--accent-control-dim),
    0 0 40px rgba(59,130,246,0.4);
  animation: borderPulse 2s var(--ease-in-out) infinite;
}
```

**Corner label:**

```
┌ TORCH IN CONTROL ───────────────────
│
```

- Top-left, 14px from each edge
- Background `var(--accent-control)`, text white
- `var(--font-mono)`, 10px, letter-spacing 0.08em, padding 4px 10px
- Enters with `fadeUp` 240ms, exits with `fadeIn` reverse 160ms

**Entry:** border fades in over 360ms. **Exit:** fades out over 240ms, then the window hides.

## D.4 Onboarding — 5 screens, fully specified

The only thing visible on first launch. No sidebar, no title bar chrome beyond window controls.

**Shared layout:** centered column, max-width 380px, vertically centered in the window.

**Progress indicator:** 5 segments at top center, 40px above content.
- Each: 24px wide × 2px tall, `var(--border-default)`
- Current: `var(--text-primary)`, width animates 24px → 32px over 240ms
- Completed: `var(--text-tertiary)`
- Gap: 6px

**Screen transitions:** outgoing screen `fadeIn` reverse + `translateY(-8px)` over 200ms, then incoming screen `fadeUp` over 300ms. Total 500ms, no overlap.

### Screen 1 — Welcome

```
        [TORCH mark, 64px, breathing animation]

              Meet TORCH

     TORCH does things on your computer
     so you don't have to. Just tell it
        what you need, in plain words.

            [  Get started  ]

       No coding. No setup steps.
```

- Mark: 64px, `animation: breathe 3s var(--ease-in-out) infinite`
- Headline: `var(--text-2xl)`, weight 700, letter-spacing -0.8px
- Body: `var(--text-base)`, `var(--text-secondary)`, line-height 1.6, max-width 320px
- Button: full white, black text, 44px tall, 180px wide, no radius
- Footer note: `var(--font-mono)`, `var(--text-xs)`, `var(--text-quaternary)`

**Entry stagger:** mark 0ms → headline 80ms → body 160ms → button 240ms → note 320ms.

### Screen 2 — Name

```
        What should TORCH call you?

     So it can talk to you like a person.

        ┌────────────────────────┐
        │  Your first name       │
        └────────────────────────┘

        [ Back ]    [ Continue ]
```

- Input: 44px tall, full width of column, `var(--surface-raised)` background, 1px `var(--border-default)`, centered text
- Focus: border → `var(--border-focus)`, transition 160ms
- Invalid: border stays default, inline message appears below with `fadeUp` 200ms — `✕ Please enter a name` in `var(--text-tertiary)`, `var(--font-mono)`, 11px
- Continue disabled: `opacity: 0.35`, `cursor: not-allowed`, no color change

**Validation:** non-empty after trim, ≤50 chars, letters/numbers/spaces/hyphens/apostrophes only.

### Screen 3 — Permissions

```
        Here's what TORCH needs

     You can change any of this later
              in Settings.

     ┌───────────────────────────────┐
     │ See your files          [▪  ] │
     │ so it can find things for you │
     ├───────────────────────────────┤
     │ Open apps for you       [▪  ] │
     │ so it can actually do tasks   │
     ├───────────────────────────────┤
     │ Read your email         [  ▪] │
     │ optional — skip anytime       │
     └───────────────────────────────┘

        [ Back ]    [ Continue ]
```

**Toggle spec — rectangular, not pill:**
- Track: 40 × 22, 1px border `var(--border-strong)`, `var(--radius-none)`
- Knob: 16 × 16 square, `var(--radius-none)`
- Off: track `var(--surface-raised)`, knob `var(--text-quaternary)`, knob at left (3px)
- On: track `var(--text-primary)`, knob `var(--surface-base)`, knob at right (21px)
- Transition: `left var(--dur-fast) var(--ease-spring), background var(--dur-fast)`

**Rows enter staggered:** 60ms apart.

### Screen 4 — First task

```
        Try it out, {name}.

     Tap one and watch TORCH work.

     ┌───────────────────────────────┐
     │ 📄  Find a file            ▸  │
     │     Describe it, TORCH finds  │
     ├───────────────────────────────┤
     │ ✉   Check my emails        ▸  │
     │     See what needs a reply    │
     ├───────────────────────────────┤
     │ 🗒  Summarise a document   ▸  │
     │     Get the short version     │
     └───────────────────────────────┘
```

**On tap → working state:**

```
        Try it out, {name}.

           ▪ ▪ ▪
     Looking through your files...
```

- 3 squares (6×6, not circles), `animation: bounce 1.2s infinite`, stagger 150ms
- Status line: `var(--font-mono)`, `var(--text-sm)`, `var(--text-tertiary)`

**On completion → result state:**

```
              ┌───┐
              │ ✓ │
              └───┘

     Found it — Sales_Report.pdf
        in your Downloads folder.

   You can always undo anything TORCH does.

        [ Back ]    [ Continue ]
```

- Check box: 36×36, 1px border `var(--text-primary)`, enters with `scale(0.5) → scale(1)` over 300ms `--ease-spring`
- Result text enters 150ms after
- Reassurance line enters 300ms after, `var(--text-quaternary)`, 11px

Continue only enables after the result state is reached.

### Screen 5 — Done

```
        [TORCH mark, 64px, static]

           You're set, {name}.

     Just say what you need. TORCH asks
     before anything important, and you
          can always undo.

         [  Start using TORCH  ]

            Replay this intro
```

## D.5 Command Center — main window

### Empty state

```
              [TORCH mark, 56px]

                 What can I do?

     ┌──────────────────┐ ┌──────────────────┐
     │ 📄 Find a file   │ │ ✉ Check emails   │
     │ Describe it...   │ │ See what needs.. │
     └──────────────────┘ └──────────────────┘
     ┌──────────────────┐ ┌──────────────────┐
     │ 🗒 Summarise doc │ │ 🖥 Open an app   │
     │ Get key points   │ │ Launch anything  │
     └──────────────────┘ └──────────────────┘
```

- 2×2 grid, 12px gap
- Card: `var(--surface-raised)`, 1px `var(--border-default)`, 16px padding, no radius
- Hover: background `var(--surface-hover)`, border `var(--border-strong)`, transition 160ms
- Active (pressed): `transform: scale(0.985)`, 100ms
- Cards enter staggered 60ms apart with `fadeUp`

### Message rendering

**User message:**
- Right-aligned, max-width 70%
- Background `var(--text-primary)`, text `var(--surface-base)`
- Padding 10px 14px, `border-radius: var(--radius-bubble) var(--radius-bubble) 2px var(--radius-bubble)`
- Enters `fadeUp` 240ms

**TORCH message:**
- Left-aligned, max-width 85%
- Background `var(--surface-raised)`, 1px `var(--border-default)`, `var(--radius-bubble)`
- Label above: `TORCH` in `var(--font-mono)`, 10px, `var(--text-quaternary)`, letter-spacing 0.08em

**Streaming text:** characters appear as they arrive from the backend. Cursor block (2px × 14px, `var(--text-primary)`) blinks at 530ms interval at the end while streaming. Remove cursor when complete.

**Step list inside a TORCH message:** same spec as the Task Panel step list.

### Thinking indicator

Replaces the message content while TORCH is planning:

```
TORCH
▪ ▪ ▪  planning your task...
```

- 3 squares 5×5, `var(--text-tertiary)`, bounce with 150ms stagger
- Caption `var(--font-mono)` 11px `var(--text-quaternary)`

**Never mention a model name in this caption.**

### Stop button

Appears whenever `agentStatus !== 'idle'`. Fixed position, always visible, no scrolling required.

- Position: floating above the input, centered
- 1px border `var(--border-strong)`, transparent background
- `■ Stop` in `var(--font-mono)` 11px `var(--text-secondary)`
- Hover: border `var(--text-tertiary)`, text `var(--text-primary)`
- Enters `fadeUp` 200ms, exits `fadeIn` reverse 160ms

### Task complete state

```
TORCH
Done — I found Sales_Report.pdf and emailed it to John.

[ ↺ Undo ]
```

- Recap: one sentence, specific, plain language. Never "Task completed successfully."
- Undo button appears only if the task touched the filesystem or sent something
- Undo enters 300ms after the recap with `fadeUp`
- Undo expires after the rollback retention window — then it fades out and is replaced by `Undo no longer available` in `var(--text-disabled)`

## D.6 Sidebar

```
┌──────────────────┐
│  TORCH           │  wordmark, 16px, 20px padding
├──────────────────┤
│  ▸ Chat        ● │  active: 2px left border white
│    Today       ● │
│    History       │
│    Skills        │
│                  │
│  WORK            │  section label, mono 9px
│    Inbox      3  │
│    Files         │
│    Follow-ups 2  │
│                  │
│  SHORTCUTS       │
│    Check emails ▸│
│    Post update  ▸│
│    + Add         │
│                  │
│  ACTIVITY        │
│    Clipboard 12  │
│    Screen Watch ○│
│    Insights      │
│                  │
├──────────────────┤
│  Y  Yusuf     ⚙  │  footer
└──────────────────┘
```

- Width: 240px fixed
- Active item: 2px left border `var(--text-primary)`, background `var(--surface-raised)`, text white
- Inactive: text `var(--text-tertiary)`
- Hover: background `var(--surface-hover)`, text `var(--text-secondary)`, transition 120ms
- Section labels: `var(--font-mono)`, 9px, `var(--text-disabled)`, uppercase, letter-spacing 0.12em
- Item font: `var(--text-base)` — minimum 13px, must be readable
- Badge counts: `var(--text-primary)` square, `var(--surface-base)` text, 16×16, mono 10px

**Remove any item that does not have a working route and real data.**

---

# PART E — PHASE 3: VOICE

Voice is currently partially working (`pyttsx3` TTS, Whisper STT, speechSynthesis fallback). Make it feel real.

## E.1 The voice pipeline

```
Wake word ("Hey TORCH") or hotkey (Ctrl+Shift+Space)
    ↓
Pill expands + waveform animation starts (instant, <50ms)
    ↓
Audio capture begins (Web Audio API in renderer, not Python)
    ↓
Stream to backend over WebSocket as chunks
    ↓
Whisper transcribes (local, streaming if possible)
    ↓
Partial transcript appears in the pill as the user speaks
    ↓
Silence detected (800ms) → capture stops → final transcript
    ↓
Transcript sent through the normal agent pipeline
    ↓
Response streams back
    ↓
TTS speaks the recap (not the full step list — just the recap)
```

## E.2 Push-to-talk implementation

Capture audio in the renderer, not Python — lower latency, no PyAudio dependency issues.

```typescript
class VoiceCapture {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private silenceTimer: number | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null

  async start(onLevel: (level: number) => void, onComplete: (blob: Blob) => void) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
    })

    // Level meter for the waveform animation
    this.audioContext = new AudioContext()
    const source = this.audioContext.createMediaStreamSource(stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    source.connect(this.analyser)

    const data = new Uint8Array(this.analyser.frequencyBinCount)
    const tick = () => {
      if (!this.analyser) return
      this.analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      onLevel(avg / 255)

      // Silence detection — 800ms below threshold ends capture
      if (avg < 12) {
        if (!this.silenceTimer) {
          this.silenceTimer = window.setTimeout(() => this.stop(), 800)
        }
      } else {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer)
          this.silenceTimer = null
        }
      }
      requestAnimationFrame(tick)
    }
    tick()

    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    this.chunks = []
    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data)
    this.mediaRecorder.onstop = () => {
      onComplete(new Blob(this.chunks, { type: 'audio/webm' }))
      stream.getTracks().forEach(t => t.stop())
      this.audioContext?.close()
    }
    this.mediaRecorder.start(100)
  }

  stop() {
    this.mediaRecorder?.stop()
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null }
  }
}
```

**The waveform bars read the real level** from `onLevel` — bars scale to actual audio input, not a fake loop. This single detail is what makes voice feel real rather than decorative.

## E.3 TTS quality ladder

Try in order, fall back silently:

1. **Piper TTS** (local, free, natural sounding) — bundle a small voice model (~60MB)
2. **Web Speech API** `speechSynthesis` (built into Electron, robotic but instant, zero setup)
3. **pyttsx3** (current, Windows SAPI)

Speak only the final recap sentence. Never read step lists aloud — that is annoying.

Add a Settings toggle: **Speak responses aloud** — default OFF. Voice output should be opt-in.

## E.4 Wake word

The current `WakeWordDetector` uses Google Web Speech for wake word detection, which requires internet and sends audio to Google. Replace with a local wake word engine:

- **openWakeWord** (open source, local, trainable) or
- **Porcupine** (free tier available, very accurate, low CPU)

If neither can be shipped, **hide the wake word feature entirely** and rely on the hotkey. Do not ship a wake word that sends audio to Google without the user knowing.

---

# PART F — PHASE 4: QUALITY GATES

## F.1 Test coverage gaps to close

Currently untested: vision loop, email tool, browser tool, `useWebSocket.ts`.

**`useWebSocket.ts` harness:**

```typescript
// src/renderer/src/hooks/__tests__/useWebSocket.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  readyState = 0
  onopen: ((e: Event) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onclose: ((e: CloseEvent) => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
  }
  send(data: string) { this.sent.push(data) }
  close() { this.readyState = 3; this.onclose?.(new CloseEvent('close')) }
  simulateOpen() { this.readyState = 1; this.onopen?.(new Event('open')) }
  simulateMessage(data: object) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }
}

beforeEach(() => {
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
})

describe('useWebSocket', () => {
  it('sends token as query param on connect', () => { /* ... */ })
  it('resolves the live socket after reconnect — not a stale ref', () => { /* the bug that was fixed */ })
  it('queues a send when the socket is not open', () => { /* ... */ })
  it('does not invent a timeout when the backend replied', () => { /* the watchdog bug */ })
})
```

**Email tool:** mock `smtplib.SMTP`, assert the message is built correctly, assert nothing sends without approval.

**Browser tool:** mock Playwright, assert fallback chain order (POST → second endpoint → headless).

**Target: 200+ tests total, all green, all in CI.**

## F.2 Regression prevention

Add a `tests/regression/` directory with one test per bug that was ever found in production. Every bug fixed gets a test that would have caught it. The six bugs found this session all get one.

## F.3 Manual QA checklist

Create `TESTING.md`. Before every release, one person runs this entire list on a clean Windows VM.

```
INSTALL
[ ] Installer runs on clean Win10 with no Python — app launches
[ ] Installer runs on clean Win11 with no Python — app launches
[ ] Windows Defender warning appears (or does not, if signed) — documented either way
[ ] Uninstall removes all files, database, and backups

FIRST RUN
[ ] Onboarding is the only thing visible — no sidebar, no metrics
[ ] Name validation rejects empty, whitespace, 51+ chars, symbols
[ ] All 5 screens transition smoothly, no jump cuts
[ ] First task demo actually runs and shows a real result
[ ] After completing, relaunch → onboarding does not show again

CORE TASKS
[ ] "find my downloads folder" → returns real results
[ ] "open notepad" → notepad opens
[ ] "send an email to X" → HITL fires, nothing sent until approved
[ ] Cancel an email HITL → nothing sent, task stops cleanly
[ ] "delete test.txt" → HITL fires → approve → file deleted → Undo restores it
[ ] "search the web for X" → real results, or honest "I could not search"

SCREEN CONTROL
[ ] UIA control clicks the correct element by name
[ ] Blue border appears during control, disappears after
[ ] Clicks pass through the border window
[ ] No GPU: local vision is not offered, honest message shown

VOICE
[ ] Hotkey opens the pill and starts capture within 200ms
[ ] Waveform reacts to real audio level
[ ] Silence ends capture after ~800ms
[ ] Transcript is accurate for a normal sentence
[ ] TTS speaks the recap only, not the step list

RELIABILITY
[ ] Stop button cancels within 2s during a running task
[ ] Kill the Python process → Electron detects and restarts it
[ ] Cold start: no ERR_CONNECTION_REFUSED in console
[ ] Disconnect WiFi mid-task → honest error, no fake timeout
[ ] Send 2 commands rapidly → second queues or is rejected clearly

HONESTY
[ ] No raw error string ever appears in chat
[ ] No model name appears anywhere in the UI
[ ] No feature visible in the UI that does nothing
[ ] Metrics show real numbers or are hidden
[ ] A failed task says it failed
```

---

# PART G — PHASE 5: LAUNCH INFRASTRUCTURE

## G.1 Landing page

Single page, matching the app's design language exactly.

Sections in order: nav → hero (headline, subhead, download button, demo video) → live demo GIF → features grid (6 items) → how it works (3 steps) → pricing (3 tiers) → CTA → footer.

**Must include:** a download button that works, a waitlist email capture, a link to the privacy policy, a link to GitHub.

## G.2 Privacy policy and terms

Plain English, not legal jargon. Must clearly state:

- TORCH takes screenshots during tasks. They are processed locally and never uploaded.
- Clipboard history is stored locally and encrypted.
- Email credentials are stored locally and encrypted.
- No usage data is collected without explicit opt-in.
- If a cloud AI provider is configured, the user's commands are sent to that provider — name which one and link their policy.
- How to delete all local data.

## G.3 Crash and feedback reporting

An in-app "Something went wrong" button on every task result. Captures: task command, step list, error, app version, OS version. Sends to a simple endpoint or opens a pre-filled GitHub issue.

**No automatic telemetry without consent.**

## G.4 Demo video

60–90 seconds. Screen recorded at 1080p60. Structure:

```
0:00  TORCH pill at the bottom of a normal desktop
0:04  User types: "play Doja by Central Cee on Spotify"
0:07  Right panel slides in, blue border appears
0:10  Chrome opens, Spotify loads, TORCH clicks through
0:20  Music starts playing
0:24  Panel shows "Done" recap
0:28  Cut to: "find my Q2 report and email it to my manager"
0:38  HITL approval card appears — user reviews, approves
0:44  Sent. Undo button visible.
0:50  Logo + "TORCH — your computer, automated" + download URL
```

No voiceover needed. Captions only. Music optional.

---

# PART H — EXECUTION ORDER

Do not deviate from this order. Each phase unblocks the next.

## Week 1 — Find out what is actually broken

1. Run `build:win`. Document exactly what happens.
2. Fix CLAUDE.md drift (`rollback_last_batch` → real API).
3. Set up CI with the existing 167 tests.
4. Audit every sidebar item and UI surface — list every fake feature.

**Deliverable:** you know whether packaging works, tests run automatically, and you have a definitive list of fake features.

## Week 2 — Packaging and cold start

5. PyInstaller bundle of the backend.
6. Wire bundled backend into electron-builder.
7. Cold start gating — eliminate ERR_CONNECTION_REFUSED.
8. Test the installer on a clean VM.

**Deliverable:** an installer that works on a machine with no Python.

## Week 3 — Honesty pass

9. Remove or complete every fake feature.
10. Gate onboarding on first run.
11. Remove the native menu bar, build the custom title bar.
12. Encrypt credentials with safeStorage.
13. Auto-update via electron-updater.

**Deliverable:** nothing in the UI lies. Users can receive updates.

## Week 4 — Screen control rebuild

14. Build `uia_control.py` with the UIA element tree approach.
15. GPU detection — disable local vision honestly when absent.
16. Wire the tier fallback chain (named tool → UIA → Gemini vision → local vision).
17. Control border window.

**Deliverable:** TORCH can control any Windows app at 66ms per action.

## Week 5 — The UI redesign

18. Design tokens file — replace every hardcoded value.
19. Command pill window (bottom center).
20. Task panel window (right edge).
21. Onboarding redesign — all 5 screens with full animation spec.
22. Command Center redesign — empty state, messages, streaming, stop, recap, undo.
23. Sidebar cleanup.

**Deliverable:** the app looks and moves like a finished product.

## Week 6 — Voice and polish

24. Renderer-side audio capture with real level metering.
25. Waveform reacting to real audio.
26. TTS ladder (Piper → speechSynthesis → pyttsx3).
27. Wake word: local engine or hide the feature.
28. Close test coverage gaps to 200+ tests.

**Deliverable:** voice feels instant and real.

## Week 7 — Launch prep

29. Code signing certificate (start this in week 1 — procurement takes time).
30. Landing page.
31. Privacy policy and terms.
32. Demo video.
33. Full manual QA on clean VMs.
34. Crash reporting.

**Deliverable:** ready to publish.

---

# PART I — DEFINITION OF DONE

TORCH is production ready when every one of these is true:

**Installation**
- [ ] A person downloads an installer, runs it on a Windows machine with nothing pre-installed, and TORCH works
- [ ] No manual terminal commands are required at any point
- [ ] Uninstall removes everything

**Honesty**
- [ ] Every feature visible in the UI does what it says
- [ ] No raw error, exception, model name, or technical string ever reaches the user
- [ ] A failed task says it failed, specifically
- [ ] A successful task says what it actually did, specifically
- [ ] All metrics reflect real data

**Safety**
- [ ] Backend is unreachable from the network
- [ ] Every destructive action requires approval
- [ ] Every completed action can be undone within the retention window
- [ ] Stop cancels within 2 seconds, always
- [ ] Credentials are encrypted at rest

**Quality**
- [ ] 200+ tests, all passing, all running in CI
- [ ] CI blocks merge to main on any failure
- [ ] The manual QA checklist passes completely on a clean VM
- [ ] Auto-update delivers a new version to an installed app

**Feel**
- [ ] Nothing appears without animating
- [ ] Cold start shows a clear state, never a blank window or console errors
- [ ] The voice waveform reacts to real audio
- [ ] Screen control runs at UIA speed, not vision speed
- [ ] A non-technical person completes onboarding and a first real task in under 5 minutes without help

When all of those are checked, ship it.
