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
**Voice:** capture runs in the renderer (`hooks/useAudioCapture.ts` — Web Audio,
real level metering, 16 kHz mono WAV). Transcription is local-only via Whisper
through SpeechRecognition; **the `whisper` package is not currently installed**,
so `/api/voice/capabilities` reports `speech_to_text: false` and the UI hides
the microphone rather than offering it. There is **no cloud fallback and no
wake word** — see the voice note under Safety Rules. TTS is pyttsx3 (local).
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

TORCH has a **dark and a light theme**. The user picks System / Light / Dark
in Settings → Preferences; System follows the OS and is the default.

- `styles/globals.css` — base styles; the `@theme` block holds the light palette.
- `styles/tokens.css` — every non-colour token, the state tints, and the dark
  palette (`:root[data-theme='dark']`), which overrides the same names.
- `styles/agent.css` — the window chrome and the conversation. Loads last.
- `utils/theme.ts` — reads/applies the choice as `data-theme` on `<html>`.
  `index.html` applies it inline before first paint; the two must agree.

**The one rule: never write a literal colour.** Use `--color-torch-*`,
`--surface-*`, `--text-*`, `--border-*`, `--tint-*`, `--shadow-*`. A component
built only on tokens works in both themes without knowing which is active.
Do not use `@media (prefers-color-scheme)` in component CSS — the theme is
`data-theme`, and the two disagree whenever the user pins a theme.

**Colour carries meaning, so it is rare.** Neutral greys everywhere; green =
done/ready, amber = waiting on the user, red = failed or recording,
`--brand` (the flame orange) = work in progress. Never a large fill.

**Typography:** the operating system's fonts (`--font-sans`, `--font-mono`).
Nothing is downloaded — the app used to import Inter from Google Fonts on
every launch, which contradicted "nothing leaves your machine".

**Layout:** title bar + sidebar are one quiet "chrome" surface; the page sits
in it as a lifted panel. The conversation is a single centred column
(`--chat-column`) with the composer (`components/input/PromptInput.tsx`)
pinned beneath it. User messages are bubbles on the right; TORCH's replies
are plain text on the left, followed by `components/chat/StepTimeline.tsx`.

**Status is reported once**, by the chip in the title bar (`Topbar.tsx`).
Do not add a second connection/activity indicator anywhere else.

**Notices:** use `notify()` from `utils/notify.ts`, never `alert()`.
**Errors from a fetch:** pass them through `describeError()` in
`utils/plainLanguage.ts`, never print `err.message`.

---


## UI Architecture — Windows

`src/main/index.ts` creates these Electron windows, each a route in `App.tsx`:

- **Main window** (`/`) — frameless; title bar, sidebar, and the pages.
- **Command pill** (`/pill`) — small always-on-top input, shown when the main
  window is minimized or the global shortcut is pressed.
- **Task panel** (`/task-panel`) — live steps for the running task.
- **Companion** (`/companion`) — the screen-aware side panel. Deliberately
  dark in both themes (see `TORCH_overlay_companion_spec.md`).
- **Guidance overlay** (`/guide`) and **control border** (`/control-border`) —
  click-through, full-desktop; pointing during guidance, and the blue border
  while vision control is driving the screen.

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
- **Voice never leaves the machine.** `tools/voice.py` must not reach a cloud
  recogniser. `listen()` used to fall back to Google's Web Speech API whenever
  the local model was missing — which was always — so every voice command was
  uploaded while the app called itself local-first. `WakeWordDetector` was
  worse: it held the microphone open and sent every captured phrase to Google
  to test for the wake word. Both are gone; `test_voice_local.py` asserts
  `recognize_google` does not appear anywhere in the module. If transcription
  cannot run locally, the feature is **hidden**, not degraded to the cloud.
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

1. **No code-signing certificate.** The installer is unsigned, so Windows
   SmartScreen will warn on install. See `CODE_SIGNING.md`.
2. **Clean-machine install is unverified.** The PyInstaller backend bundle
   (`backend/build_backend.py`) and the electron-builder config exist, but the
   installer has not been run on a Windows VM with no Python. Playwright's
   Chromium is still not provisioned by the installer.
3. **Social posting does not post.** `tools/social.py` opens the site with the
   text ready; the UI says so. Do not describe it as posting.
4. **Screen Watch has no capture worker.** The page shows real log entries or
   an empty state, never invented activity, but nothing records yet.
5. **`useWebSocket.ts` keeps its socket in module-level singletons** by design
   (one socket per renderer). Anything added there must guard on
   `isCurrent(ws)` before touching shared state; see `useWebSocket.test.tsx`.
6. **The JS bundle is one 1.2 MB chunk.** Fine for a desktop app loading from
   disk; split it if cold start becomes a problem.

**Fixed (Nov 2026) — do not "re-fix" these:**

- **Supply-chain malware removed.** Merge `eb30254` added an obfuscated
  payload in `init`, `website/init` and the last line of `eslint.config.mjs`,
  prefixed `node init &&` onto every npm script, and removed `.env` and
  `.vscode/` from `.gitignore`. All reverted to `b94c510`. If `init` or a
  `node init` script ever reappears, treat the machine that pushed it as
  compromised. See `SECURITY.md`.
- Backend port — the main process now picks a free port, passes it as
  `TORCH_PORT`, and the renderer asks for it (`config/api.ts`). Never hardcode
  8000 again; build URLs from `API_BASE` and send them through `torchFetch`.
- Lint — `npm run lint` passes with 0 errors and runs in CI.
- Dark theme — implemented properly (see Design System).
- Fake pages — Files, Follow-ups, Web Search, Browser, Messaging and Tasks
  were shells and are deleted; unknown routes redirect to Chat.
- "Reasoned for Ns" panel — removed. It restated the step list as if it were
  model reasoning. Elapsed time now sits in the step timeline header.
- Model picker — no vendor logos or raw model ids; labels only.
- Today page — "time saved" (tasks × 8 minutes, invented) is gone from the UI
  and from `/api/metrics`; success rate is `null`, shown as "—", until a task
  has run. `test_new_conversation.py` asserts both.
- New chat — clears the screen *and* the backend's conversation context
  (`new_conversation` WS message).
- Inbox "Load more" — goes through `torchFetch` (it used to 401).
- An approval step is drawn as *waiting* (amber), not as a failure (red).

**Fixed (Aug 2026):** session-token auth, HITL policy in Python, Stop button,
false-success recap, onboarding gating, encrypted credentials
(`src/main/credentialStore.ts`), cold-start gating in `torchFetch`, honest
Insights, real task durations, onboarding no longer clobbering capability
settings. Note the backend does **not** re-read `.env` while running — change
capabilities through `/api/settings`, not the file.

---


## What NOT to Do

- Do not hardcode colors — use the tokens (see Design System); every rule must hold in both themes
- Do not call `alert()` or print `err.message` — use `notify()` and `describeError()`
- Do not hardcode the backend port
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
