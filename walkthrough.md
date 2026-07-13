# TORCH — Sprint 1 Code Walkthrough

We have successfully implemented and type-checked all 5 major fixes assigned for **Sprint 1** of TORCH. Below is a comprehensive walkthrough of the changes made, technical architectural details, and validation results.

---

## 1. Unified SQLite Schema (Fix 03)

Migrated SQLite table instantiation from inline, scattered Python strings to a single declarative schema definition file.

### Backend Changes:

- **[NEW] [schema.sql](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/backend/schema.sql)**:
  - Defines **8 unified tables**: `tasks`, `steps`, `habits`, `contacts`, `files_accessed`, `notifications`, `scheduled_tasks`, and `skills`.
  - Maintains backward compatibility with a legacy `activity_log` table.
- **[MODIFY] [storage.py](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/backend/memory/storage.py)**:
  - Refactored `_init_db()` to read and execute `schema.sql` on database startup.
  - Updated command metrics mapping to query the new `habits` table instead of the obsolete `commands_log` table.

---

## 2. Onboarding Persistence & Settings Multi-Tab Layout (Fix 01 & 02)

Enabled robust key configuration and social account binding.

### Backend Changes:

- **[MODIFY] [main.py](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/backend/main.py)**:
  - Added a new `/api/system-check` endpoint to verify if the `playwright` python package is importable and installed on the host.

### Frontend Changes:

- **[MODIFY] [Onboarding.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/pages/Onboarding.tsx)**:
  - Step 1 (Gemini Key) and Step 2 (Gmail Credentials) now POST directly to `/api/settings` on clicking **Next**.
  - Next button displays a smooth spinning loader while saving.
  - Shows a clear red network error warning if the backend is unreachable, but gracefully allows the user to click **Next** a second time to bypass/skip.
- **[MODIFY] [Settings.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/pages/Settings.tsx)**:
  - Reorganized into a dual-tab layout: **Connections** and **General**.
  - Integrates a system status card showing whether **Playwright Automation Engine** is installed (calling `/api/system-check`).
  - Includes a list of social connections (Twitter/X, Discord, Slack, etc.) with active status dots, persisting state to `localStorage` when user clicks **Open & login**.

---

## 3. High-Fidelity Demo Mode (Fix 04)

Built a complete local simulation environment allowing potential users to try TORCH with no backend server or keys required.

### Frontend Changes:

- **[NEW] [demoAgent.ts](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/demo/demoAgent.ts)**:
  - Provides three beautiful showcase scripts:
    1.  **Find a file**: Scans directories $\rightarrow$ reads PDF metadata $\rightarrow$ shows Q2 sales summary.
    2.  **Search the web**: Launches Chromium $\rightarrow$ queries news sites $\rightarrow$ returns top headlines.
    3.  **Send email (HITL)**: Drafts mock weekly status report, presents the user with an **ApprovalCard** (Human-in-the-Loop), and executes on click.
- **[MODIFY] [torchStore.ts](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/store/torchStore.ts)**:
  - Added `demoMode` state and setter.
- **[MODIFY] [useWebSocket.ts](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/hooks/useWebSocket.ts)**:
  - Cleanly bypasses the WebSocket handshake when in demo mode, avoiding constant connection loops.
- **[MODIFY] [Command.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/pages/Command.tsx)**:
  - Intercepts sent commands to delegate to `demoAgent` when `demoMode` is true.
  - Renders a sleek yellow warning banner at the top of the command area in demo mode, directing users to Settings Connections tab to set up real accounts.

---

## 4. Voice Overlay Acceptance Tests (Fix 05)

Created the verification and acceptance specifications for the voice command window layer.

- **[NEW] [TESTING.md](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/TESTING.md)**:
  - Lists **10 manual test cases** covering launch speeds, tray minimize-to-restore flows, state flow visual feedback, typewriter speed, dismiss handlers, wave animations, and double trigger prevention.
- **[MODIFY] [HeyTorch.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/overlay/HeyTorch.tsx)**:
  - Wired up the `onOverlayActivate` event handler on mount to successfully catch IPC signals sent from System Tray menu items, changing the active state to `'listening'` instantly.

---

## 5. Verification & Compilation Results

We resolved the global TypeScript namespace conflict associated with `JSX.Element` by declaring global JSX mappings in the environment types:

- **[MODIFY] [env.d.ts](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/env.d.ts)**: Link global `JSX` directly to `React.JSX` namespace.
- **Typecheck Check**: All compiler checks successfully pass:

```powershell
tsc --noEmit -p tsconfig.node.json --composite false  # SUCCESS (Node Process)
tsc --noEmit -p tsconfig.web.json --composite false   # SUCCESS (Renderer Process)
```
