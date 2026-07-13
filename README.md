# T.O.R.C.H

![CI](https://github.com/Muyideen-js/T.O.R.C.H/actions/workflows/ci.yml/badge.svg)

### _Thinking, Observing, Reasoning, Creating & Handling_

> Your personal AI agent that gives you complete control over your PC and online life through voice and text commands.

---

## Features

- **Full Desktop Control** — Find files, send emails, post on social media, control the browser
- **Hey TORCH** — Siri-style floating overlay responds to voice even when minimized
- **Agent Execution** — Multi-step task execution with real-time progress streaming
- **Human-in-the-Loop** — Approval required for irreversible actions (email, delete, post)
- **Screen Watcher** — 24/7 screen observer that learns what you're doing
- **Memory & Habits** — Learns your patterns and predicts your needs
- **100% Local** — Your data stays on your machine. No telemetry.

## Tech Stack

| Layer         | Technology                                                 |
| ------------- | ---------------------------------------------------------- |
| Desktop Shell | Electron                                                   |
| Frontend      | React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| Backend       | Python 3.11+, FastAPI, WebSockets                          |
| AI Brain      | Gemini 2.5 Flash (free tier)                               |
| Voice         | OpenAI Whisper (local, offline)                            |
| Automation    | PyAutoGUI, Playwright                                      |
| Memory        | SQLite + ChromaDB                                          |

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- npm or yarn

### Frontend Setup

```bash
cd TORCH
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Configuration

1. Copy `.env.example` to `.env`
2. Add your Gemini API key from [aistudio.google.com](https://aistudio.google.com)
3. (Optional) Add Gmail credentials for email features

## Architecture

```
Frontend (Electron + React) ←→ WebSocket ←→ Backend (FastAPI + Python)
                                               ↓
                                          Gemini 2.5 Flash
                                               ↓
                                     Agent Tools (files, email, browser, etc.)
```

## License

MIT
