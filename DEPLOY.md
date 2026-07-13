# TORCH — Go-Live Checklist & Motion Video Guide

## What you need before going live

### 1. API keys & AI provider

| Requirement                            | Required?             | Notes                                                                                     |
| -------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                       | **Yes** (for live AI) | Get from [Google AI Studio](https://aistudio.google.com). Set in Settings or root `.env`. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Optional              | Alternative providers if wired in backend.                                                |
| Demo mode                              | Fallback              | Works without a key — scripted scenarios only.                                            |

Copy `.env.example` → `.env` at repo root and fill in values. The backend reads this on startup.

### 2. Python backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
python main.py
```

Verify: `http://localhost:8000/api/status` returns JSON with `"status": "ok"`.

The **Electron app auto-starts** the backend on launch. For development you can also run it manually.

### 3. Desktop app build

```bash
npm install
npm run build:win    # Windows installer
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Outputs go to `dist/`. Update `electron-builder.yml` publish URL before enabling auto-updates.

### 4. Optional integrations

| Feature         | Env vars                              | Extra setup                                              |
| --------------- | ------------------------------------- | -------------------------------------------------------- |
| Email           | `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` | Google App Password at myaccount.google.com/apppasswords |
| Web automation  | —                                     | `playwright install chromium`                            |
| Voice wake word | `WAKE_WORD`, `WHISPER_MODEL_SIZE`     | Microphone permission in OS                              |
| Screen watch    | `SCREEN_WATCH_ENABLED=true`           | Screen capture permission                                |

### 5. Marketing website

```bash
npm run website:dev     # local preview at http://localhost:4173
```

Deploy the `website/` folder to **GitHub Pages**, **Netlify**, or **Vercel** (static hosting).

Website demos use **scripted browser UI** (exact app look, no backend). The desktop app connects to the real Python backend via WebSocket.

### 6. Security & privacy before public release

- [ ] Never commit `.env` or API keys (verify `.gitignore`)
- [ ] Review HITL approval flows for destructive tools (`delete_file`, `send_email`, etc.)
- [ ] Set `TORCH_HOST=127.0.0.1` if backend should not accept LAN connections
- [ ] Code-sign Windows/macOS installers for user trust
- [ ] Update `author` and `homepage` in `package.json` / `electron-builder.yml`
- [ ] Replace placeholder GitHub release URLs on the website download buttons

### 7. Real-time agent checklist (desktop app)

When you run `npm run dev` or the packaged app:

1. Electron main process spawns `python main.py`
2. Renderer connects to `ws://localhost:8000/ws` (configurable via `VITE_TORCH_API_URL`)
3. Add Gemini key in **Settings → Connections → Save**
4. Send a command in Command Center — steps should animate live
5. Check Activity Log (`/terminal`) for WebSocket + tool output

If backend is offline, the app falls back to **demo mode** with scripted responses.

---

## How to make a motion video of TORCH

### Option A — Screen recording (fastest, recommended)

**Tools:** [OBS Studio](https://obsproject.com/) (free), **Screen Studio** (Mac, polished zooms), or **Camtasia**.

**Shot list (2–3 min hero video):**

1. **Opening** — Website hero or app launch, light theme Command Center idle state (2s)
2. **Onboarding** — Name step → permissions toggles → first task “Run in Command Center” (15s)
3. **File task** — Type “Find and summarize my latest report” → watch steps complete (20s)
4. **HITL moment** — Email demo pauses on approval card → click Approve (15s)
5. **Web research** — Search command → browser step highlights (15s)
6. **Closing** — Wordmark + “Download for Windows” CTA (5s)

**Tips:**

- Record at **1920×1080**, 60fps if possible
- Hide personal files/paths in demo commands
- Use **demo mode** OR a dedicated test folder so results are predictable
- Add subtle **cursor highlight** in post (Screen Studio does this automatically)
- Export **H.264 MP4** for web; **ProRes** if editing in DaVinci/Premiere

### Option B — Website demos as B-roll

The rebuilt `website/` runs **live UI demos** in each section. Record the browser with OBS while scrolling:

```bash
npm run website:dev
# Open http://localhost:4173 — scroll through sections
```

Each section auto-plays the exact app UI (chat bubbles, steps, approval cards).

### Option C — After Effects / Remotion (polished marketing)

For Cursor-style motion graphics:

1. Export **clean app screenshots** at 2× resolution from Electron
2. Use **Remotion** (React → video) or After Effects with:
   - Soft fade-up on headlines
   - 8–12px Y-translate, 300ms ease on section entrances
   - UI window scale 0.96 → 1.0 on appear
3. Keep palette: `#f4f4f5` bg, `#262626` accent — match `globals.css`

### Option D — Automated demo script

Run the desktop app in demo mode and use OBS **Scene Collection** with hotkeys to switch between Command Center / Settings / Approval states.

---

## Deploy website to GitHub Pages (example)

1. Push repo to GitHub
2. Settings → Pages → Source: **GitHub Actions** or deploy `website/` folder
3. Optional workflow:

```yaml
# .github/workflows/website.yml
name: Deploy website
on:
  push:
    branches: [main]
    paths: ['website/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: website
      - uses: actions/deploy-pages@v4
```

4. Point custom domain (optional) e.g. `torch.dev`

---

## Quick reference

| Command                        | Purpose                |
| ------------------------------ | ---------------------- |
| `npm run dev`                  | Electron + backend dev |
| `npm run build:win`            | Windows installer      |
| `npm run website:dev`          | Marketing site preview |
| `cd backend && python main.py` | Backend only           |
| `playwright install chromium`  | Web tools              |

Questions? Open an issue on the repo with `deployment` label.
