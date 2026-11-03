# Campaign 05 — Known Limitations

What remains honestly incomplete after Campaign 05.

## Real screen-reader testing: STILL NOT EXECUTED

- NVDA and JAWS are **not installed** on the available machine (verified by
  registry/PATH scan); installing requires user authorization this campaign
  does not have. **BLOCKED**.
- Windows Narrator **is installed**, and a Narrator-specific protocol
  addendum exists (`human-verification-report.md` §5), but validating
  announcements requires a human listener; no speech was captured.
  **PROTOCOL READY — NOT EXECUTED**.
- What IS verified: the UI Automation tree (the API Windows AT consumes) —
  89 named controls, tablist exposed as Tab/TabItem — captured from
  accessibility-forced Chromium. This is platform-tree verification,
  **not** screen-reader verification, and is never reported as the latter.
- The dashboard theme-toggle defect the scan found is fixed; the scan is a
  permanent regression gate.

## Benchmark: synthetic self-consistency + grounded trail, not external validation

- All 29 v2 scenarios remain class-synthetic (authored with the rule set).
- The 8 grounded cases validate the **grounding trail** (facts cite real
  sources; adaptations declared) — not the engines' conclusions.
- Zero human assessments recorded: the review protocol, rubric, assessment
  engine, disagreement/adjudication workflow, and quality analysis exist and
  are tested, but the dashboard honestly reports `not-yet-validated` for
  reviewer coverage and oracle independence.
- No third-party baseline was used at any point.

## Evidence exchange: file-based, not authenticated

- No signing: fnv1a-32 checksums detect corruption; they are **not
  signatures**. Author identity is self-declared/anonymous metadata —
  authenticity is explicitly unsupported until a real key-management
  decision exists.
- Exchange is offline file/copy-transfer (download + paste); there is no
  channel, discovery, or multi-user server. This was the deliberate scope
  ("no invented cloud service").
- A valid-looking but false package (misleading evidence text) passes
  integrity checks — integrity proves bytes match the manifest, not that
  content is true. Recipients should replay scenarios and review sources.
- Replay covers scenario-based simulations only; analyses that depend on
  un-packaged inputs are honestly reported as blocked rather than guessed.

## Grounding registry

- 19 real sources back 19 claims; 5 claims are honestly internal
  (assumptions/simplifications/heuristics) and cannot be externally cited —
  including the causal-rule magnitudes and the queueing approximation, which
  remain Datanova modeling choices.
- Registration proves a source exists and was read; it is **not** an
  independent review of how the lab uses it (that is the unexecuted review
  protocol).

## Product-level

- All lab simulations remain deterministic educational models with declared
  assumptions — no production telemetry anywhere (`observed` evidence kind
  exists but nothing generates it automatically).
- The lab remains localStorage-only; exchange state persists per browser.
- Phase-B e2e requires the documented API health wait (one operator error
  this campaign ran the journey before the API finished loading; the
  procedure is documented and the retry passed).
