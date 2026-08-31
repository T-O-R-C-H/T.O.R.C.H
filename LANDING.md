# TORCH — Landing Page

Copy and structure for the single marketing page. Written to be handed
straight to whoever builds it.

**Design language:** the app's own. Light background `#f4f4f5`, white surfaces,
`#e4e4e7` borders, near-black text `#2b2b2b`, square corners, Inter for text
and JetBrains Mono for labels. No gradients, no stock photography, no floating
3D shapes. The page should look like the product.

**Voice:** plain English. The reader has never opened a terminal. Say what
TORCH does, not what it is built from. No "AI-powered", no "leverage", no
"seamless", no model names anywhere.

---

## 1. Nav

Left: TORCH wordmark.
Right: `How it works` · `Pricing` · `Privacy` · `GitHub` · **[ Download for Windows ]**

Sticky, white, 1px bottom border. The download button is the only filled
element in the nav.

---

## 2. Hero

> # Tell your computer what to do. It does it.
>
> TORCH is an assistant that actually works your PC — finds your files, sends
> your email, fills in the form, opens the app. You type or say what you want
> in plain English. It asks before anything that matters.

**[ Download for Windows ]**  ·  *Free. Works offline. Windows 10 and 11.*

Under the buttons, small and grey:
*No account needed to start.*

**Visual:** the actual Command Center, empty state, with the five-node mark.
A real screenshot, not a mockup.

---

## 3. See it work

A single looping screen recording, no sound, roughly 20 seconds. The same
task as the demo video: a command typed, the blue border appearing, the panel
narrating, the approval prompt, the result.

Caption underneath:
> Every step is shown as it happens. Nothing runs behind your back.

---

## 4. What it can do

Six cards, two rows of three. Each: a small line icon, a four-word heading, one
sentence.

**Find anything**
Ask for a file the way you'd describe it to a person. TORCH searches your
folders and opens it.

**Write and send email**
Draft a reply, send a follow-up, check what came in. It shows you the message
before it goes.

**Use your apps for you**
Opens programs and clicks through them the way you would — forms, settings,
the bits nobody enjoys.

**Speak instead of typing**
Press Ctrl+Shift+Space and talk. Your voice is turned into text on your own
computer.

**Ask before anything risky**
Sending, deleting, buying, running commands — TORCH stops and waits for you to
say yes.

**Undo what it did**
Moved the wrong file? One button puts it back.

---

## 5. How it works

Three steps, numbered, horizontal.

**1 — Say what you want**
Type it or say it. "Find the invoice from Tunde and email it to accounts."

**2 — Watch it work**
TORCH breaks the job into steps and shows each one as it goes. A blue border
appears whenever it is controlling your screen, so you always know.

**3 — Approve anything that matters**
Before it sends, deletes, or spends, it stops and asks. You can edit what it
was about to do, or cancel.

---

## 6. Pricing

Three cards. Middle one raised as the recommended choice.

### Free — ₦0
For trying it out, and for people who want everything on their own machine.
- 50 tasks a month
- Runs entirely on your computer
- Voice typing, offline
- All the safety checks

**[ Download ]**

### Pro — ₦4,999/month  *(most popular)*
For daily use.
- Unlimited tasks
- Faster, smarter results using an online assistant
- Everything in Free
- Priority support

**[ Get Pro ]**

### Team — ₦9,999 per person/month
For small teams.
- Everything in Pro, for everyone
- Shared shortcuts across the team
- One invoice
- Onboarding help

**[ Talk to us ]**

Underneath, small:
*Prices in naira, billed monthly. Cancel any time.*

> **Note for whoever builds this:** the Free tier's 50-tasks-a-month limit is
> not implemented in the app today, and neither is any billing. Do not publish
> this section until both exist, or it promises something that cannot be
> delivered or enforced.

---

## 7. Closing call to action

> ## Stop doing the boring parts yourself.
>
> TORCH runs on your computer, asks before anything important, and works
> offline if you want it to.

**[ Download for Windows ]**

Beneath it, the waitlist capture for anyone not on Windows:

> **Not on Windows?** Leave your email and we'll tell you when the Mac version
> is ready.
> `[ your@email.com ]` **[ Notify me ]**

---

## 8. Footer

Four columns, then a bottom bar.

**Product** — Download · How it works · Pricing · What's new
**Company** — About · Contact
**Legal** — [Privacy policy](PRIVACY.md) · Terms
**Code** — [GitHub](https://github.com/T-O-R-C-H/T.O.R.C.H) · Report a problem

Bottom bar, centred, small grey text:

> © 2026 TORCH · **Built in Nigeria** 🇳🇬

---

## Build notes

- **The download button must download.** A button that goes nowhere is the
  first broken promise a visitor meets. Until there is a signed installer,
  point it at the GitHub releases page and label it honestly.
- **Every screenshot must be real.** Take them from the running app. No
  mockups, no invented numbers on the Insights page — that is exactly the
  problem we removed from the product.
- **Say what the Free tier means.** "Runs entirely on your computer" is the
  selling point for anyone nervous about an assistant that can read their
  files. Do not bury it.
- **Do not claim a Mac version exists.** The waitlist is honest; a "coming
  soon" badge on a download button is not.
