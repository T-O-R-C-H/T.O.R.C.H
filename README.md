# T.O.R.C.H

![CI](https://github.com/T-O-R-C-H/T.O.R.C.H/actions/workflows/ci.yml/badge.svg)

### _Thinking, Observing, Reasoning, Creating & Handling_

> Your personal AI agent that gives you complete control over your PC and online life through voice and text commands.

---

## What it does

- **Does the task, not just the talking** — finds files, reads documents, sends email, opens apps, searches the web
- **Sees your screen** — when no built-in tool fits, TORCH looks at the screen and uses the mouse and keyboard itself
- **Asks first** — sending, deleting, downloading and running commands always wait for your approval
- **Undo and Stop** — file changes can be reversed; a running task can be stopped at any time
- **Yours** — runs on your computer, keys encrypted by the operating system, no telemetry, voice never uploaded
- **Light and dark** — follows your system, or pick one in Settings

## Tech stack

| Layer    | Technology                                                    |
| -------- | ------------------------------------------------------------- |
| Shell    | Electron 39                                                   |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Zustand 5, Framer Motion |
| Backend  | Python 3.11, FastAPI, WebSocket                               |
| AI       | Gemini, OpenAI, Claude, DeepSeek, or a local model via Ollama |
| Vision   | Qwen2.5-VL via Ollama                                         |
| Voice    | faster-whisper (speech to text) and Kokoro (speech), both local |
| Storage  | SQLite                                                        |

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
an AI key in Settings → Connections; until then the app runs in demo mode.

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

## Architecture

```
Electron main ──spawns──► Python backend (127.0.0.1, random session token)
      │                          ▲
      └─► React renderer ──WebSocket + REST──┘
                                 │
                 plan (AI) → validate + approval policy → execute tools
```

See `CLAUDE.md` for the full picture and `SECURITY.md` for the November 2026
incident every contributor needs to read.

## License

MIT
