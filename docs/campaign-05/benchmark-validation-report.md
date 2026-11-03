# Campaign 05 — Benchmark Validation Report

Task 11 (forensic audit), 12 (review protocol), 13 (grounded expansion),
14 (scoring traces), 16 (validity dashboard), 20 (external validation
report). Machine implementations: `apps/web/src/lab/engines/benchvalid.ts`,
`engines/review.ts`; tests: `c05-benchvalid.test.ts` (21 cases).

## 1. What the benchmark v2 score actually demonstrates (Task 11)

The Campaign-04 benchmark v2 (8 dimensions, 29 scenarios) was forensically
audited. **Every v2 scenario is classified `synthetic`** — authored together
with the evaluated rule set, expected outcomes restating intended engine
behavior (`classifyV2Corpus`). It measures **self-consistency**: that engine
changes do not break documented reasoning. It does NOT measure real-world
architecture quality, and this campaign never labels it as if it did.

Audit findings recorded per case: provenance, basis statement, and the
explicit exclusion of `externally-reviewed` / `independently-validated`
labels for the v2 corpus (enforced by test).

## 2. Grounded expansion (Task 13)

Eight new grounded benchmark entries derive from the case library
(`evaluateGroundedCorpus`): each validates that its facts cite registered
sources, adaptations are declared, and the claimed modeling engines exist
(`known-engines.ts` cross-checks actual files). All 8 pass. Their
classification is **`EXTERNAL SOURCE GROUNDED`** — grounding of the
evidence trail, not independent validation of engine conclusions.

## 3. Scoring transparency (Task 14)

Every scenario now produces a structured `ScoringTrace`: dimension,
criterion, inputs, outcome, rationale, and a failure kind when not passed —
`correctness` (fail), `missing-evidence` (insufficient-evidence),
`unsupported` (not-applicable). The aggregate summary is **reconstructable
from the traces** (`reconstructSummary`, test-verified against
`runBenchmarkV2`). "not-applicable" and "insufficient-evidence" remain
honest outcomes, not failures.

## 4. Independent review protocol (Task 12) — PROTOCOL READY, NOT EXECUTED

- Rubric (`REVIEW_RUBRIC`): realism, expected-outcome, correctness,
  assumptions, scoring quality — five questions per case.
- Reviewer qualifications (`REVIEWER_QUALIFICATIONS`): production
  distributed-systems experience, ability to read the cited sources,
  **independence from the author**, evidence-backed disagreement.
- Assessments (`ReviewAssessment`): verdict (agree/disagree/uncertain),
  confidence 1–5, required rationale, evidence refs; identity is
  `self-declared` or `anonymous` — nothing stronger is claimed, and no
  reviewer identities are invented.
- **Status: zero assessments recorded. Human review remains outstanding and
  every dependent dashboard state reports `not-yet-validated`.**

## 5. Validity dashboard (Task 16)

Computed from actual metadata + review records (`validityDashboard`), shown
in the Capstone panel. Current state (no reviews):

| dimension | status | basis |
|---|---|---|
| synthetic-coverage | validated | 29 v2 scenarios + 8 grounded cases, provenance explicit, CI-gated |
| source-quality | validated | 19 sources / 24 claims / 8 cases pass all registry invariants |
| reviewer-coverage | **not-yet-validated** | 0 human assessments — MISSING validation, shown as missing |
| oracle-independence | **not-yet-validated** | expected outcomes authored by the engine author |
| unresolved-disagreement | validated (trivially) | no disagreements — and the dashboard says the triviality honestly |

Missing validation is distinguished from failed validation: a broken source
reference would show `failed-validation`; an absent review shows
`not-yet-validated`. Never conflated.

## 6. Disagreement and adjudication (Task 15)

`consensusFor` computes per-target agreement/disagreement; open
disagreements are classified (fact / assumption / interpretation /
scoring-criteria) and remain visible until adjudicated; adjudication is
recorded and preserved; assessment history is append-only
(`assessmentHistory` — case updates never rewrite recorded reviews).
Agreement counts are reported as data, **never as proof of correctness**.

## 7. External validation report (Task 20)

`externalValidationReport` separates, from actual records: synthetic
results (29 scenarios, pass/fail counts), grounded cases (8, citing 17
sources, "EXTERNAL SOURCE GROUNDED" with the not-independently-validated
caveat), human review (0 assessments — "PROTOCOL READY — NOT EXECUTED"),
and independent validation ("NOT INDEPENDENTLY VALIDATED: scenarios,
expected outcomes, and engines share an author"). Rendered in the Capstone
panel and test-verified — including that unreviewed results cannot be
mislabeled as reviewed.

## 8. Counterexample corpus (Task 18)

Five challenges against the critic (`counterexamples.ts`): one positive
control (SPOF rule fires on the flawed fixture) and four false-positive
challenges (async buffer → no SPOF; idempotent service → no idempotency
finding; explicit timeout → no external-call finding; documented orphan →
no complexity finding). All pass; a deliberately broken expectation is
reported as failing (the corpus cannot hide regressions).

## 9. Limitations (unchanged and explicit)

- The v2 corpus is synthetic self-consistency, not real-world performance.
- Grounded cases validate the grounding trail, not the engines' conclusions.
- Reviewer-disagreement analytics are inert until real reviews exist.
- No third-party architecture-review baseline was used at any point.
