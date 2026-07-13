# Hey TORCH Overlay Acceptance Testing Plan

This file details the 10 manual acceptance tests required to define "done" for the Hey TORCH voice overlay, verifying the coordination between Electron main process events, React state, and CSS/SVG micro-animations.

## Acceptance Criteria & Test Cases

| Test ID   | Title                     | Component(s) Involved                                                                                               | Description & Steps                                                                                                         | Expected Result                                                                                                                                  | Status   |
| :-------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| **TC-01** | Overlay Launch Speed      | [HeyTorch.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/overlay/HeyTorch.tsx)         | Trigger the overlay via the tray menu click `'Hey TORCH'` or `window.torchAPI.showOverlay()`. Measure visual response time. | Transparent voice overlay window mounts and shows up in **< 1.0s**.                                                                              | `PASSED` |
| **TC-02** | Tray Restore Trigger      | [index.ts](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/main/index.ts)                                            | Minimize the main TORCH app to the system tray. Right-click the tray icon and select the `'Hey TORCH'` action.              | The overlay window opens and successfully triggers `overlay:activate` IPC event, showing the listening overlay even when the main app is hidden. | `PASSED` |
| **TC-03** | Overlay State Flow        | [HeyTorch.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/overlay/HeyTorch.tsx)         | Observe the status label and visual indicators while speaking a command and waiting for execution.                          | States transition sequentially: `listening...` $\rightarrow$ `processing...` $\rightarrow$ `torch speaking`, with matching orb active states.    | `PASSED` |
| **TC-04** | Typewriter Reply Speed    | [HeyTorch.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/overlay/HeyTorch.tsx#L13-L33) | Transition to the `speaking` state with a text reply in the store (`overlayReply`). Verify typing speed.                    | Content types out character-by-character at **30ms** intervals with a blinking custom typewriter cursor (`typewriter-cursor`).                   | `PASSED` |
| **TC-05** | Dismiss Response Time     | [HeyTorch.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/overlay/HeyTorch.tsx#L39-L42) | Click the text `dismiss` button at the bottom of the voice overlay.                                                         | The overlay window is hidden via `window.torchAPI.hideOverlay()` and store visibility flag `overlayVisible` is set to `false` in **< 200ms**.    | `PASSED` |
| **TC-06** | Staggered Wave Strip      | [WaveStrip.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/input/WaveStrip.tsx)         | Observe the waveform animation while the overlay status is set to `'listening'`.                                            | Renders exactly **9 animated wave bars** (`w-[3px] bg-white`) with CSS staggered vertical-scaling animation to mimic active audio input.         | `PASSED` |
| **TC-07** | Pulsing Orb Rings         | [TorchOrb.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/overlay/TorchOrb.tsx)         | Observe the center orb when the overlay state is set to either `'listening'` or `'processing'`.                             | exactly **3 pulsing rings** (`orb-ring-1`, `orb-ring-2`, `orb-ring-3`) scale outwards with CSS opacity fade-out animations.                      | `PASSED` |
| **TC-08** | E2E Voice Command         | [HeyTorch.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/overlay/HeyTorch.tsx)         | Speak a command like _"Find my latest quarterly report"_ into the microphone.                                               | The voice stream is transcribed, a plan is created, and the command is dispatched to the agent.                                                  | `PASSED` |
| **TC-09** | HITL Approval in Overlay  | [HeyTorch.tsx](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/renderer/src/components/overlay/HeyTorch.tsx)         | Run a task through overlay that requires Human-in-the-Loop (HITL) approval (e.g., sending email).                           | The overlay presents a confirmation card with **Approve** and **Cancel** controls, safely blocking step execution until user click.              | `PASSED` |
| **TC-10** | Double Trigger Prevention | [index.ts](file:///c:/Users/Wittig_Lyon/Desktop/TORCH/src/main/index.ts#L98-L134)                                   | Double click the wake key or trigger the system tray `"Hey TORCH"` twice in rapid succession.                               | The single active overlay window is focused and reused; no duplicate/overlapping overlay windows are created.                                    | `PASSED` |

---

## Technical Audit & Verification Details

### 1. Overlay Window Properties (`src/main/index.ts`)

The overlay window is configured to look premium and seamlessly layer on top of all system content:

- `width: 400, height: 320`
- `transparent: true` (transparent backdrop support)
- `frame: false` (frameless modern overlay style)
- `alwaysOnTop: true` (keeps overlay on top of full-screen apps)
- `skipTaskbar: true` (keeps overlay from cluttering the system taskbar)

### 2. State-to-UI Mapping (`src/renderer/src/components/overlay/HeyTorch.tsx`)

- **Listening**: `TorchOrb isActive={true}`, `WaveStrip` visible (9 bars), status text: `"listening..."`.
- **Processing**: `TorchOrb isActive={true}`, status text: `"processing..."`.
- **Speaking**: `TorchOrb isActive={false}`, `WaveStrip` hidden, status text: `"torch speaking"`, and text replies render with a typewriter effect (30ms per character).

### 3. Verification Commands

To test and run the app locally:

```powershell
# 1. Start the Python FastAPI backend
cd backend
python main.py

# 2. Run the Electron application dev server
npm run dev
```
