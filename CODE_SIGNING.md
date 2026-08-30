# TORCH — Windows Code Signing

What to buy, what it costs, and what to do. Written to be actioned without
further research.

---

## Why this is not optional

TORCH is an unsigned Electron app that runs terminal commands, reads mail and
controls the mouse. Unsigned, every user meets **Microsoft Defender SmartScreen**
on first launch:

> Windows protected your PC — Microsoft Defender SmartScreen prevented an
> unrecognised app from starting.

The Run button is hidden behind "More info". For a non-technical audience —
which is TORCH's stated design constraint — that screen is where most installs
end. Signing is the difference between a launch and a bounce.

---

## What to buy

Two kinds of certificate exist. **The difference is not encryption quality,
it is how SmartScreen treats you on day one.**

| | OV (Organisation Validation) | EV (Extended Validation) |
|---|---|---|
| SmartScreen on day one | Still warns. Warning fades as installs accumulate ("reputation") | **No warning immediately** |
| Time to build reputation | Weeks to months, and resets on certificate change | None |
| Typical cost | **$200–$400 / year** | **$400–$700 / year** |
| Key storage | Hardware token or cloud HSM (mandatory since June 2023) | Hardware token or cloud HSM |
| Issued to | Registered organisation | Registered organisation, stricter checks |
| Individual/sole trader eligible | Some CAs, with extra checks | Rarely |

### Recommendation

**Buy an OV certificate from a cloud-HSM provider, not a shipped USB token.**

Reasoning:
- EV's only real advantage is skipping reputation-building. At pre-launch
  volume you would pay roughly double for a head start you can also earn.
- A **physical USB token cannot be used from CI.** If TORCH is ever built by
  GitHub Actions, a shipped token means signing by hand on one machine
  forever. Cloud HSM signing works from CI on day one.
- Since **June 2023** all new code-signing keys must live on FIPS 140-2 Level 2
  hardware. "Download the .pfx and sign locally" no longer exists. Anyone
  offering that is selling something outdated.

**Concretely: SSL.com or DigiCert OV code signing with cloud signing
(eSigner / KeyLocker), ~$250–$400/year.** SSL.com is usually the cheapest
route with cloud signing included rather than as an upsell.

Also viable if TORCH stays a personal project: **Azure Trusted Signing**,
about **$9.99/month**, which is dramatically cheaper — but it requires a
verifiable organisation with a **3+ year history** for the identity check.
Check eligibility before counting on it.

---

## Before you buy: what they will ask for

Validation is the slow part — days, not minutes. Have these ready:

1. **A registered legal entity.** Company name and registration number.
   TORCH's stated base is Ilorin, Nigeria — the entity must be registered and
   independently verifiable.
2. **A verifiable business address**, matching the registration.
3. **A verifiable phone number** listed in a public directory the CA accepts
   (a third-party business directory, or a legal opinion letter from a lawyer
   or accountant, which most CAs accept in place of a directory listing).
4. **A business email** on the domain.
5. **Government photo ID** for the person requesting.

The phone-number check is where applications usually stall. If there is no
public directory entry, ask the CA up front for the **legal opinion letter**
template and get it signed by a lawyer or accountant.

---

## Steps

1. **Confirm the legal entity details** above are ready. This gates everything.
2. **Buy** OV code signing with cloud signing. Budget ~$250–$400 for year one.
3. **Complete validation.** Expect 1–5 business days. Answer the callback
   promptly — an unanswered verification call adds days.
4. **Provision the signing credential** in the CA's cloud service and note:
   - the credential/certificate ID
   - the API username and password
   - the TOTP secret used for automated signing
5. **Store those as secrets**, never in the repo. For CI, GitHub Actions
   repository secrets. Locally, environment variables — not `.env`, which is
   already used for API keys and is rewritten by the settings endpoint.
6. **Wire electron-builder.** With a cloud HSM the signing step is a custom
   hook rather than a certificate file:
   - set `win.signtoolOptions.sign` to a script that calls the CA's signing
     CLI (SSL.com's `CodeSignTool`, DigiCert's `smctl`)
   - remove any `certificateFile` / `certificatePassword` config — it does
     not apply to HSM-backed keys
7. **Sign both** the app executable and the NSIS installer. An unsigned
   installer wrapping a signed binary still triggers SmartScreen.
8. **Verify** on a clean VM: right-click the installer, Properties, and check
   the Digital Signatures tab, then confirm no SmartScreen prompt appears.
9. **Record the result** in `TESTING.md` item 3 either way.

---

## What blocks this on our side

The certificate is necessary but not sufficient. **`build:win` does not
currently produce a shippable artifact** (known issue 4): it copies the whole
development virtual environment twice, about 2.6 GB unpacked, and the local
build fails when electron-builder cannot create symlinks while extracting its
signing helper.

The PyInstaller runtime bundle has to land before there is a binary worth
signing. Buying the certificate now is still the right call — validation takes
longer than the packaging work.

---

## Cost summary

| Item | Cost |
|---|---|
| OV certificate with cloud signing, year one | $250–$400 |
| Azure Trusted Signing, if eligible | ~$120/year |
| EV, if the day-one warning must be avoided | $400–$700 |
| Renewal | Same, annually |

**Prices are from the CAs' public list pricing and move with promotions —
confirm at the point of purchase rather than treating these as quotes.**
