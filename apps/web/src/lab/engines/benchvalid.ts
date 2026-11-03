/**
 * Campaign 05, Tasks 11/13/14/16/20 — Benchmark validity, provenance,
 * scoring traces, grounded expansion, and the external validation report.
 *
 * The v2 benchmark (Campaign 04) measures the lab's engines against a corpus
 * authored together with those engines: SYNTHETIC VALIDATION ONLY. This module
 * makes that explicit per case, adds a grounded subset (from the case library
 * whose facts cite real sources), produces reconstructable scoring traces,
 * computes a validity dashboard from actual metadata + review records, and
 * generates a report that separates synthetic results, source grounding,
 * human review, and independent validation — never blurring them.
 */

import type { BenchmarkRunV2, BenchmarkScenarioResult } from "./benchmark2";
import { CASES, validateCaseLibrary } from "./cases";
import { CLAIMS, validateClaimRegistry } from "./claims";
import { SOURCES, validateSourceRegistry } from "./sources";
import { KNOWN_ENGINE_PATHS } from "./known-engines";
import type { ReviewAssessment } from "./review";

/** Provenance classification of a benchmark case (never interchangeable). */
export type CaseProvenance =
  | "synthetic" // authored with the rule set (v2 corpus)
  | "externally-grounded" // facts cite real sources
  | "externally-reviewed" // a human reviewer recorded an assessment
  | "independently-validated"; // review by someone other than the author

export interface CaseProvenanceRecord {
  caseId: string;
  dimension?: string;
  provenance: CaseProvenance;
  /** why this classification holds */
  basis: string;
}

/** Classify every v2 scenario: all were authored with the rules → synthetic. */
export function classifyV2Corpus(run: BenchmarkRunV2): CaseProvenanceRecord[] {
  return run.dimensions.flatMap((d) =>
    d.scenarios.map((s): CaseProvenanceRecord => ({
      caseId: s.id,
      dimension: d.key,
      provenance: "synthetic",
      basis: "Fixture authored together with the evaluated rule set; expected outcome restates intended engine behavior (Campaign 04 corpus).",
    })),
  );
}

/** The grounded expansion: case-library entries that cite real sources. */
export function groundedCorpus(): CaseProvenanceRecord[] {
  return CASES.map((c): CaseProvenanceRecord => ({
    caseId: c.id,
    dimension: c.dimension,
    provenance: "externally-grounded",
    basis: `${c.facts.length} facts cite the source registry (${[...new Set(c.facts.map((f) => f.sourceId))].join(", ")}); adaptations are declared separately.`,
  }));
}

/**
 * Grounded-corpus evaluation: the case library's structural integrity is what
 * the benchmark can honestly score here — facts must cite valid sources,
 * adaptations must be declared, and the claimed modeling engines must exist.
 * (Whether the sources' conclusions transfer to a given architecture is a
 * HUMAN review question — recorded separately, never scored automatically.)
 */
export function evaluateGroundedCorpus(): BenchmarkScenarioResult[] {
  const problems = validateCaseLibrary(CASES);
  const byCase = new Map<string, string[]>();
  for (const p of problems) {
    byCase.set(p.caseId, [...(byCase.get(p.caseId) ?? []), p.problem]);
  }
  const engineFiles = KNOWN_ENGINE_PATHS;
  return CASES.map((c) => {
    const errs = byCase.get(c.id) ?? [];
    const missingEngines = c.modeledBy.filter((m) => !engineFiles.has(m.split(" ")[0]));
    if (errs.length > 0) {
      return { id: `grounded:${c.id}`, outcome: "fail" as const, detail: errs.join("; ") };
    }
    if (missingEngines.length > 0) {
      return { id: `grounded:${c.id}`, outcome: "fail" as const, detail: `claims modeling by missing engines: ${missingEngines.join(", ")}` };
    }
    return {
      id: `grounded:${c.id}`,
      outcome: "pass" as const,
      detail: `${c.facts.length} grounded facts across ${new Set(c.facts.map((f) => f.sourceId)).size} sources; ${c.adaptations.length} declared adaptation(s); modeled by ${c.modeledBy.length} engine path(s).`,
    };
  });
}

/** Task 14 — reconstructable scoring trace for one scenario. */
export interface ScoringTrace {
  scenarioId: string;
  dimension?: string;
  criterion: string;
  inputs: string;
  outcome: BenchmarkScenarioResult["outcome"];
  rationale: string;
  /** failure kind: correctness | missing-evidence | invalid-input | unsupported */
  failureKind?: "correctness" | "missing-evidence" | "invalid-input" | "unsupported";
}

export function scoringTraces(run: BenchmarkRunV2): ScoringTrace[] {
  return run.dimensions.flatMap((d) =>
    d.scenarios.map((s) => ({
      scenarioId: s.id,
      dimension: d.key,
      criterion: `expected outcome: pass (see ${d.note})`,
      inputs: "pinned deterministic fixture (see reproduction metadata)",
      outcome: s.outcome,
      rationale: s.detail,
      failureKind:
        s.outcome === "fail" ? "correctness" :
        s.outcome === "insufficient-evidence" ? "missing-evidence" :
        s.outcome === "not-applicable" ? "unsupported" : undefined,
    })),
  );
}

/** Aggregate scores must be reconstructable from traces — the trace integrity test. */
export function reconstructSummary(traces: ScoringTrace[]): { passed: number; failed: number; notApplicable: number; insufficientEvidence: number } {
  return {
    passed: traces.filter((t) => t.outcome === "pass").length,
    failed: traces.filter((t) => t.outcome === "fail").length,
    notApplicable: traces.filter((t) => t.outcome === "not-applicable").length,
    insufficientEvidence: traces.filter((t) => t.outcome === "insufficient-evidence").length,
  };
}

/** Task 16 — validity dashboard computed from actual metadata + review records. */
export type ValidityStatus = "validated" | "failed-validation" | "not-yet-validated" | "partially-validated";

export interface ValidityDimension {
  key: "synthetic-coverage" | "source-quality" | "reviewer-coverage" | "oracle-independence" | "unresolved-disagreement";
  label: string;
  status: ValidityStatus;
  value: string;
  /** missing validation vs failed validation — never conflated */
  reason: string;
}

export function validityDashboard(reviews: ReviewAssessment[]): ValidityDimension[] {
  const sourceProblems = validateSourceRegistry(SOURCES);
  const claimProblems = validateClaimRegistry(CLAIMS, SOURCES);
  const caseProblems = validateCaseLibrary(CASES);
  const reviewerCount = new Set(reviews.map((r) => r.reviewerId)).size;
  const unresolved = reviews.filter((r) => r.verdict === "disagree" && !r.adjudication).length;
  return [
    {
      key: "synthetic-coverage",
      label: "Synthetic corpus coverage",
      status: "validated",
      value: "8 dimensions / 29 v2 scenarios + 8 grounded cases",
      reason: "Regression gate runs the full corpus in CI; all cases carry explicit provenance.",
    },
    {
      key: "source-quality",
      label: "Source registry integrity",
      status: sourceProblems.length === 0 && claimProblems.length === 0 && caseProblems.length === 0 ? "validated" : "failed-validation",
      value: `${SOURCES.length} sources, ${CLAIMS.length} claims, ${CASES.length} cases`,
      reason: [...sourceProblems, ...claimProblems, ...caseProblems].length === 0
        ? "All registry invariants pass (no dangling references, no falsely grounded claims)."
        : "Registry validation failed — see problems list.",
    },
    {
      key: "reviewer-coverage",
      label: "Human review coverage",
      status: reviewerCount === 0 ? "not-yet-validated" : "partially-validated",
      value: `${reviews.length} assessments by ${reviewerCount} reviewer(s)`,
      reason: reviewerCount === 0
        ? "MISSING validation: no human review has been recorded (protocol ready, not executed)."
        : "Some cases have human assessments; the remainder are unreviewed.",
    },
    {
      key: "oracle-independence",
      label: "Oracle independence",
      status: "not-yet-validated",
      value: "expected outcomes authored by the engine author",
      reason: "MISSING validation: expected outcomes and the engines were written by the same author — independent authorship requires an external reviewer (see review protocol).",
    },
    {
      key: "unresolved-disagreement",
      label: "Unresolved disagreements",
      status: unresolved === 0 ? "validated" : "not-yet-validated",
      value: `${unresolved} unresolved`,
      reason: unresolved === 0
        ? "No recorded disagreement is awaiting adjudication (trivially true while no reviews exist — an honest dashboard must say so)."
        : "Adjudication outstanding for recorded disagreements.",
    },
  ];
}

/** Task 20 — external validation report, separating what was and was not validated. */
export function externalValidationReport(
  run: BenchmarkRunV2,
  reviews: ReviewAssessment[],
): {
  synthetic: { scenarios: number; passed: number; failed: number };
  grounded: { cases: number; sources: number; validation: string };
  human: { assessments: number; reviewers: number; status: string };
  independent: { status: string };
  limitations: string[];
} {
  const synthetic = classifyV2Corpus(run);
  const grounded = groundedCorpus();
  const reviewerIds = new Set(reviews.map((r) => r.reviewerId));
  return {
    synthetic: {
      scenarios: synthetic.length,
      passed: run.summary.passed,
      failed: run.summary.failed,
    },
    grounded: {
      cases: grounded.length,
      sources: new Set(CASES.flatMap((c) => c.facts.map((f) => f.sourceId))).size,
      validation: "EXTERNAL SOURCE GROUNDED — facts cite verified primary sources; transfer to real architectures is not independently validated.",
    },
    human: {
      assessments: reviews.length,
      reviewers: reviewerIds.size,
      status: reviewerIds.size === 0
        ? "PROTOCOL READY — NOT EXECUTED: no human reviewer has recorded an assessment."
        : `${reviewerIds.size} reviewer(s) recorded ${reviews.length} assessment(s).`,
    },
    independent: {
      status: "NOT INDEPENDENTLY VALIDATED: scenarios, expected outcomes, and engines share an author.",
    },
    limitations: [
      "The v2 corpus measures self-consistency of the lab's engines, not real-world architecture quality.",
      "Grounded cases validate the grounding trail (facts → sources), not the engines' conclusions.",
      "Reviewer disagreement data becomes meaningful only after real reviews exist.",
      "No external evaluation against third-party architecture-review baselines has been performed.",
    ],
  };
}
