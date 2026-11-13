# TORCH: The Vision (read this before building anything)

Written from what Yusuf (founder) has explained over the whole project. This replaces him retyping it. Where this document and old specs disagree, this document wins.

---

## 1. What TORCH is

A Windows desktop agent that uses the real computer the way a person does. It is not a chatbot. You tell it what you want in plain words, and it opens apps, clicks, types, finds files, sends email, orders food, and so on, while showing you what it is doing.

It runs locally. Electron shell, React renderer, Python FastAPI backend on 127.0.0.1.

## 2. Who it is for

Everyone, not only developers. Non-technical people first. Nigeria and Africa first. BYOK (bring your own API key), so the founders carry no API cost.

## 3. How it should feel

A smart friend sitting next to you who can see your screen. It:
- Flows between **teaching** ("here is how this works, look here") and **doing** ("just do it for me") inside one conversation, with no mode switch.
- Speaks plain language. Never shows raw errors, stack traces or model names.
- Never lies. Never reports a failure as success.

## 4. The CapCut scenario (the core experience, in Yusuf's own words)

> **User:** hey torch, i want to learn Capcut but i am kinda too busy please how can i go about it i already have it downloaded

TORCH captures the screen, sees the CapCut icon, and points at it with a highlight ring drawn on the real screen.

> **TORCH:** hey i can see you have it downloaded already kindly click on the app icon to open

> **User:** do it for me

> **TORCH:** No problem

TORCH clicks and opens CapCut. The blue control border is on while it acts.

> **TORCH:** uhm i have opened it, should i start explaining how the ____ works (by highlighting what you want me to explain) or do you want to start a project?

Then it explains, with moving highlights on the real screen.

> **User:** show me how to import a video

TORCH points at the import button.

> **User:** just do it

TORCH clicks it. The file picker opens. TORCH says "pick your video" and **waits**. When the file appears in the project it notices, and offers the timeline or the next step.

What this requires:
1. A screenshot goes with each message so TORCH always sees the current screen.
2. A highlight/pointer drawn on the real screen over other apps (not inside TORCH's window).
3. Explain and do in one thread; the user can switch any time.
4. TORCH pauses when the user must act, and notices when they have.
5. A visible Action / Thought panel like UI-TARS.

## 5. The pizza scenario (acting on the web)

User: "order a pizza on Dominion's website in Chrome."
- A right-edge progress panel shows live steps. The blue border shows TORCH has control.
- At payment TORCH stops: "Attention needed. I will not enter card details, please complete payment."
- A Windows notification fires if TORCH needs him and the window is not focused.
- TORCH watches for the confirmation page and reports the order number.
- TORCH must recognise payment, delete, send-email and post moments **by itself**, not from a hard-coded list only.

## 6. Control tiers (fastest and cheapest first)

1. Named tools: find_file, send_email, open_app, web search.
2. Windows UI Automation (UIA): about 66 ms, exact by element name, free, local. Tools: describe_screen, read_screen, click_element, type_into. Web DOM through Playwright (web_control.py).
3. Cloud vision (screenshot to the model): last resort. Chromium/Electron apps have sparse UIA trees, so vision matters there.

Local Qwen2.5-VL was about 183 s per step on his CPU-only machine and was dropped.

## 7. Never-break rules

- Human approval (HITL) is enforced **server-side** in the planner for send email, delete, post, terminal, payment. Read-only tools never prompt.
- Rollback via register_step() / rollback(message_id).
- Stop works within about 2 seconds.
- Plain-language errors via translate_error / UserFacingError.
- Never report failure as success.
- Nothing downloads without consent. Nothing leaves the machine without honest disclosure. Audio never uploads.
- Secrets use Electron safeStorage. /api/settings is an allowlist and refuses secrets.
- Never capture the full desktop of the user's machine during development.

## 8. Providers (BYOK, exactly two)

- DeepSeek `deepseek-flash` (native vision, cheap).
- Claude `claude-sonnet-5` (premium).
- No Groq, no Gemini, no Ollama. Do not add them.
- Active provider stored as TORCH_ACTIVE_PROVIDER. Fallback on 503 / 429 / quota / timeout / insufficient balance.

## 9. Design

Black and white, zero border radius (except chat bubbles), blue only for the control border, Inter + JetBrains Mono, motion tokens (enter slower than exit). No gradients, no glow, no coloured icons.

## 10. Current state

- Three windows: main, task panel (right edge), control border. Pill, companion, guidance and old overlay are removed.
- Weeks 1 to 7 of the production plan reported done. 589 backend tests, 183 frontend tests.
- Installer baseline 259.6 MB. It has **never** been tested on a clean machine.
- Code signing not bought (cost). Auto-update unverified.

## 11. Work order

1. Rebuild the installer, report real size, run on a clean Windows Sandbox.
2. Honesty and bug fixes found there.
3. Then build the screen-aware teaching mode (section 4).

## 12. Decision for Claude Code to think about (do not guess)

Do not restore the old overlay or pill. Propose the smallest clean design, for example: grow the right-edge task panel into the conversation surface while another app is in front, plus one transparent click-through window that only draws the highlight ring. Report the plan and cost **before** building. If the window count changes, update the CLAUDE.md window-count line in the same commit.

## 13. What he does not want

Fake data. Unfinished-looking features. Surprise scope. Proactive suggestions. Being made to retype things. Hidden problems: tell him everything, in short plain sentences.
