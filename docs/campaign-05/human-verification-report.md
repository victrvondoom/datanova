# Campaign 05 — Human Verification Report (Accessibility Evidence Ledger)

This report separates, explicitly and honestly, what was **executed by a
human or against real assistive technology** from what is **automated
browser-level checking**, and records the exact environment evidence.

## 1. Environment audit (Task 01/02, executed 2026-11-03)

| Item | Detection method | Result |
|---|---|---|
| OS | Windows Server (Administrator session, GUI available) | Windows (64-bit) |
| Browser under test | Playwright Chromium (headed possible) | 200 OK against preview build |
| NVDA | registry uninstall scan (`HKLM\...\Uninstall`), `Program Files` scan, PATH | **NOT INSTALLED** |
| JAWS / Freedom Scientific | same scan | **NOT INSTALLED** |
| Windows Narrator | `C:\Windows\System32\Narrator.exe` presence + Appx packages (`Microsoft.Windows.NarratorQuickStart`, NarratorScript.Excel, …) | **PRESENT** |
| UI Automation infrastructure | .NET `System.Windows.Automation` (UIAutomationClient) | **AVAILABLE AND USED** |

**NVDA execution is BLOCKED**: NVDA is not installed on this machine, and
installing software requires user authorization that this campaign does not
have (campaign rule 0.4/0.5). The blocker, the exact unexecuted steps, and
what remains for a human are recorded below — the NVDA protocol itself
(`docs/campaign-04/screen-reader-protocol.md`) remains `PROTOCOL READY —
NOT EXECUTED`.

## 2. Platform-level accessibility evidence (executed this campaign)

Real Windows screen readers (Narrator, NVDA, JAWS) read the **UI Automation
(UIA) tree**, not the DOM. This campaign captured the app's UIA tree directly
— one layer closer to screen-reader reality than any DOM assertion:

**Method.** Launch the production build in headed Chromium with
`--force-renderer-accessibility`, wait for the Intent tab, then walk the
window's UIA descendants via `System.Windows.Automation` (PowerShell).

**Evidence.** `docs/campaign-05/evidence/uia-intent-tab.txt` (89 named
control elements). Selected verbatim lines:

```
Button :: Switch to light theme
Button :: Reset the lab to the default architecture
Group :: Lab sections
Tab    :: Lab sections
TabItem :: 1. Intent
TabItem :: Architecture & Intent
TabItem :: Evidence Exchange
Group :: 1. Intent — what are you trying to build?
Edit   :: Architecture goal
Spinner :: Peak requests per second
```

**What this proves (and what it does not):**

- PROVEN: the ARIA tablist is exposed to Windows AT as real UIA `Tab`/`TabItem`
  elements with names; every control carries a UIA name; panels expose their
  aria-labels as UIA Groups; the theme-toggle fix is visible at platform level.
- NOT PROVEN: what Narrator or NVDA actually *announces* (speech synthesis,
  virtual cursor behavior, announcement ordering). No screen reader was
  operated. This capture is platform-tree verification, not screen-reader
  testing.

**Classification: `AUTOMATED VERIFIED` (platform accessibility tree) —
explicitly NOT `MANUAL AT VERIFIED`.**

## 3. Automated accessibility coverage (executed)

| Suite | Coverage | Result |
|---|---|---|
| `e2e/lab-a11y.spec.ts` (C04, re-run) | keyboard journey, accessible names, severity/evidence-kind labels, intent form, scenario announcements, ariaSnapshot | 6/6 passing |
| `e2e/lab-c05.spec.ts` (new) | exchange-panel labels (zero unlabeled controls across `#root`), tablist roving focus + `aria-selected`, polite live regions (`role="status"`) announcing compile results, nonvisual summaries, grounded explanations, validity dashboard | 4/4 passing |
| Defect found and fixed | the dashboard theme toggle had only a `title`, no accessible name — now `aria-label` (verified in the UIA dump: "Switch to light theme") | fixed + regression-covered |

The unlabeled-control scan in `lab-c05.spec.ts` checks **every** button,
input, textarea, and select in `#root` for an accessible name — it found the
real defect above, and now passes with an empty list.

## 4. Manual screen-reader protocol — status

| Combination | Protocol | Execution status |
|---|---|---|
| NVDA + Chromium (P1) | `docs/campaign-04/screen-reader-protocol.md` | **BLOCKED** — NVDA not installed; installing requires user authorization |
| VoiceOver + Safari (P1) | same protocol, macOS | **BLOCKED** — no Apple environment available |
| Narrator (Windows, present) | see §5 below | **PROTOCOL READY — NOT EXECUTED** — Narrator is installed, but validating announcements requires a human listening; no speech output was captured |

**What remains for a human** (exact steps, from the C04 protocol): for each
supported combination, walk the 7-step lab journey recording what is
announced on view load, focused-control name/role/state, focus order, and
any unlabeled or misleading announcement; file defects with announcement
transcripts; record results in the run log.

## 5. Narrator-specific addendum to the manual protocol

Since Narrator IS present on this machine, the concrete steps for a human
tester are:

1. Build and serve the app (`cd apps/web && npm run build && npx vite preview --port 4173`).
2. Start Narrator (Win+Ctrl+Enter or `Narrator.exe`); enable full verbosity
   (Caps Lock + V toggles modes) so names, roles, and states are spoken.
3. Open the app, navigate to the lab (`Architecture Lab` button), then walk:
   Intent tab (Tab through the form, activate "Compile and review intent" —
   expect the polite announcement "Intent compiled: N problem(s), M
   unresolved field(s)"), Architecture & Intent (expect the canvas text
   alternative and the Nonvisual architecture summary), Causality (operate
   the selects, read findings with severity words), Evidence Exchange
   (validate an import — expect "Package valid: …" or the rejection list),
   Capstone (read the validity dashboard statuses).
4. Record: per step, the exact announcement, whether it matched expectation,
   and any defect, in this file's run log (below).

## 6. Run log

| Date | Combination | Result | Notes |
|---|---|---|---|
| 2026-11-03 | UI Automation tree capture (automated, platform level) | PASS | 89 named controls; tablist exposed as UIA Tab/TabItem; evidence `evidence/uia-intent-tab.txt` |
| — | NVDA | NOT YET RUN | BLOCKED: software not installed |
| — | Narrator | NOT YET RUN | installed; needs a human listener |
| — | VoiceOver | NOT YET RUN | no Apple environment |
