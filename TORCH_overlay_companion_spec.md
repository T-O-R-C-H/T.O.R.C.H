# TORCH — Overlay Companion + Screen-Aware Teaching Mode
# Full Implementation Spec

Read this entire document before writing any code.
This is a new feature category — not an extension of what exists.
It touches Electron, the frontend, the backend, and the vision layer simultaneously.

---

## What this is

TORCH gains two new capabilities that work together:

1. **The Overlay Companion** — a floating chat panel that lives on top of every app,
   always accessible, that you talk to while looking at whatever you're doing.
   Like the Claude Chrome sidebar but for your entire desktop, not just a browser tab.

2. **Screen-Aware Teaching Mode** — TORCH sees your screen, can point at specific
   elements by drawing a highlight ring around them, explains what things do,
   and can switch from explaining to doing at any moment in the same conversation.

These two features combined produce the Capcut scenario:
- User says "I want to learn Capcut but I'm busy, I already have it"
- TORCH sees Capcut on screen, highlights the icon, says "I can see it's already
  downloaded — want me to open it?"
- User says "do it for me"
- TORCH clicks it, opens it, then highlights specific interface elements and explains
  them, or asks "want me to start a project or explain the interface first?"

---

## Architecture: four Electron windows (final state)

```
Window 1: Main window (Command Center)
  — existing, unchanged
  — hides when user minimizes, shows when pill mark is clicked

Window 2: Command Pill (bottom center, existing from Week 5)
  — quick input when main window is away
  — unchanged from current implementation

Window 3: Overlay Companion (NEW)
  — always-on-top floating chat panel
  — appears on any screen, any app, any time
  — NOT a browser extension — a real Electron window
  — triggered by hotkey (Ctrl+Shift+Space) or Hey TORCH wake word
  — positioned: right edge of screen, vertically centered
  — size: 340px wide, 60% of screen height
  — has its own scrollable chat history for the current session
  — shares the same WebSocket pipeline as Command Center
  — dismissed with Escape or clicking outside

Window 4: Task Panel (right edge, existing from Week 5)
  — step narration during task execution
  — now shows BOTH steps AND reasoning (thought + action like Image 2)
  — unchanged position, enhanced content
```

---

## FEATURE 1: The Overlay Companion Window

### Electron implementation

```typescript
// src/main/index.ts

let overlayCompanion: BrowserWindow | null = null

function createOverlayCompanion(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayCompanion = new BrowserWindow({
    width: 340,
    height: Math.round(height * 0.6),
    x: width - 340,
    y: Math.round(height * 0.2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayCompanion.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/companion')
  } else {
    overlayCompanion.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/companion'
    })
  }

  // Companion is hidden from screen capture — same as pill and task panel
  overlayCompanion.setContentProtection(true)

  // Slide in from right edge on show
  overlayCompanion.on('show', () => {
    overlayCompanion?.webContents.send('companion:animate-in')
  })
}

function showCompanion(): void {
  if (!overlayCompanion) createOverlayCompanion()
  overlayCompanion?.show()
  overlayCompanion?.focus()
}

function hideCompanion(): void {
  overlayCompanion?.webContents.send('companion:animate-out')
  setTimeout(() => overlayCompanion?.hide(), 240) // wait for exit animation
}

function toggleCompanion(): void {
  if (overlayCompanion?.isVisible()) {
    hideCompanion()
  } else {
    showCompanion()
  }
}

// Global hotkey
app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Shift+Space', toggleCompanion)
})

// IPC
ipcMain.on('companion:hide', hideCompanion)
ipcMain.on('companion:show', showCompanion)
```

### The companion panel component

Create `src/renderer/src/pages/Companion.tsx`

This is a full chat interface, not just a step list.

```
┌─────────────────────────────────────────┐
│  TORCH     ● watching your screen   ✕   │  header, 44px
├─────────────────────────────────────────┤
│                                         │
│  [TORCH message bubble]                 │
│  I can see you have Capcut downloaded   │
│  already. Want me to open it for you?   │
│                                         │
│                     [user bubble]       │
│                     do it for me        │
│                                         │
│  [TORCH message bubble]                 │
│  On it.                                 │
│  ◉ Opening Capcut...                    │
│  ✓ Opened                               │
│                                         │
│  I've opened Capcut. Want me to walk    │
│  you through the interface or start a   │
│  project together?                      │
│                                         │
├─────────────────────────────────────────┤
│  [                          ] [↑] [🎤]  │  input
└─────────────────────────────────────────┘
```

**Critical design rules for this component:**

- Background: `rgba(6, 6, 6, 0.94)` with `backdrop-filter: blur(24px)`
- Border: 1px `rgba(255,255,255,0.08)` on left and top only (right is flush to screen edge)
- Border-radius: `12px 0 0 12px` — pill on the left, flush on the right
- Box shadow: `inset -1px 0 0 rgba(255,255,255,0.04), -12px 0 40px rgba(0,0,0,0.6)`
- All other design rules from tokens.css apply

**Entry animation:** slides in from right (translateX 100% → 0) over 320ms `ease-out`
**Exit animation:** slides out right (translateX 0 → 100%) over 200ms `ease-in`

**Chat bubbles — same spec as Command Center** but more compact:
- User: right-aligned, white background, black text, no radius exception here — sharp corners
- TORCH: left-aligned, `rgba(255,255,255,0.05)` background, subtle border

**The "watching your screen" indicator in the header:**
- Green dot pulses when screen context is captured
- Grey dot when not watching
- Tapping it toggles whether TORCH is capturing screen context with each message

**What makes this different from the Command Center:**
The companion sends the current screenshot AUTOMATICALLY with every message the user sends,
without the user having to ask. TORCH always knows what's on screen in this mode.
This is the fundamental shift — it's not an on-demand screen reader, it's a persistent
screen-aware assistant.

---

## FEATURE 2: Screen-Aware Teaching Mode

### How screen context flows

When a message is sent from the Companion:

```
User types message in Companion
    ↓
Before sending to backend:
    1. Capture screenshot with mss (via IPC to main process)
    2. Encode as base64
    3. Include alongside the text message in the WS payload

New WS message format:
{
  "type": "command",
  "text": "I want to learn Capcut",
  "screenshot": "base64...",   ← NEW FIELD
  "request_id": "uuid",
  "source": "companion"        ← tells backend this came from companion
}
```

### Backend: vision-aware planning

When `brain.py` receives a command with a screenshot, it uses multimodal input:

```python
# backend/agent/brain.py

async def plan_command(
    command: str,
    context: ConversationContext,
    screenshot_b64: str | None = None,
) -> list[dict]:
    """
    Plan a command. If screenshot_b64 is provided, include it in the
    LLM call so the model can reason about what's on screen.
    """
    if screenshot_b64 and self.provider.supports_vision:
        # Build a multimodal message: text + image
        messages = context.get_messages() + [{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "data": screenshot_b64
                },
                {
                    "type": "text",
                    "text": f"The user says: {command}\n\nLook at the screenshot and plan appropriately."
                }
            ]
        }]
    else:
        messages = context.get_messages() + [{
            "role": "user",
            "content": command
        }]

    return await self.provider.plan(messages)
```

### The system prompt additions for teaching mode

Add to the existing system prompt when source is "companion":

```
SCREEN CONTEXT MODE:
You can see the user's current screen in the screenshot attached to their message.
Use this context proactively — if you can see what they're working on, reference it.

TEACHING BEHAVIOUR:
When the user wants to learn something:
1. Acknowledge what you can already see on their screen
2. Offer to guide them through it or do it for them
3. When guiding, describe actions in terms of what they'll see: "Click the blue button
   that says 'New Project' in the top left"
4. If they say "do it for me" or "just do it" — switch to execution mode immediately
5. After doing something, offer to explain what just happened or continue to the next step
6. Use highlight_element to point at things you're describing (see below)

POINTER LANGUAGE:
When describing an element on screen, include a highlight tag:
<highlight x="0.3" y="0.15" label="New Project button" />
The renderer will draw a visible ring at those normalized coordinates.
```

### The highlight system — pointing at screen elements

This is the most visually impressive part. When TORCH says "click the New Project button"
it should draw a visible highlight ring on the actual screen at that location.

**New Electron window: the pointer overlay**

```typescript
// src/main/index.ts

let pointerOverlay: BrowserWindow | null = null

function createPointerOverlay(): void {
  const { width, height } = screen.getPrimaryDisplay().bounds

  pointerOverlay = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  pointerOverlay.setIgnoreMouseEvents(true, { forward: true })
  pointerOverlay.hide()

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    pointerOverlay.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/pointer')
  } else {
    pointerOverlay.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/pointer'
    })
  }
}

// Show a highlight ring at normalized coordinates
// x and y are 0–1 (fraction of screen width/height)
function showHighlight(x: number, y: number, label: string): void {
  if (!pointerOverlay) createPointerOverlay()
  pointerOverlay?.show()
  pointerOverlay?.webContents.send('pointer:highlight', { x, y, label })
  // Auto-hide after 4 seconds
  setTimeout(() => pointerOverlay?.webContents.send('pointer:clear'), 4000)
}

ipcMain.on('pointer:show', (_, data) => showHighlight(data.x, data.y, data.label))
ipcMain.on('pointer:hide', () => pointerOverlay?.webContents.send('pointer:clear'))
```

**The pointer overlay component** — `src/renderer/src/pages/Pointer.tsx`

```tsx
import { useState, useEffect } from 'react'

interface HighlightState {
  x: number
  y: number
  label: string
  visible: boolean
}

export default function Pointer() {
  const [highlight, setHighlight] = useState<HighlightState | null>(null)

  useEffect(() => {
    window.torchAPI.onPointerHighlight((data) => {
      setHighlight({ ...data, visible: true })
    })
    window.torchAPI.onPointerClear(() => {
      setHighlight(prev => prev ? { ...prev, visible: false } : null)
    })
  }, [])

  if (!highlight) return null

  const px = `${highlight.x * 100}vw`
  const py = `${highlight.y * 100}vh`

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      {/* The pulsing ring */}
      <div style={{
        position: 'absolute',
        left: px,
        top: py,
        transform: 'translate(-50%, -50%)',
        opacity: highlight.visible ? 1 : 0,
        transition: 'opacity 300ms ease',
      }}>
        {/* Outer pulsing ring */}
        <div style={{
          width: 64,
          height: 64,
          border: '2px solid #3b82f6',
          borderRadius: '50%',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'ringPulse 1.5s ease-out infinite',
        }} />
        {/* Inner solid dot */}
        <div style={{
          width: 12,
          height: 12,
          background: '#3b82f6',
          borderRadius: '50%',
          border: '2px solid white',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }} />
        {/* Label */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 'calc(50% + 36px)',
          transform: 'translateY(-50%)',
          background: '#3b82f6',
          color: 'white',
          fontSize: 11,
          fontFamily: 'monospace',
          padding: '3px 8px',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em',
        }}>
          {highlight.label}
        </div>
      </div>
      <style>{`
        @keyframes ringPulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
```

**Parsing highlight tags from TORCH responses:**

In the companion chat renderer, scan TORCH's text for `<highlight>` tags and:
1. Remove the tag from the displayed text
2. Call `window.torchAPI.showPointer({ x, y, label })` to draw it on screen

```typescript
function parseAndRenderResponse(text: string): { cleanText: string, highlights: Highlight[] } {
  const highlightRegex = /<highlight x="([\d.]+)" y="([\d.]+)" label="([^"]+)" \/>/g
  const highlights: Highlight[] = []
  let cleanText = text

  let match
  while ((match = highlightRegex.exec(text)) !== null) {
    highlights.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      label: match[3]
    })
    cleanText = cleanText.replace(match[0], '')
  }

  return { cleanText: cleanText.trim(), highlights }
}
```

---

## FEATURE 3: Enhanced Task Panel — Thought + Action display

The current task panel shows step labels. Enhance it to show TORCH's reasoning,
like the UI-TARS panel in Image 2.

When the backend emits a step_update, include a `thought` field:

```python
# backend/agent/executor.py

await ws_manager.send_step_update(
    message_id,
    step_id,
    "active",
    label=plain_label,
    thought=f"I need to {plain_label.lower()} because {step.get('reason', '')}",
    client_id=client_id,
)
```

The task panel renders both:

```
┌─────────────────────────────────────┐
│ TORCH WORKING              ● LIVE   │
├─────────────────────────────────────┤
│ THOUGHT                             │
│ I can see Capcut is in the          │
│ taskbar. I'll click the icon to     │
│ open it rather than searching.      │
├─────────────────────────────────────┤
│ ACTION                              │
│ ✓ Took screenshot                   │
│ ✓ Found Capcut icon                 │
│ ◉ Clicking to open...               │
│ ○ Wait for app to load              │
├─────────────────────────────────────┤
│ ■ Stop                        2.4s  │
└─────────────────────────────────────┘
```

Thought section updates with each step. Action section is the existing step list.
The thought comes from the model's reasoning, extracted from the plan.

---

## FEATURE 4: Proactive screen awareness

When the companion is open and the user has been idle for 30 seconds, TORCH
can proactively notice what's on screen and offer help — without the user asking.

```python
# backend/agent/proactive.py

class ProactiveEngine:
    """
    Watches screen context and surfaces relevant suggestions
    without the user explicitly asking.
    """

    IDLE_THRESHOLD_SECONDS = 30

    async def check_and_suggest(
        self,
        screenshot_b64: str,
        last_interaction_at: float,
        client_id: str,
    ) -> None:
        idle_for = time.time() - last_interaction_at
        if idle_for < self.IDLE_THRESHOLD_SECONDS:
            return

        # Ask the model: what does this screen show, and is there
        # anything TORCH could proactively help with?
        prompt = """Look at this screenshot. The user has been idle for a while.

Is there something on screen that TORCH could proactively help with?
Examples: an error message, an unread notification, a partially filled form,
a downloading file, a tutorial being watched.

If yes, respond with a SHORT, specific, non-intrusive suggestion (max 15 words).
If no, respond with exactly: NOTHING

Do not be annoying. Only suggest if there's a clear, obvious opportunity."""

        response = await self.provider.generate_text(
            prompt=prompt,
            screenshot_b64=screenshot_b64
        )

        if response.strip() == "NOTHING":
            return

        # Send as a gentle proactive message in the companion
        await ws_manager.send_proactive_suggestion(response.strip(), client_id)
```

The companion renders proactive suggestions differently from user-initiated responses —
slightly dimmed, with a "Noticed something" label and easy to dismiss.

**Important:** Proactive suggestions only appear when:
- The companion window is open
- The user has been idle 30+ seconds
- The last proactive suggestion was more than 2 minutes ago (rate limit)
- The user has not disabled proactive mode in Settings

---

## FEATURE 5: The Capcut scenario end to end

This is the reference implementation. Build it so this exact flow works:

```
User opens Companion (Ctrl+Shift+Space)
TORCH takes a screenshot automatically

User: "hey torch, i want to learn capcut but i'm kinda busy,
       i already have it downloaded"

TORCH (sees Capcut in taskbar from screenshot):
  "I can see Capcut is already on your computer.
   Want me to open it and walk you through it?"
  [highlight ring appears on Capcut icon]

User: "do it for me"

TORCH:
  ◉ Opening Capcut...
  [blue border appears — TORCH in control]
  [clicks the Capcut icon]
  ✓ Capcut opened
  [blue border disappears]

  "Capcut is open. Want me to explain the interface
   or shall we start a project together?"
  [highlight ring appears on Timeline area]

User: "explain"

TORCH (takes new screenshot, sees Capcut interface):
  "Here's the main layout:
   [highlight: Timeline] This is where your clips go.
   [highlight: Media panel] Import your videos here.
   [highlight: Preview] Watch your edit here.
   Which part do you want to start with?"

User: "show me how to import a video"

TORCH:
  "Click here to import."
  [highlight ring on Import button]

User: "just do it"

TORCH:
  ◉ Clicking Import button...
  [file picker opens]
  "A file picker opened. Navigate to your video and
   select it — I'll wait."
  [TORCH parks — hands control to user for file selection]

User: [selects a file]
[File appears in media panel]

TORCH (sees file appeared in screenshot):
  "Your video is imported. Want me to add it to the
   timeline or explain what to do next?"
```

This flow requires all five features working together:
- Companion window for the persistent chat
- Screenshot-with-every-message for screen awareness
- Highlight system for pointing at elements
- UIA/Vision for clicking
- HITL-style parking for user input moments (file picker, payment)

---

## Implementation order

Do not implement everything at once. In this order:

1. **Companion window** — the Electron window, the route, the basic chat UI
2. **Screenshot-with-message** — capture and include in the WS payload
3. **Multimodal planning** — update brain.py to use the screenshot in the LLM call
4. **Highlight parsing** — parse `<highlight>` tags from responses
5. **Pointer overlay** — the full-screen window that draws the ring
6. **Enhanced task panel** — add thought + action display
7. **Proactive suggestions** — only after everything else works

Test with the Capcut scenario after step 4. It should already feel transformative.
Steps 6 and 7 are polish on top of a working core.

---

## What NOT to do

- Do not make the companion a browser extension. It is an Electron window.
- Do not share a WebSocket connection between companion and Command Center —
  they can both connect to the same backend endpoint but they are separate connections
  with separate client IDs.
- Do not make proactive suggestions annoying — rate limit them hard.
- Do not make highlights permanent — they auto-dismiss after 4 seconds.
- Do not show the companion and the task panel at the same time in the same position —
  the companion is on the right edge, the task panel slides in FROM the right edge.
  When a task is running from the companion, the task panel appears INSIDE the companion
  (in the chat, as step bubbles) rather than as a separate window.
- Do not add this feature to the HITL flow without explicit user confirmation — proactive
  suggestions never trigger actions on their own.

---

## Files to create or modify

```
CREATE:
  src/renderer/src/pages/Companion.tsx
  src/renderer/src/pages/Pointer.tsx
  src/renderer/src/components/companion/CompanionChat.tsx
  src/renderer/src/components/companion/CompanionHeader.tsx
  src/renderer/src/components/companion/ProactiveSuggestion.tsx
  backend/agent/proactive.py

MODIFY:
  src/main/index.ts         — add createOverlayCompanion(), createPointerOverlay(), hotkey
  src/preload/index.ts      — expose onPointerHighlight, onPointerClear, showPointer
  src/renderer/src/App.tsx  — add /companion and /pointer routes
  backend/agent/brain.py    — add screenshot_b64 parameter to plan_command
  backend/main.py           — handle screenshot in incoming WS message
  backend/agent/executor.py — add thought field to step_update emissions
  CLAUDE.md                 — document new windows and message format
```
