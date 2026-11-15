# T.O.R.C.H

![CI](https://github.com/T-O-R-C-H/T.O.R.C.H/actions/workflows/ci.yml/badge.svg)

### _Thinking, Observing, Reasoning, Creating & Handling_

> An AI agent for Windows that uses your computer the way a person does. Tell it what you want in plain English; it looks at the screen, clicks and types, checks its work, and keeps going until the job is done.

---

## What it does

- **Works in any app.** Chrome, Notepad, Calculator, File Explorer, a video editor: if you can see it, TORCH can use it. No plugins or app-specific integrations.
- **Does the whole task.** "Go to demoblaze.com, find the cheapest laptop, add it to the cart and check out" runs from the first click to the checkout form.
- **Teaches or does.** "How do I import a video?" points at the real button on your screen. "Do it for me" does that step.
- **Asks first.** Sending, deleting, buying, downloading and running commands wait for your approval.
- **Hands over at payment.** At a payment form, a CAPTCHA or a final "place order", TORCH stops and gives control back to you. It never types card details.
- **Stays out of your way.** TORCH has its own on-screen cursor and never moves yours. A soft blue glow round the screen edge shows when it's in control, and a small panel in the corner shows its to-do list.
- **Yours.** Runs on your computer with your own AI key. Keys are encrypted by the operating system. No telemetry, and voice never leaves the machine.

## Things to try

```
Open Chrome, go to YouTube and play Doja by Central Cee
Open Calculator and work out 128 x 24
Open Notepad, write a short poem about Lagos and save it as lagos.txt
Find my CV in Documents and open it
How do I add a transition in CapCut?
```

## How screen control works

When no built-in tool covers a task, TORCH runs a look-then-act loop
(`backend/tools/vision_control.py`):

1. Take a screenshot (TORCH's own windows are hidden from it).
2. Read the Windows accessibility tree for the names and exact positions of
   the controls on screen.
3. Send both to the vision model, which returns one action as JSON: click a
   named control, type, press a key, scroll, wait, ask, hand over or done.
   It also keeps a to-do list and says which item it is on.
4. Do the action, then look again to check what changed.

Guard rails are code, not prompts. Approval policy lives in Python
(`backend/agent/planner.py`). Clicks on a window's own Close or Minimize
button are refused unless the task asks for them. Repeated clicks a page
ignores are retried as real mouse clicks. Payment and final-order steps
are always handed to the user.

Looking at the screen is off by default. Turn it on in Settings → "Look at my
screen". Screenshots go only to the AI service whose key you added.

## Tech stack

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Shell    | Electron 39                                                      |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Zustand 5, Framer Motion   |
| Backend  | Python 3.11, FastAPI, WebSocket                                  |
| AI       | Your own key: DeepSeek or Claude (one is the fallback for the other) |
| Vision   | The same key, plus Windows UI Automation for exact positions     |
| Voice    | faster-whisper (speech to text) and Kokoro (speech), both local  |
| Storage  | SQLite                                                           |

## Getting started

Requires Node.js 20+ and Python 3.11 on Windows 10/11.

```bash
npm ci

cd backend
python -m venv venv
venv\Scripts\python -m pip install -r requirements.txt -r requirements-dev.txt
cd ..

npm run dev
```

`npm run dev` starts the desktop app, which starts the backend for you. Add
a DeepSeek or Claude key in Settings → Connections (until then the app runs
in demo mode). For screen tasks, also turn on "Look at my screen".

## Checks

```bash
npm run typecheck && npm run lint && npm run test   # frontend
cd backend && venv\Scripts\python -m pytest         # backend
```

## Building the installer

```bash
backend\venv\Scripts\python backend/build_backend.py   # bundles the backend
npm run build:win
```

## Releasing

Set `"version"` in `package.json`, commit, then push a matching tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

`.github/workflows/release.yml` builds the installer on a clean Windows
machine and publishes it as a GitHub release. The website's Download button
picks up the newest release on its own.

## Website

`website/` is the public site (Vite + React), deployed to GitHub Pages by
`.github/workflows/pages.yml` on every push to `main` that touches it.

```bash
cd website
npm ci --ignore-scripts
npm run dev
```

## Architecture

```
Electron main ──spawns──► Python backend (127.0.0.1, random session token)
      │                          ▲
      ├─► React renderer ──WebSocket + REST──┘
      └─► overlay windows: task panel, TORCH cursor, control border
                                 │
     plan (AI) → validate + approval policy → named tools or the vision loop
```

## Status

Pre-launch. Known gaps:

- The installer is unsigned, so Windows SmartScreen warns on install (`CODE_SIGNING.md`).
- A clean-machine install (no Python) has not been verified yet.
- Social posting opens the site with the text ready. It does not post.
- Each screen step takes a few seconds, most of it the AI model thinking.

## Read next

- `VISION.md`: what TORCH is meant to become
- `CLAUDE.md`: the full technical picture and the rules learned building it
- `SECURITY.md`: the November 2026 supply-chain incident. Every contributor needs to read it.

## License

MIT
