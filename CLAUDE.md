# TORCH — Claude Code Context File

Read this entire file before touching any code. Every decision here was made deliberately.

---

## What TORCH is

TORCH is an autonomous PC automation agent for Windows. The user types or speaks a plain-English command ("find my invoice and email it to John") and TORCH executes it on their real computer — finding files, sending emails, opening apps, controlling the screen with vision AI, and doing anything a person could do at a keyboard.

It is built for everyone — non-technical users, students, developers, freelancers, small business owners. The non-technical user experience is the design constraint that governs every decision.

**The two core modes:**
- **Do Mode** — TORCH executes tasks by calling named tool functions (find_file, send_email, open_app etc.) or by using a vision loop (Qwen2.5-VL via Ollama) that literally sees the screen and controls the mouse/keyboard like a human
- **See Mode** — TORCH takes a screenshot, analyzes what's on screen, and guides the user or acts on what it sees directly (Clicky-style screen-aware assistant)

---

## Tech Stack

**Frontend:** React 19 + TypeScript + Tailwind CSS 4 + Zustand 5 + Framer Motion + React Router 7
**Backend:** Python 3.11 + FastAPI + WebSocket
**Shell:** Electron 39 (wraps the whole app as a Windows desktop application)
**AI providers:** Gemini, DeepSeek, OpenAI, Claude, and explicit Ollama model selection through the provider abstraction. Automatic selection currently prefers configured cloud providers in that order; there is no implemented fast/reasoning local-tier router.
**Vision model:** Qwen2.5-VL 7B via Ollama (screen control — sees screen and generates mouse/keyboard actions)
**Voice:** OpenAI Whisper (local, for STT) + pyttsx3 (local TTS)
**Database:** SQLite (local, torch.db)
**Memory:** SQLite-backed task, contact, file, and habit records. ChromaDB is installed but is not used by the current storage implementation.
**Screen capture:** PyAutoGUI + mss
**Browser automation:** Playwright

---

## Project Structure

```
T.O.R.C.H/
├── backend/
│   ├── main.py              # FastAPI app, WebSocket handler, all REST endpoints
│   ├── agent/
│   │   ├── brain.py         # Deterministic routes + provider-backed JSON planning
│   │   ├── planner.py       # Plan validation and tool routing
│   │   ├── executor.py      # Executes each step, HITL flow, rollback, step phrasing
│   │   ├── context.py       # Conversation history (10-turn rolling window)
│   │   └── providers/       # Gemini, DeepSeek, OpenAI, Claude, Ollama abstractions
│   ├── tools/               # All tool functions
│   │   ├── files.py         # find_file, move_file, copy_file, delete_file, read_file
│   │   ├── email.py         # send_email, read_inbox
│   │   ├── system.py        # open_app, close_app, run_terminal
│   │   ├── browser.py       # web search, open_browser (Playwright)
│   │   ├── screen.py        # screenshot, analyse_screen
│   │   ├── voice.py         # speak(), listen(), WakeWordDetector
│   │   └── vision_control.py # Qwen2.5-VL vision loop — sees screen, clicks/types
│   ├── errors/
│   │   └── plain_language.py # Converts all raw errors to plain-English user messages
│   ├── memory/
│   │   └── storage.py       # SQLite ops: save_task(), get_tasks(), get_stats_for_date()
│   ├── agent/rollback.py    # register_step() before destructive ops, rollback(message_id)
│   ├── auth.py              # Session-token checks for REST + WebSocket
│   └── config/
│       └── settings.py      # All config (API keys, ports, auth token, feature flags)
├── src/
│   ├── main/
│   │   └── index.ts         # Electron main process — spawns Python, creates windows, IPC
│   ├── preload/
│   │   └── index.ts         # Electron preload — exposes torchAPI bridge to renderer
│   └── renderer/src/
│       ├── App.tsx           # React router, all routes
│       ├── store/
│       │   └── torchStore.ts # Zustand global state (agentStatus, messages, metrics)
│       ├── hooks/
│       │   └── useWebSocket.ts # WebSocket connection, message handling
│       ├── pages/
│       │   ├── Command.tsx   # Main chat page (Command Center)
│       │   ├── Onboarding.tsx # Current 4-step onboarding flow
│       │   ├── Settings.tsx  # Settings page
│       │   ├── History.tsx   # Task history
│       │   └── ControlBorder.tsx # Full-screen blue border during vision control
│       └── components/
│           ├── overlay/      # FloatingOverlay and GuidanceOverlay renderers
│           ├── layout/
│           │   ├── Sidebar.tsx
│           │   └── Topbar.tsx
│           ├── chat/
│           │   ├── ChatArea.tsx
│           │   ├── CommandInput.tsx
│           │   ├── ConversationTurn.tsx
│           │   └── StepList.tsx
│           └── ui/TorchLogo.tsx # The logo (wraps resources/logo.png)
```

---

## Design System

TORCH uses a **light theme**. The single source of truth is the `@theme` token
block at the top of `src/renderer/src/styles/globals.css` — read it before
adding any color, and use the `--color-torch-*` tokens rather than hardcoding
hex values, so a future theme change stays a one-file edit.

**Colors:**
- Background: `#f4f4f5` — surfaces `#ffffff`
- Text: muted greys, defined as `--color-torch-text*` tokens
- Status dots may use color (`#10b981` connected, `#ef4444` disconnected) — this
  is the one place color carries meaning
- The blue border (`#3b82f6`) appears full-screen during vision control

**Typography:**
- UI text: Inter or system sans-serif
- Labels, status, mono: `JetBrains Mono` or `Courier New` (monospace)

**Shape and depth:**
- The floating overlay companion is deliberately glassmorphic (translucent
  white + `backdrop-filter` blur). This is intentional design, not a bug.
- Everything else stays flat and calm — compact type, restrained hierarchy.

> Historical note: this project began with a near-black, zero-radius,
> no-glassmorphism design system. It was deliberately replaced by the current
> light aesthetic in Aug 2026. If you find a component that still looks dark,
> that is legacy, not the target.

---

## UI Architecture — The Current Four Windows

`src/main/index.ts` currently creates four Electron windows:

**1. Main window** — the full Command Center with sidebar and chat. It is frameless and uses the custom `Topbar` controls.

**2. Floating overlay** — a resizable 360×180 glassmorphic command companion. It is positioned at the saved location or the bottom-right of the active work area and appears when the main window is minimized or the global shortcut is pressed.

**3. Guidance overlay** — a click-through, full virtual-desktop window used to point at or narrate screen locations during companion guidance.

**4. Control border** — a click-through, full virtual-desktop window with a blue pulsing border. It appears only while vision control is active.

The production master plan replaces the floating overlay with a bottom-center command pill plus a task-scoped right panel during the later UI milestone. Those windows do not exist yet; do not describe them as implemented.

---

## Core Data Flow

```
User types command in the floating overlay or Command Center
→ Zustand store updates (agentStatus → processing)
→ useWebSocket sends message over ws://127.0.0.1:8000/ws?token=<session token>
→ FastAPI checks the token before accepting → process_command()
→ brain.py sends to LLM → gets JSON plan (array of steps with tool names)
→ planner.py validates the plan and sets requires_approval from HITL_TOOLS
→ executor.py executes each step:
    - Pauses on any step planner.py marked requires_approval
    - If risky: sends hitl_request over WS, awaits asyncio.Event for approval
    - If safe: calls tool function directly
    - Each step: sends step_update over WS (label, status: active/done/failed)
    - Resolves {{step_N_result}} references between steps
    - On success: saves to SQLite via storage.py
    - On failure: translates error via plain_language.py
→ WS streams step_update messages to frontend in real time
→ Frontend renders live steps in FloatingOverlay/NarrationView or the main ChatArea
→ Task complete: sends agent_response with plain-language summary
→ Undo button appears (wired to rollback_manager.rollback(message_id) in rollback.py)
```

---

## Vision Control Loop

When no named tool covers the task (e.g. "play Doja on Spotify", "fill in this form"), TORCH falls back to the vision loop:

```python
# backend/tools/vision_control.py
# 1. Take screenshot with mss
# 2. Send screenshot + task to Qwen2.5-VL:7b via Ollama
# 3. Model returns JSON: {"action": "click", "x": 450, "y": 230, "reason": "..."}
# 4. Execute with PyAutoGUI
# 5. Repeat until model returns {"action": "done"} or max 25 steps
```

When vision control starts: emit `vision_control_start` WS message → frontend shows blue border window
When vision control ends: emit `vision_control_end` WS message → frontend hides blue border window

---

## Safety Rules — Never Break These

- **Backend auth**: Electron generates a session token at launch, passes it to
  Python as `TORCH_AUTH_TOKEN`, and exposes it to the renderer over IPC. Every
  REST route requires it in the `Authorization` header; the WebSocket requires
  it as `?token=` and is rejected **before** `accept()`. The backend binds to
  `127.0.0.1` only. Never add a route that bypasses this, and never widen the
  bind address — this agent can run terminal commands and send mail.
- **HITL always fires** for the tools in `HITL_TOOLS` (`backend/agent/planner.py`):
  send_email, post_social, send_message, delete_file, download_file, run_terminal.
  Approval is decided in Python, never by the model — `validate_plan` recomputes
  it and overrides whatever the plan claimed.
- **Vision control** gets a second check: `_vision_task_requires_approval` flags
  tasks that imply purchases, sending/uploading, deleting, terminal access, or
  security-setting changes.
- **HITL never fires** for read-only tools: find_file, read_file, search_web,
  screenshot, open_app. Prompting on these trains users to click through.
- **move_file, create_folder, zip_files** are covered by Undo rather than a
  prompt — they are in `REVERSIBLE_TOOLS` (`backend/agent/rollback.py`).
- **`run_terminal` keeps `shell=True`** — running arbitrary commands is the
  feature. Its safety comes from mandatory approval plus session auth, not from
  a command blocklist (trivially bypassed, false confidence). Nothing else in
  `backend/` may use `shell=True`.
- **Rollback snapshots** are taken AFTER HITL approval, immediately before execution — never before
- **The Stop button** must cancel the current task within 2 seconds — wired to `executor.stop_task()`
- **Undo** must appear after every task that touched the filesystem
- **Plain language errors only** — no stack traces, no error codes, no technical strings ever reach the chat UI
- **A failed task must say so in the chat.** Never let a task end silently, and
  never report failure as success.

---

## Language Rules for User-Facing Text

TORCH is used by non-technical users. Every string visible to the user must pass this test: would someone who has never opened a terminal understand this?

- Never show model names (no "Gemini", "Llama", "Phi-4", "GPT")
- Never show tier names ("escalating to reasoning tier")
- Never show raw error messages or exception types
- Never show HTTP status codes
- Step narration must be plain English present tense: "Looking for your file..." not "Executing find_file(query='...')"
- Status must be plain: "Ready" not "AGENT: IDLE"
- Connection state: "Connecting..." (cold start), "Reconnecting..." (after drop), never "OFFLINE" in red

---

## Planned Floating Pill + Right Panel

This is a later production-plan milestone, not the current implementation. It will replace the current floating overlay with two Electron windows:

**Pill window** (`createPillWindow()`):
- Always-on-top, frameless, transparent, not in taskbar
- Positioned: bottom-center of screen, just above taskbar (y = screenHeight - taskbarHeight - pillHeight - 8px)
- Size: ~220px wide, ~40px tall
- Contains: TORCH logo mark (R), text input, mic button
- Shows when main window is minimized, hides when main window is focused
- Clicking input or sending a command works exactly like Command Center — same WS pipeline

**Right details panel** (`createRightPanel()`):
- Always-on-top, frameless, transparent, not in taskbar
- Positioned: right edge of screen, vertically centered
- Width: 220px, slides in from right
- Shows ONLY when a task is running (agentStatus !== 'idle')
- Hidden when task completes (after 3 second delay showing the recap)
- Contains: task name, live step list with status indicators, elapsed time, Stop button
- Receives the same step_update WS messages as the main window

Do not implement this before the ordered packaging, cold-start, and honesty milestones are complete.

---

## Tests

```bash
cd backend && python -m pytest        # backend  (pytest.ini, tests live in backend/tests/)
npm run test                          # frontend (vitest, *.test.ts beside the source)
npm run typecheck && npm run lint
```

Backend test deps are in `backend/requirements-dev.txt`. Fixtures live in
`backend/tests/conftest.py` — `auth_headers` for authenticated requests,
`temp_db` for an isolated database (a temp **file**, not `:memory:`: every query
opens a fresh connection and in-memory databases are not shared between them).

Tests to keep passing whatever else changes: `test_auth.py` (nothing reaches the
agent unauthenticated), `test_system_tools.py` (nothing on the `open_app` path
reaches a shell), `test_planner_hitl.py` (the approval policy), and
`test_main_completion_recap.py` (a failed task always says so).

---

## Known Issues / Active Work

**Open:**

1. **Status label inconsistency** — the floating overlay shows a colored status
   dot, the main Command Center input shows the word "Ready". Pick one and use
   it in both places.
2. **Standalone backend + Electron collide** — Electron reuses an already-running
   backend only if it can authenticate to it. A backend started by hand (with its
   own generated token) is not reusable, and Electron's health check hardcodes
   port 8000, so the fallback spawn lands on a different port and reports
   unhealthy. Only affects the run-the-backend-in-a-terminal dev workflow.
3. **`useWebSocket.ts` still keeps its socket in module-level singletons**
   (`sharedSocket`, `sharedReconnectTimer`, …), shared by every consumer
   rather than scoped per hook instance. That design is deliberate — one
   socket for the whole renderer — but it is sharp, and it is now covered:
   `useWebSocket.test.tsx` drives the real hook against a fake `WebSocket`
   using `react-dom/client` + `act` (no testing-library in the stack).
   `__resetSocketStateForTests()` clears the singletons between tests.

   **Anything added here must guard on `isCurrent(ws)` before touching shared
   state.** `close()` is asynchronous, so a replaced socket's `onclose` runs
   after its successor is already open; unguarded, it cleared `wsConnected`,
   killed the live ping timer, and failed the running task's steps.
4. **Windows packaging is not production-ready** — `build:win` copies the full
   development virtual environment twice (about 2.6 GB unpacked on the Aug 26 audit),
   and the normal local build is blocked when electron-builder cannot create
   symlinks while extracting its signing helper. Replace this with the planned
   PyInstaller runtime before release.
5. **Cold-start REST calls are not gated** — Electron creates all renderer
   windows before starting the backend, and `torchFetch` does not wait for the
   published backend-health state.
6. **Visible honesty gaps remain** — Screen Watch still falls back to
   `INITIAL_DEMO_ACTIVITY` when it has no real activity, and several tool
   pages are shells (`pages/tools/Files.tsx` has a Find button with no
   handler and is still styled for the old dark theme; `pages/FollowUps.tsx`
   describes a feature that does not exist). Both were removed from the
   sidebar rather than left advertised. Multiple Settings controls are still
   not wired. See `PRODUCTION_READINESS_AUDIT.md` for the verified inventory.
   Insights is **no longer** in this list — see below.
7. **Credentials are plaintext** — `/api/settings` persists API keys and the
   Gmail app password directly to the root `.env`; Electron `safeStorage` is
   not implemented.
8. **`npm run lint` does not pass clean** — `pages/Onboarding.tsx` has one
   `react-hooks/set-state-in-effect` error, in the effect that reacts to
   `lastTaskOutcome` to end the first task and advance the screen. The effect
   is doing state-machine work that belongs in the WS message handler or a
   reducer, not in a render effect. Fix it there rather than suppressing the
   rule. Until then `lint` is not a usable gate, so **`npm run lint` is not
   wired into CI** — do not assume a green build means lint passed.

   Note also that a full `npm run lint` takes well over 8 minutes on this
   repo; lint the files you touched (`npx eslint <path>`) while working.

**Fixed (Aug 2026) — do not "re-fix" these:**

- Cat mascot — gone. The logo component is `ui/TorchLogo.tsx` (there is no `TorchMark.tsx`).
- Overlay is white — **not a bug.** The light glassmorphic overlay is the intended design.
- Native menu bar — `frame: false` + `Menu.setApplicationMenu(null)`; the custom title bar is `layout/Topbar.tsx`.
- Model picker option text — `/api/models` returns speed/depth labels ("Automatic", "Faster", "More thorough"). The selected non-auto id still leaks through the input metadata and remains an open honesty issue.
- False success on failure — `process_command` returns before the success recap; a failure now sends its own plain-language message.
- Raw error in chat — `validate_plan` translates unknown-tool errors before the plan is sent, with a frontend backstop in `utils/plainLanguage.ts`.
- Stop button — `executor.stop_task()` exists and releases pending approvals.
- Session token — implemented; see the auth bullet in Safety Rules.
- Onboarding gating — `onboardingComplete` is checked before routing.
- Insights fabricated data — the page read from a hardcoded array (a literal
  `87%` "accuracy", an invented weekly chart, "4.2 hours saved"). It now
  renders `GET /api/insights`, backed by `storage.get_insights()`, which
  derives everything from rows in `tasks`. **Accuracy and time-saved are
  deliberately absent** — nothing in TORCH measures either, and
  `test_insights.py` asserts those keys never come back. `success_rate` and
  `avg_duration_ms` are `None` rather than `0` when there is nothing to
  divide, so the page shows an empty state instead of a confident 0%.
- Task durations were never recorded — `save_task` accepted `duration_ms` but
  all three call sites in `process_command` omitted it, so every row held 0.
  Now timed from command arrival via `_elapsed_ms`.
- Onboarding clobbering capability settings — the permissions screen writes
  all three capabilities on Continue, and its toggles were seeded from
  constants, so re-running onboarding silently switched off whatever the user
  had enabled (it turned `TORCH_ALLOW_EMAIL` off twice during development).
  It now seeds from `GET /api/settings` via `utils/permissions.ts` and
  refuses to save if that read has not landed.

  Note that the backend does **not** re-read `.env` while running: editing
  that file by hand does nothing until restart, and the next settings write
  will overwrite your edit from memory. Change capabilities through
  `/api/settings`, not the file.

---

## What NOT to Do

- Do not hardcode colors — use the `--color-torch-*` tokens in `globals.css`
- Do not show any model/tier/technical name to the user
- Do not let any raw Python exception reach the chat UI
- Do not make HITL fire for read-only operations
- Do not let the model decide its own approval requirement — policy lives in `planner.py`
- Do not optimistically mark a step as done before the backend confirms it
- Do not use `shell=True` in any subprocess call **except** the existing
  `run_terminal`, which is intentional and approval-gated
- Do not add a route or WS path that skips the session-token check
- Do not bind the backend to anything other than `127.0.0.1`
- Do not add any new npm packages without checking if something already in the stack covers it
- Do not create new Zustand stores — use the existing `torchStore.ts`
- Do not add new WebSocket message types without adding them to the handler in `useWebSocket.ts`

---

## Repo

GitHub: https://github.com/T-O-R-C-H/T.O.R.C.H
Team size: 10 contributors
Founder: Yusuf Muyideen (@Muyideen-js)
Stage: Pre-launch, active development
Location: Ilorin, Nigeria
