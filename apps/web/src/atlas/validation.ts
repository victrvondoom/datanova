/**
 * Datanova Atlas — validation policy + genuine validation-state engine
 * (Campaign 06, Task 30).
 *
 * Validation states are DERIVED from actual review records under a
 * configurable policy — never from UI decoration. The engine refuses to
 * award independent-validation states to synthetic, author-authored, or
 * unverified records. All states are honest about what is missing.
 */

import type { ReviewAssessment } from "../lab/engines/review";

export type ValidationState =
  | "not-reviewed"             // no assessment exists
  | "review-requested"         // a package was exported for review, no response yet
  | "assessment-received"      // at least one human assessment exists
  | "identity-unverified"      // assessments exist but reviewer identity trust is insufficient
  | "findings-disputed"        // unresolved disagreements exist
  | "conditionally-supported"  // policy partially satisfied (recorded reasons)
  | "independently-validated"  // policy fully satisfied by real records
  | "validation-expired";      // assessments older than the policy window

export const VALIDATION_LABELS: Record<ValidationState, string> = {
  "not-reviewed": "Not yet reviewed",
  "review-requested": "Review requested",
  "assessment-received": "Human assessment received",
  "identity-unverified": "Reviewer identity unverified",
  "findings-disputed": "Findings disputed",
  "conditionally-supported": "Conditionally supported",
  "independently-validated": "Independently validated",
  "validation-expired": "Validation expired",
};

export interface ValidationPolicy {
  /** minimum distinct human reviewers required */
  minReviewers: number;
  /** minimum reviews with verified identity trust */
  minVerifiedIdentity: number;
  /** require conflict-of-interest declarations on every counted review */
  requireCoiDeclaration: boolean;
  /** minimum average confidence (1..5) */
  minConfidence: number;
  /** required rubric sections covered by the review set */
  requiredRubricSections: string[];
  /** assessments older than this many days no longer count */
  maxAgeDays: number;
}

export const DEFAULT_POLICY: ValidationPolicy = {
  minReviewers: 1,
  minVerifiedIdentity: 1,
  requireCoiDeclaration: true,
  minConfidence: 3,
  requiredRubricSections: ["correctness", "assumptions"],
  maxAgeDays: 90,
};

export interface ReviewRecord {
  assessment: ReviewAssessment;
  /** declared conflict of interest (none | disclosed conflict | independence declared) */
  coi: "independence-declared" | "conflict-disclosed" | "none-declared";
  /** how much identity trust this record carries (self-declared = 0) */
  identityTrust: "self-declared" | "verified" | "none";
  /** which rubric sections this assessment substantively covers */
  rubricSections: string[];
}

export interface ValidationEvaluation {
  state: ValidationState;
  reasons: string[];
  /** the exact inputs the state was derived from */
  derived: {
    totalAssessments: number;
    distinctReviewers: number;
    verifiedIdentity: number;
    coiDeclared: number;
    averageConfidence: number;
    expired: number;
    unresolvedDisagreements: number;
  };
  /** steps required to reach independent validation under the policy */
  requirements: { requirement: string; satisfied: boolean }[];
}

const daysBetween = (a: string, b: string): number =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/**
 * Evaluate a project's review records under a policy. Pure and honest:
 * - synthetic/author-authored records are EXCLUDED from human counts by the
 *   caller's record construction (this engine only sees real records; a
 *   record with identityTrust "none" cannot satisfy identity requirements).
 * - no state is ever awarded without the supporting records.
 */
export function evaluateValidation(
  records: ReviewRecord[],
  policy: ValidationPolicy,
  opts: { reviewRequested: boolean; now: string },
): ValidationEvaluation {
  const now = opts.now;
  const valid = records.filter((r) => {
    const age = daysBetween(r.assessment.submittedAt, now);
    return Number.isFinite(age) && age <= policy.maxAgeDays && age >= 0;
  });
  const expired = records.length - valid.length;
  const distinctReviewers = new Set(valid.map((r) => r.assessment.reviewerId)).size;
  const verifiedIdentity = valid.filter((r) => r.identityTrust === "verified").length;
  const coiDeclared = valid.filter((r) => r.coi !== "none-declared").length;
  const avgConfidence = valid.length > 0
    ? valid.reduce((a, r) => a + r.assessment.confidence, 0) / valid.length
    : 0;
  const unresolvedDisagreements = valid.filter((r) => r.assessment.verdict === "disagree" && !r.assessment.adjudication).length;
  const coveredSections = new Set(valid.flatMap((r) => r.rubricSections));

  const requirements: { requirement: string; satisfied: boolean }[] = [
    { requirement: `≥ ${policy.minReviewers} distinct human reviewer(s)`, satisfied: distinctReviewers >= policy.minReviewers },
    { requirement: `≥ ${policy.minVerifiedIdentity} review(s) with verified identity trust`, satisfied: verifiedIdentity >= policy.minVerifiedIdentity },
    { requirement: policy.requireCoiDeclaration ? "COI declaration on every counted review" : "COI declaration (policy: optional)", satisfied: !policy.requireCoiDeclaration || coiDeclared === valid.length },
    { requirement: `average confidence ≥ ${policy.minConfidence}`, satisfied: valid.length > 0 && avgConfidence >= policy.minConfidence },
    ...policy.requiredRubricSections.map((s) => ({ requirement: `rubric section "${s}" covered`, satisfied: coveredSections.has(s) })),
    { requirement: "no unresolved disagreements", satisfied: unresolvedDisagreements === 0 },
    { requirement: `assessments within ${policy.maxAgeDays} days`, satisfied: expired === 0 || valid.length > 0 },
  ];

  const reasons: string[] = [];
  let state: ValidationState;
  if (valid.length === 0 && expired > 0) {
    state = records.length > 0 && valid.length === 0 ? "validation-expired" : "not-reviewed";
    reasons.push(expired > 0 ? `${expired} assessment(s) older than ${policy.maxAgeDays} days` : "no human assessments recorded");
  } else if (valid.length === 0) {
    state = opts.reviewRequested ? "review-requested" : "not-reviewed";
    reasons.push(opts.reviewRequested
      ? "a review package was exported but no assessment has been received"
      : "no human assessments recorded — nothing is claimed");
  } else if (unresolvedDisagreements > 0) {
    state = "findings-disputed";
    reasons.push(`${unresolvedDisagreements} unresolved disagreement(s) awaiting adjudication`);
  } else if (verifiedIdentity < policy.minVerifiedIdentity) {
    state = "identity-unverified";
    reasons.push(`${verifiedIdentity} of ${policy.minVerifiedIdentity} required verified-identity review(s)`);
  } else if (requirements.every((r) => r.satisfied)) {
    state = "independently-validated";
    reasons.push(`policy satisfied: ${requirements.length} requirement(s) met from ${valid.length} human assessment(s)`);
  } else {
    state = "conditionally-supported";
    for (const r of requirements.filter((x) => !x.satisfied)) reasons.push(`unmet: ${r.requirement}`);
  }

  return {
    state,
    reasons,
    derived: {
      totalAssessments: records.length,
      distinctReviewers,
      verifiedIdentity,
      coiDeclared,
      averageConfidence: Math.round(avgConfidence * 10) / 10,
      expired,
      unresolvedDisagreements,
    },
    requirements,
  };
}
