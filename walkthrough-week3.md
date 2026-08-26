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
