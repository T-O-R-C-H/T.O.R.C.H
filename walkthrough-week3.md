# TORCH Production Readiness — Week 3 Walkthrough (part 1)

Covers the four highest-severity honesty issues from
`PRODUCTION_READINESS_AUDIT.md`. Each is a surface that told the user an action
had happened, or that a setting was in effect, when neither was true.

The remaining Week 3 items — auto-update, credential encryption, and the rest
of the fake-feature inventory — are not in this pass.

---

## 1. Social tools claimed to post, and never did

The worst of the four, because the user had already **approved** the step by the
time the tool ran.

Every layer told the same untruth:

| Layer | Said |
|---|---|
| Tool description given to the model | "Post content to a social media platform" |
| Approval rules in the system prompt | "posts publicly on social media — cannot be undone" |
| Step label after success | "Posted to social media." |
| Tool return value | "**Successfully** opened … Ready to post: …" |

What the code actually does is `page.goto(url)`. Nothing is published.

So the sequence was: the user asks TORCH to post, TORCH asks for approval to
post, the user approves, TORCH reports it posted — and nothing was posted.

**Fixed at every layer.** The tools now say plainly that they cannot publish,
and hand back the message to paste:

> I've opened Twitter for you. I can't post on your behalf, so you'll need to
> publish it yourself.
>
> Here's the message to paste: …

Step labels became "Opened the site for you to post." The model is now told
these tools "Do NOT publish anything," so it stops describing them as posting.

The tools stay in `HITL_TOOLS`. Opening a social site with drafted text is
still worth confirming, and reducing a safety gate was not part of this work —
the approval prompt is now simply accurate about what it is approving.

## 2. Social accounts marked "connected" without any check

`handleSocialLogin` opened the site in the user's external browser and
immediately wrote `connected: true` into `localStorage`, rendering a green dot
and the word "connected".

TORCH has no visibility into that browser's session. Whether the user logged
in, closed the tab, or never had an account is unknowable from here, so
"connected" could never be anything but a guess.

The status badge and its stored state are gone. The button reads "Open site",
the row says "Opens in your browser", and the section explains that TORCH
prepares the message but the user publishes it.

## 3. Onboarding permission toggles persisted nothing

`allowFiles`, `allowApps` and `allowEmail` were component state. Switching
"Read your email" off changed a boolean that was discarded when the screen
closed. TORCH read email regardless.

These are now real, and enforced server-side rather than by asking the model
nicely:

- Three settings — `allow_files`, `allow_apps`, `allow_email` — persisted
  through the existing `/api/settings` endpoint.
- `planner.py` maps each capability to its tools and converts any blocked tool
  into an error step **before execution**, with a plain-language reason.

Enforcing in the planner rather than the prompt matters: a model that decides
to call `send_email` anyway still cannot reach it.

Verified per capability, including that the scoping is correct:

```
files OFF  -> find_file  blocked   open_app   still allowed
apps  OFF  -> open_app   blocked   find_file  still allowed
email OFF  -> send_email blocked   find_file  still allowed
```

A blocked tool becomes an error, not an approval prompt — the user switched the
capability off, so being asked to approve it would be the wrong question.

**One bug found while wiring this.** `/api/settings` does
`setattr(settings, key, value)` with the raw request value. Posting `"false"`
for a boolean field would store the *string* `"false"`, which is truthy — so
switching a permission off would have silently left it on. Boolean fields are
now coerced before assignment.

Onboarding promised these could be changed later in Settings, and Settings had
no such controls. Rather than create a second false claim, a "What TORCH can
do" section was added there, wired to the same settings.

## 4. Prompt "Enhance" returned canned text

`mockEnhance` ignored the prompt entirely (`void prompt`), waited 2.2 seconds to
look like work, and returned the same fixed paragraph — **replacing whatever the
user had typed**. Any real instruction was destroyed and swapped for generic
advice about writing prompts.

It now calls a new `POST /api/prompt/enhance`, which uses the configured
provider's existing `generate_text` to rewrite the instruction, told to keep the
original intent, names and paths and to add nothing.

```
in : find my invoice and email it to john
out: Find the invoice file and send it as an email attachment to John.
```

Because the result replaces the user's text, failure must not invent anything:
with no provider configured the endpoint returns 503 rather than a canned
string, and the UI leaves the original text untouched and says
"Couldn't improve that just now — your text is unchanged."

While in this file, the meta row was rendering the raw model id
(`gemini-2.5-flash`) whenever a non-auto model was selected. It now shows the
speed/depth label.

---

## Tests

`backend/tests/test_honesty.py` — 11 tests covering these surfaces, so a
regression has to fail a test rather than quietly ship:

- social step phrasing does not claim completion
- social tool source contains no success language
- social docstrings state the limitation
- tools pass through when everything is allowed
- disabling a capability blocks only its own tools
- refusals are plain language, no internal identifiers
- a disabled capability stops the tool rather than prompting for approval

One of these caught a real miss: `send_message` still had a docstring reading
"Send a message on a messaging platform via browser automation."

```
backend: 148 passed   (137 before)
```

## Not addressed in this pass

Still open from the audit, in rough severity order:

- Approval "Edit" writes to the developer console only.
- Screen Watch interval, wake-word sensitivity and voice model size are saved
  but never consumed.
- Theme, launch-on-login and minimize-to-tray change local state only.
- Clear memory / Export history / Reset habits have no handlers.
- `/api/system-check` reports Playwright ready when the module imports, even if
  Chromium is missing.
- Web Search page's button has no handler.
- Onboarding's first task closes before a real result is required.

---

# Week 3 (part 2)

## 5. `/api/system-check` and onboarding first-task gating

Both were **already implemented in the working tree** when this pass started —
not authored here. Committed as found (`2d46011`) so the work was not lost, and
verified: 154 backend tests passing before any of the changes below.

- `backend/system_checks.py` launches headless Chromium rather than trusting a
  successful `import playwright`, and reports package presence and browser
  readiness as separate facts.
- Commands now carry a request id; the backend emits a correlated
  `task_outcome`, and onboarding waits for it instead of closing on a claim it
  never verified.

## 6. Audit: raw `setattr` from request data

Searched the backend for `setattr(`, `__dict__`, `exec(`, `eval(`, `globals()[`
and `vars(`.

**`/api/settings` was the only production case.** Everything else is
`monkeypatch.setattr` in tests. No `exec`, `eval`, or `__dict__` writes exist in
production code.

But that one case was worse than the boolean bug fixed in part 1:

```python
if hasattr(settings, key):
    setattr(settings, key, value)
```

Any attribute that happened to exist on the settings object could be written
from a request body — including `auth_token`, `host`, `db_path` and `data_dir`.
An authenticated caller could overwrite the live session token, or point the
database somewhere else.

Writable fields are now an explicit allowlist, and values are coerced to the
type the pydantic field declares rather than assigned raw. The part 1 fix
covered a hardcoded set of boolean fields; deriving the type from the model
covers every field, and an uncoercible value returns 400 instead of storing the
wrong type.

Verified:

```
POST auth_token   -> ignored, token unchanged
POST db_path      -> ignored
POST host         -> ignored
POST allow_files="false" -> stored as False, not the truthy string
POST bad integer  -> HTTP 400
```

**A test isolation bug of mine, found here.** The first version of these tests
POSTed settings against the real `.env` and changed
`SCREEN_WATCH_INTERVAL` from 30 to 45. The env path is now indirected so tests
redirect it at a temp file, and the value was restored. API keys were never at
risk — the handler preserves values it is not given — but the tests had no
business writing that file.

## 7. Credential encryption

API keys and the Gmail app password sat in plain text in the repository's
`.env`.

The constraint that shapes the design: the Python backend needs the plaintext
to *use* a credential, and it cannot call Electron's `safeStorage`. So:

```
Settings UI ──IPC──> main process ──safeStorage.encryptString──> credentials.enc
                            │                                    (userData)
                            └──decrypt at spawn──> env vars ──> Python backend
```

This is the route the session token already takes.

- `src/main/credentialStore.ts` encrypts through the OS keystore — DPAPI on
  Windows, Keychain on macOS, libsecret on Linux.
- Plaintext secrets already in `.env` are imported on first launch and blanked
  in the file.
- `/api/settings` now **refuses** secrets, so a later save cannot write them
  back in the clear and undo the migration.
- Saving a credential restarts the backend, which was started with the old
  values.

If the OS keystore is unavailable, saving **fails and says so** rather than
silently storing plaintext while the UI claims encryption. Settings shows which
of the two states applies.

## 8. Auto-update

Without it, every fix is invisible to anyone who already installed TORCH.

`electron-updater` checks on launch and every four hours, downloads in the
background, and installs on quit. It never restarts on its own — TORCH can be
mid-task with the agent driving the user's screen, so a forced restart could
interrupt a file operation or a half-written email. A dismissible notice offers
"Restart now"; dismissing leaves the update to apply on next quit.

Update-check failures are logged and otherwise ignored: an unreachable feed
must not reach the user or delay startup.

**Not verifiable here.** Auto-update only runs in a packaged build, and
`is.dev` short-circuits it in development. Confirming it end-to-end needs a
signed release published to the GitHub repo and an older build installed on a
real machine. The wiring is in place; the delivery path is untested.

---

## Tests

```
backend : 173 passed   (154 at the start of part 2)
frontend:  32 passed
typecheck and lint clean
```

New: `backend/tests/test_settings_security.py` — 19 tests covering the
allowlist, type coercion, secret refusal, and that the endpoint still requires
auth.

## Still open from the audit

- Approval "Edit" writes to the developer console only.
- Screen Watch interval, wake-word sensitivity and voice model size are saved
  but never consumed.
- Theme, launch-on-login and minimize-to-tray change local state only.
- Clear memory / Export history / Reset habits have no handlers.
- Web Search page's button has no handler.

---

# Week 3 (part 3) — remaining audit items

Every surface from the audit is now either real or gone.

## Approval "Edit" — wired

The most serious of the batch. The button called `console.log`, but the backend
made it worse: `submit_approval` accepted `"edit"` and the executor treated
anything that was not `"cancel"` as proceed. `editedData` was never sent and
never applied.

So a user could open the approval card, correct a recipient, click Edit — and
watch the step run against the **original** address. A confirmation prompt that
executes something other than what it showed is worse than no prompt.

The card now edits the step's string arguments inline and sends them. The
executor replaces the step's arguments before running, restricted to keys the
step already has so an edit cannot introduce a parameter the tool never
expected.

**A real ordering bug surfaced here.** `resolved_args` is built *before* the
approval pause. Updating only `step["args"]` would have left the tool running
the values the user had just changed away from. Both are updated now.

Also found and deleted `chat/ApprovalCard.tsx` — a duplicate that nothing
imported. The rendered component is `aicss/ApprovalCard`.

## Wired

- **Voice model size** — `voice.py` hardcoded Whisper `"base"` while Settings
  saved the choice.
- **Launch on login** — now goes through Electron's login-item settings.
- **Minimize to tray** — decides whether the window hides to the companion or
  minimises normally; persisted in `userData`.
- **Clear memory / Export history / Reset all habits** — backed by
  `DELETE /api/memory` and `DELETE /api/habits`, with targeted storage methods
  rather than `clear_all()`, which would also have deleted task history. Export
  downloads JSON. Each reports what it did.
- **Web Search button** — routes the query through the Command Center, so
  search runs through the agent rather than a second path.

## Removed

- **Theme** — the app is light-only; the dark option did nothing.
- **Wake-word sensitivity** — `WakeWordDetector` is never instantiated.
- **Screen Watch interval** — there is no capture worker.

Nothing consumed these. Leaving a control that implies an effect it does not
have is the thing this pass exists to remove.

---

# Week 4 — UI Automation screen control

## Why

| Method | Per action | Targeting |
|---|---|---|
| Local vision (Qwen2.5-VL, CPU) | ~183,000 ms | guesses coordinates |
| Cloud vision (Gemini) | ~5,600 ms | guesses coordinates |
| **UI Automation** | **~66–500 ms** | **exact, by name** |

Speed is not the only gain. Vision infers a coordinate from an image; UIA reads
the real bounding box of a control it can name, so "click Send" targets the
actual Send button. It also never takes a screenshot — which matters for an
agent pointed at whatever is on someone's screen.

## What was built

`backend/tools/uia_control.py` — `describe_screen`, `read_screen`,
`click_element`, `type_into`.

- Clicking prefers the invoke pattern over a synthetic click: it does not
  depend on the control being unobscured or the pointer landing precisely.
- An exact name match beats a partial one, so `"Save"` cannot select
  `"Save As"`.
- Disabled and zero-sized controls are skipped — they are in the tree but not
  usable.

`backend/gpu_check.py` — detects whether Ollama has a GPU it can actually use.
It accelerates on NVIDIA, AMD and Apple silicon; Intel integrated graphics are
not supported, which is exactly why local vision costs three minutes a step
here. Local vision should not be offered where it cannot finish.

The planner prompt now tells the model to prefer these tools and keep
`vision_control` for surfaces that expose nothing readable.

Registered in the executor, `VALID_TOOLS`, the `apps` capability, step phrasing
and the PyInstaller bundle.

## Verification, and its limit

**Verified live.** `read_screen` returned 21 real named controls with
coordinates from the focused window. Timing varied by window complexity — 0.2s
on a small tree, ~3s on a large Chrome window. Both are orders of magnitude
below the vision loop.

**Not verified live: the click and type paths.** They have 13 unit tests
covering invoke-pattern preference, exact-match precedence, disabled controls
and plain-language failures. But a real click test needs a scratch application,
and the obvious candidates on this machine hold real user data — Windows 11
Notepad reuses one window with tabs, which is how a previous session's vision
test ended up looking at a `.env.local`. Calculator would not launch here.

That verification still stands open.

## Known limitation

Chromium and Electron apps expose very little of their tree unless
accessibility is enabled. Measured: 5 controls in Chrome versus 36 in native
Calculator. Web content should go through the browser tools; genuinely opaque
surfaces still need vision.

```
backend : 193 passed
frontend:  32 passed
typecheck and lint clean
```
