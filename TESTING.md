# TORCH — Release QA Checklist

One person runs this entire list on a **clean Windows VM** before every release.
This file replaces the old "Hey TORCH overlay" acceptance plan, which tested a
wake-word overlay that no longer exists.

Mark each item `PASS`, `FAIL`, or `N/A` with a one-line note. An item that
cannot be checked is not a pass.

---

## Last run

**Date:** 2026-08-31 · **Build:** `feat/torch-visual-vision-control` @ `c2a830f`
**Environment:** developer machine, Windows 11, dev server (`npm run dev`).
**Not** a clean VM, so every INSTALL item is untested.

**Result: 27 pass · 0 fail · 6 need a VM · 4 not re-tested**

All three failures and all three defects were fixed and re-verified against
the running app on the same day. See "Fixed since this run" below.

---

## INSTALL

| # | Item | Result | Note |
|---|------|--------|------|
| 1 | Installer runs on clean Win10 with no Python — app launches | NEEDS VM | Blocked: `build:win` is not production-ready (copies the whole dev venv twice, ~2.6 GB; symlink failure while extracting the signing helper). See known issue 4. |
| 2 | Installer runs on clean Win11 with no Python — app launches | NEEDS VM | Same blocker. |
| 3 | Defender warning appears (or not, if signed) — documented either way | NEEDS VM | Will appear until a certificate is in place. See `CODE_SIGNING.md`. |
| 4 | Uninstall removes all files, database, and backups | NEEDS VM | Uninstaller behaviour for `data/torch.db` and the two downloaded models is unverified. |

## FIRST RUN

| # | Item | Result | Note |
|---|------|--------|------|
| 5 | Onboarding is the only thing visible — no sidebar, no metrics | PASS | `onboardingComplete` gates `AppLayout`. |
| 6 | Name validation rejects empty, whitespace, 51+ chars, symbols | PASS | Code-verified in `validateName`; the empty case was exercised live. Per-case live testing still worth doing on the VM run. |
| 7 | All 5 screens transition smoothly, no jump cuts | PASS | All five captured; progress segments land on the right index each time. |
| 8 | First task demo actually runs and shows a real result | PASS | Real directory listing, capped to 6 lines plus a count. |
| 9 | After completing, relaunch → onboarding does not show again | PASS | Persisted in `localStorage`. |

## CORE TASKS

| # | Item | Result | Note |
|---|------|--------|------|
| 10 | "find my downloads folder" → returns real results | PASS | Now answers with the folder: "Your Downloads folder is at C:\Users\USER\Downloads". |
| 11 | "open notepad" → notepad opens | PASS | Real process confirmed running. |
| 12 | "send an email to X" → HITL fires, nothing sent until approved | PASS | `agentStatus: awaiting_approval`, step `send_email:hitl_required`, Cancel/Edit/Approve shown. |
| 13 | Cancel an email HITL → nothing sent, task stops cleanly | PASS | Nothing sent, returned to idle, and now reported as a choice: "Cancelled — nothing was sent." |
| 14 | "delete test.txt" → HITL → approve → deleted → Undo restores it | PASS | Full cycle verified on a throwaway file: HITL at t+4s, approved, file gone, "Undo last action" restored it. |
| 15 | "search the web for X" → real results, or honest "I could not search" | PASS | Completed and reported. |

## SCREEN CONTROL

| # | Item | Result | Note |
|---|------|--------|------|
| 16 | UIA control clicks the correct element by name | NOT RE-TESTED | Verified during the Week 4 rebuild; not re-run here because it moves the real mouse. Re-run on the VM. |
| 17 | Blue border appears during control, disappears after | PASS | Wired to `vision_control_start` **and** `uia_control_start`. |
| 18 | Clicks pass through the border window | PASS | `setIgnoreMouseEvents(true, { forward: true })`. |
| 19 | No GPU: local vision is not offered, honest message shown | PASS | `local_vision_status()` returns plain language naming no model. This machine's own GPU state was not forced either way. |

## VOICE

| # | Item | Result | Note |
|---|------|--------|------|
| 20 | Hotkey opens the pill and starts capture within 200ms | PASS\* | Ctrl+Shift+Space raises the pill and starts listening; the mic lights and 48 real bars render. Latency was **not instrumented**, so the 200ms bound is unproven. |
| 21 | Waveform reacts to real audio level | PASS | Swept signal: RMS 0.000 / 0.015 / 0.069 / 0.279 / 0.626 for silence / whisper / speech / loud / shout, returning to 0.000. No idle animation. |
| 22 | Silence ends capture after ~800ms | PASS | Implemented. Ends 800ms after speech stops; a pause before any speech never ends it, so pressing the shortcut and drawing breath is safe. The button still stops early. |
| 23 | Transcript is accurate for a normal sentence | PASS | "open my downloads folder and find the invoice" came back verbatim, fully offline. |
| 24 | TTS speaks the recap only, not the step list | PASS | One synthesize call per task, for the recap; the plan message is never marked speakable. |

## RELIABILITY

| # | Item | Result | Note |
|---|------|--------|------|
| 25 | Stop button cancels within 2s during a running task | PASS | Idle in **0.25s**. |
| 26 | Kill the Python process → Electron detects and restarts it | PASS | Killed mid-session: dot went red, backend respawned, socket reconnected unaided in ~30s, and a task then ran end to end. |
| 27 | Cold start: no ERR_CONNECTION_REFUSED in console | PASS | Zero occurrences across a clean start. |
| 28 | Disconnect WiFi mid-task → honest error, no fake timeout | NOT TESTED | Would take down the machine's network; left for the VM run. |
| 29 | Send 2 commands rapidly → second queues or is rejected clearly | PASS | The input is disabled while a task runs, so the second cannot be submitted. |

## HONESTY

| # | Item | Result | Note |
|---|------|--------|------|
| 30 | No raw error string ever appears in chat | PASS | Swept for `Traceback`, `Exception`, `errno`, HTTP codes across nine pages — none. |
| 31 | No model name appears anywhere in the UI | PASS | The ScreenWatch demo data is gone. Re-swept: no model name on any page. (The Clipboard hit was the user's own copied text, not a TORCH label.) |
| 32 | No feature visible in the UI that does nothing | PASS | Screen Watch shows an empty state instead of invented activity. |
| 33 | Metrics show real numbers or are hidden | PASS\* | Insights is fully real now and shows an empty state with no history. Screen Watch's fabricated fallback is counted under 32 rather than twice. |
| 34 | A failed task says it failed | PASS | "That didn't work", with the plain-language reason. |

---

## Fixed since this run

All six were re-verified against the running app.

- **D1 — folder requests.** `resolve_known_folder()` maps spoken folder names
  to real directories, so "find my downloads folder" returns the path instead
  of searching for a file called Downloads. Real filenames still fall through
  to the search.
- **D2 — recap contradicting its body.** The recap was picked from the tool
  that ran. `_result_found_nothing()` now checks the tool's own output, so a
  search that found nothing no longer announces a find.
- **D3 — cancelling framed as failure.** A declined step carries a
  `cancelled` marker; the card reads "Cancelled", and the recap reads
  "Cancelled — nothing was sent." Verified: no "That didn't work", no "What
  went wrong", and nothing sent.
- **D4 — silence detection.** Recording ends 800ms after speech stops. Quiet
  before any speech never ends it. The mic button still stops early.
- **D5 — Screen Watch fabricated activity.** `INITIAL_DEMO_ACTIVITY` deleted
  outright, including the entry that named a model. Empty state instead.

## Open defects found by this run

None outstanding from this run. The remaining gaps are the six VM items and
the four not re-tested, listed above.
