# Campaign 05 — Final Report

## 1. Campaign summary

Campaign 05 attacked the three gaps left by Campaign 04 — and closed the
engineering portion of each:

1. **Real accessibility verification.** Environment audit executed (NVDA
   and JAWS not installed; Narrator present). Real AT testing is honestly
   `BLOCKED`/`PROTOCOL READY — NOT EXECUTED`; what the environment did
   permit was executed: a **UI Automation tree capture** of the running app
   (89 named controls; our ARIA tablist exposed as UIA Tab/TabItem), plus a
   real a11y defect found by a new zero-unlabeled-controls regression scan
   (the dashboard theme toggle — fixed, UIA-verified). The lab also gained
   polite live-region announcements, nonvisual architecture summaries, and a
   keyboard-operable ARIA tablist with roving focus.
2. **External grounding.** A registry of **19 real primary sources** (RFCs,
   NIST SP 800-207, peer-reviewed papers from Little 1961 through Dynamo
   SOSP'07 to Chaos Engineering IEEE 2016, official AWS/Stripe/OWASP/
   OpenTelemetry docs, GDPR Art. 5) now backs **19 externally grounded
   claims**, with **5 internal claims honestly labeled** as
   assumption/simplification/heuristic. Every critic finding renders its
   grounded explanation (sources + sections + "does NOT apply when" +
   what the lab adds beyond the sources). An 8-case grounded case library
   separates source facts from Datanova adaptations. The benchmark gained
   per-case provenance, reconstructable scoring traces, a validity dashboard
   that shows missing review as missing, and a review
   protocol/adjudication engine — with zero fabricated reviews.
3. **Portable evidence exchange.** A documented, versioned **Datanova
   Evidence Package** format with deterministic canonical-JSON export,
   per-section integrity checksums (explicitly NOT signatures), a
   security-hardened staged importer (prototype-pollution scanning, strict
   schema, size/depth caps, registry-resolved citations), privacy
   redaction with a pre-export sensitive-content scan, inbox/outbox
   lifecycle, id-keyed reviewer annotations, digest-bound review responses,
   conflict-aware reconciliation, an append-only cross-user provenance
   chain, scenario replay, and retention controls — all verified by a
   **two-user e2e capstone with real separate browser contexts and a real
   file download round trip**.

## 2. Task ledger

`docs/campaign-05/task-ledger.md` — 45 tasks × 5 work packages.
Computed from the checklist: **221 VERIFIED, 4 BLOCKED (02.2, 02.3, 02.4,
42.1 — all NVDA execution, blocked by the environment), 0 in progress, 0
not started → 98.2% verified.** T02/T42 are VERIFIED via their acceptance
conditions' documented-blocker branch. Every WP carries status,
classification, and evidence; the four blocked WPs record their exact
blockers and unexecuted steps.

## 3. Real accessibility verification

- **Executed:** environment audit (NVDA/JAWS absent, Narrator present,
  verified by registry/PATH/Appx scans); UIA platform-tree capture of the
  app (`evidence/uia-intent-tab.txt`); automated a11y suites (C04 6 tests +
  C05 4 tests: zero unlabeled controls, tablist roving focus with focus
  assertions, polite announcements for compile/export/import/accept/reject,
  no-repeat-on-identical-results, failed-request announcements);
  one real defect found and fixed (theme toggle accessible name).
- **Not executed:** NVDA (not installed; installing requires user
  authorization), VoiceOver (no Apple environment), Narrator announcements
  (present but needs a human listener — protocol addendum provided).
- **Separation kept:** UIA + DOM checks are reported as
  `AUTOMATED VERIFIED`; nothing is reported as `MANUAL AT VERIFIED`,
  because it wasn't.

## 4. External grounding registry

19 sources, 24 claims (19 external, 5 honestly internal), 8 grounded
cases — full tables in `external-grounding-registry.md`; machine truth in
`engines/sources.ts`/`claims.ts`/`cases.ts`, all invariants enforced by
tests. Unsupported/uncertain: causal-rule magnitudes, queueing
approximation constants, genome trait weights — labeled internal in every
grounded explanation.

## 5. Benchmark validation

- v2 corpus: 29 scenarios, all classified **synthetic** (self-consistency).
- Grounded expansion: 8 cases, all pass structural grounding validation
  (facts → registered sources; adaptations declared; modeling engines
  exist).
- Scoring: per-scenario traces; aggregate reconstructable from traces
  (test-proven); failure kinds separated (correctness / missing-evidence /
  unsupported).
- Human review: protocol + rubric + qualifications + assessment engine +
  disagreement/adjudication/quality analytics — **zero assessments
  recorded; the dashboard reports `not-yet-validated`, and unreviewed
  results cannot be labeled reviewed** (test-proven).
- Limitations: no independent authorship of expected outcomes yet; no
  third-party baseline.

## 6. Evidence exchange

- Format: DEP v1 (`evidence-exchange-spec.md`): model snapshot +
  assumptions + scenario + results + evidence + claims/sources + manifest
  with per-section fnv1a-32 checksums.
- Export: deterministic canonical JSON; byte-identical for identical
  inputs; content-derived package ids; privacy scan + email redaction by
  default (recorded in `redactions`).
- Import: isolated validation (limits, prototype-pollution scan, strict
  schema, manifest verification, canonical-model re-validation,
  registry-resolved citations, safe future-version failure); staged
  preview → receive → inspect → accept/reject; workspace changes only on
  explicit acceptance.
- Review: id-keyed annotations (package never mutated), resolve/reopen
  with history, digest-bound response packages, conflict-aware
  reconciliation (no silent overwrites), append-only digest-linked
  provenance chain, retention/deletion with attribution preservation.
- Replay: deterministic re-execution of packaged scenarios with honest
  blocked states (no scenario / version mismatch / incompatibility).
- Security: threat model + executable suite (42 unit cases + e2e tamper
  test); unresolved risks recorded (checksum-not-signature, same-origin
  storage, truthful-but-false content) in `security-review.md`.
- Round-trip proof: e2e capstone — A exports → B validates/receives/
  inspects/accepts → annotates → returns a downloaded response → A
  imports it → provenance on both sides.

## 7. Architecture changes

New pure engines: `sources`, `claims`, `cases`, `grounding`,
`counterexamples`, `benchvalid`, `review`, `nonvisual`, `dep`, `exchange`,
`known-engines` (+85 tests). New UI: Evidence Exchange tab
(`panels/Exchange.tsx`, route `#/lab/exchange`), nonvisual summary
(Overview), grounded explanations (Review), validity dashboard (Capstone),
live-region Announcer (ui.tsx), ARIA tablist (LabApp). Fix: theme toggle
accessible name (Navbar). No new dependencies; no public-interface changes;
C04 behavior intact (all C03/C04 suites green within the 371/371 run).

## 8. Verification

Executed (see `test-and-evidence-report.md` for exact commands/output):

| Check | Result |
|---|---|
| `npm test` (vitest) | **371/371** (17 files; +85 new C05) |
| `npx oxlint src` | **0 warnings, 0 errors** |
| `npx tsc -b` + `npm run build` | **clean / ✓ built** |
| Playwright phase A (API stopped) | **27/27** (lab 9, lab-a11y 6, lab-c05 4, trail 4, trail-a11y 3, journey-offline 1) |
| Playwright phase B (API on :8002) | **1/1** online journey (first attempt failed on an operator error — journey started before the API finished loading; documented, passes consistently after the documented health wait) |
| `pytest tests/` / `tests/release/` | **141/141** / **12/12** |
| `mypy` / `ruff check .` | **clean** / **clean** |

Not run (with reasons): real screen-reader testing (environment, §3);
human benchmark review (no reviewer available — engine + protocol ready);
package signing (no key-management infrastructure — explicitly unsupported).

## 9. Evidence index

`docs/campaign-05/`: task-ledger.md, README.md, architecture.md,
decision-log.md, human-verification-report.md,
external-grounding-registry.md, benchmark-validation-report.md,
evidence-exchange-spec.md, security-review.md, test-and-evidence-report.md,
known-limitations.md, evidence/uia-intent-tab.txt ·
`apps/web/src/lab/engines/` (11 new engines) ·
`apps/web/src/lab/__tests__/c05-*.test.ts` (85 cases) ·
`apps/web/e2e/lab-c05.spec.ts` (4 tests incl. the two-user capstone) ·
`apps/web/src/lab/panels/Exchange.tsx`.

## 10. Honest limitations

- **Not independently validated:** the benchmark's synthetic corpus, the
  engines' expected outcomes, and the lab's use of its sources (review
  protocol ready, zero reviews recorded).
- **Manual-only outstanding:** NVDA/JAWS/VoiceOver execution, Narrator
  listening session (protocols with exact steps provided).
- **Signing:** package authenticity unsupported by design (checksums are
  corruption detection); a real key-management decision is deferred.
- **Exchange is file-based only** (download/paste); no channel or server —
  a deliberate scope choice, not a gap in the format.
- **Simulations remain educational models**; nothing is production
  telemetry; the `observed` evidence kind still has no automatic producer.

## 11. Git state

- Branch `master`; campaign work committed and **pushed** (verified below
  after the push); working tree clean.
- Baseline `ae6555f` → this campaign's commit(s) reported in the transcript
  at push time; remote `origin/master` verified synchronized via
  `git log origin/master` after the push.

## 12. Campaign 06 recommendation

**Campaign 06 — First Real Review Cycle.** The infrastructure for
independent validation now exists but has zero human input. The
highest-value next step is to actually run the loop: (1) install NVDA with
user authorization and execute the ready screen-reader protocol (then fix
what it finds); (2) recruit one independent engineer to record real
assessments through the reviewer workspace, exercising the
disagreement/adjudication engine with genuine data; (3) have that reviewer
author expected outcomes for a small grounded benchmark subset, converting
`oracle-independence` from not-yet-validated to partially grounded in
external authorship. This converts the campaign's honest `not-yet-validated`
states into real evidence — the exact purpose for which the machinery was
built.
