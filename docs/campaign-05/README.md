# Campaign 05 — Human Verification, External Grounding & Evidence Exchange

**Repo:** `datanova` · **Branch:** `master` · **Baseline:** commit `ae6555f`
(Campaign 04 complete and pushed; working tree clean; baseline re-verified at
campaign start — see `test-and-evidence-report.md`).

## Mission — the three C04 gaps this campaign attacks

1. **Real assistive-technology verification.** C04 delivered browser-level
   a11y tests + a manual protocol whose run log says NOT YET RUN. Campaign 05
   audits the actual environment (Task 01 result: **NVDA not installed,
   JAWS not installed, Windows Narrator present**), executes what the
   environment genuinely permits, and keeps unexecuted human checks
   explicitly visible.
2. **External grounding.** The lab's technical claims are currently its own.
   Campaign 05 adds a source registry of real, traceable primary references,
   a claim-to-source mapping, a grounded case library, and a grounded
   explanation layer — with strict validation that nothing is labeled
   externally grounded without a real source.
3. **Portable evidence exchange.** C04 exports deterministic evidence packs.
   Campaign 05 turns that into a documented, versioned, integrity-checked,
   privacy-aware package format with a safe importer, inbox/outbox,
   reviewer annotations, response packages, and a two-user round trip —
   all offline, file/portable-JSON based (no invented cloud service).

## Documents

- `README.md` — this file.
- `task-ledger.md` — 45 tasks × 5 work packages, statuses + validation
  classifications (`AUTOMATED VERIFIED`, `MANUAL AT VERIFIED`,
  `PROTOCOL READY — NOT EXECUTED`, `EXTERNAL SOURCE GROUNDED`, etc.).
- `architecture.md` — code-grounded integration map for the new engines/UI.
- `decision-log.md` — engineering decisions.
- `human-verification-report.md` — environment audit + accessibility
  evidence ledger (human vs automated checks, honestly separated).
- `external-grounding-registry.md` — the human-readable registry mirror of
  `engines/sources.ts` (real sources; no invented citations).
- `benchmark-validation-report.md` — benchmark v2 forensic audit,
  provenance classification, validity dashboard, review protocol.
- `evidence-exchange-spec.md` — the Datanova Evidence Package (DEP) format
  specification (schema, integrity, redaction, security).
- `security-review.md` — threat model + executable security test results.
- `test-and-evidence-report.md` — exact commands + results + evidence index.
- `known-limitations.md` — honest gaps.
- `FINAL-REPORT.md` — required 12-section campaign report.

## Status and honesty model

A work package is complete only when code/protocol exists, is connected to
the product workflow, its tests or human verification were **actually
executed**, evidence was recorded, and its acceptance condition is
satisfied. NVDA execution is `BLOCKED` (software not installed; installing
requires user authorization this campaign does not have). External review is
`PROTOCOL READY — NOT EXECUTED` until a real human reviewer records an
assessment. No human validation, reviewer identity, or external validation
is ever manufactured.
