# TORCH — Privacy

**Last updated: 31 August 2026**

TORCH runs on your computer and can see your screen, read your files and send
your email. You should know exactly what happens to all of that. This page is
written to be read, not to protect us.

**The short version:** everything stays on your computer, except the words of
your command — and those only leave if you have set up an online assistant
yourself. We collect nothing.

---

## Screenshots

TORCH takes screenshots while it works so it can see what it is doing.

**They are processed on your computer and never uploaded.** They are held in
memory for the moments the task needs them and are not written to disk as a
permanent record.

Whenever TORCH is controlling your screen, a blue border appears around the
whole display. If the border is not there, TORCH is not driving your screen.

---

## Your voice

If you use voice, your speech is turned into text **on your own computer**, by
a speech model TORCH downloads once and then runs offline. The recording is
not uploaded, not stored, and is discarded as soon as it has been turned into
text.

TORCH is **not** listening in the background. There is no wake word. It records
only while you are holding the microphone open — after you press
Ctrl+Shift+Space or click the microphone — and it stops on its own when you
stop speaking.

The same is true in reverse: when TORCH speaks a reply aloud, the speech is
generated on your computer.

---

## Clipboard history

TORCH keeps a short history of what you have copied, so it can use it in a
task, and clears it daily.

It is stored **only on your computer, encrypted** using your operating system's
own keystore (Windows DPAPI, macOS Keychain, Linux libsecret). On a machine
where that keystore is unavailable, TORCH writes no history at all rather than
writing it in the clear.

---

## Passwords and keys

Your email app password and any assistant API keys are stored **only on your
computer, encrypted** with the same operating-system keystore. They are never
sent anywhere except to the service they belong to — your email password goes
to your email provider, and nowhere else.

---

## When an online assistant is involved

TORCH can run entirely offline. If you leave it that way, nothing about your
commands ever leaves your computer.

If you add an API key in Settings, TORCH uses that company's service to work
out how to carry out your instruction, and **the text of your command is sent
to them.** Which one depends on the key you added:

| If you add a key for | Your commands go to | Their policy |
|---|---|---|
| Google Gemini | Google | https://ai.google.dev/gemini-api/terms |
| DeepSeek | DeepSeek | https://www.deepseek.com/privacy |
| OpenAI | OpenAI | https://openai.com/policies/privacy-policy |
| Anthropic Claude | Anthropic | https://www.anthropic.com/legal/privacy |

If you have added more than one, TORCH prefers Google Gemini, then DeepSeek,
then OpenAI, then Anthropic — unless you pick a specific one in the command box.

**What is sent:** the words of your instruction, and a short summary of the
recent conversation so it can follow context.
**What is not sent:** your screenshots, your files, your clipboard, your
passwords, or your voice recordings.

Delete the key in Settings and TORCH stops sending anything.

---

## What we collect

**Nothing.** There is no analytics, no telemetry, no crash reporting that runs
on its own, and no account.

If you use a "Something went wrong" button to report a problem, you will be
shown exactly what it would send before anything is sent, and you can decide
not to.

---

## Where your data lives

Everything is in two places on your computer:

- **Your tasks, history and memory** — a database file in TORCH's data folder
- **Your clipboard history and credentials** — encrypted files in your
  operating system's application-data folder for TORCH

Nothing is synced. Nothing is backed up anywhere by us.

---

## Deleting everything

**In the app:** Settings → Preferences → Data management. There are buttons to
clear your task history, clear TORCH's memory, and reset everything.

**By hand,** if you would rather be certain — delete these folders:

```
%APPDATA%\torch                       (clipboard history, credentials)
<where you installed TORCH>\data      (tasks, history, memory, voice models)
```

Uninstalling TORCH removes the program. Check the two folders above
afterwards if you want the data gone too.

---

## Children

TORCH is not intended for children under 13.

---

## Changes

If this page changes in a way that affects what happens to your data, the date
at the top changes and the app tells you.

---

## Contact

Questions: open an issue at
https://github.com/T-O-R-C-H/T.O.R.C.H

---

### Notes for maintainers — not part of the published page

Every claim above was checked against the code on 31 August 2026. If any of
these stop being true, **this page has to change in the same commit**:

- Screenshots are never written to disk as a permanent record.
- `tools/voice.py` and `tools/stt.py` reach no cloud recogniser;
  `test_voice_local.py` asserts `recognize_google` appears nowhere.
- There is no wake word; `WakeWordDetector` is deleted.
- TTS is Piper or the local system voice; the old Gemini TTS call is gone.
- `clipboardManager.ts` encrypts with `safeStorage` and writes nothing when
  the keystore is unavailable.
- `credentialStore.ts` encrypts API keys and the Gmail app password with
  `safeStorage`.
- Provider preference order is set in `agent/providers/__init__.py`.
- There is no analytics or telemetry anywhere in the codebase.

The "Something went wrong" button described under *What we collect* is built
(`components/chat/ReportProblem.tsx`). It shows the whole report before
anything leaves, and opening the issue is a second, separate press. Step
results are deliberately excluded from the report — they carry the user's own
data — and `problemReport.test.ts` asserts that.
