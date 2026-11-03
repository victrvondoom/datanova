# Campaign 06 — Validation Workflow (as implemented)

Engine: `src/atlas/validation.ts` (pure, tested). UI: Validation Room
(`#/atlas/validation`). Records: localStorage `datanova-atlas-reviews-v1` —
real records only.

## States (derived, never decorative)

`not-reviewed` → `review-requested` → `assessment-received` /
`identity-unverified` / `findings-disputed` / `conditionally-supported` →
`independently-validated` (policy fully met) / `validation-expired`.

Every state carries its derivation: counts of assessments, distinct
reviewers, verified-identity reviews, COI declarations, average confidence,
expired records, unresolved disagreements — plus which policy requirements
are unmet.

## The reviewer workbench

A real human records an assessment: name (self-declared or anonymous),
verdict (agree/disagree/uncertain), confidence 1–5, rationale (mandatory,
≥20 chars, validated by the review engine's `validateAssessments`), rubric
sections covered, conflict-of-interest declaration, and identity trust
(self-declared / verified-by-out-of-band-proof / none). The workbench shows
the architecture + evidence (blinded to the author's workspace state).

## Policy evaluation (tested invariants)

- Zero reviews → `not-reviewed` — the UI says so, nothing is claimed.
- Self-declared identity cannot satisfy the verified-identity requirement →
  `identity-unverified` (e2e-verified end-to-end).
- `identityTrust: "none"` records can NEVER satisfy identity requirements.
- Unresolved disagreements force `findings-disputed` regardless of trust.
- Expired assessments (beyond `maxAgeDays`) do not count.
- Missing COI declarations make the state conditional, never validated.
- Synthetic/author-authored records are excluded by construction: the
  engine only evaluates real recorded assessments.

## Connection to the rest of the product

Mission Control and the workspace header display the same derived state;
the Validation Room links to the claim/source trace (Sources), the evidence
package exchange (Exchange), and the critic findings (Studio). The
e2e "validation room" test proves the full loop: submit → state changes to
the honest unverified-identity state with the record visible.
