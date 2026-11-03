/**
 * Campaign 05, Tasks 12/15/34 — Independent review protocol, reviewer
 * assessments, disagreement classification, adjudication, and review
 * quality analysis.
 *
 * HONESTY CONTRACT: no reviewer identities are invented. The protocol below
 * is how a REAL human reviewer records an assessment; until assessments
 * exist, every dependent dashboard state reports "not yet validated". A
 * self-declared reviewer name is attribution metadata, NOT authentication.
 */

export type ReviewVerdict = "agree" | "disagree" | "uncertain";
export type IdentityKind = "self-declared" | "anonymous";
export type DisagreementKind = "fact" | "assumption" | "interpretation" | "scoring-criteria";

export interface ReviewAssessment {
  id: string;
  /** benchmark case, grounded case, or package finding under review */
  targetId: string;
  reviewerId: string;
  identity: IdentityKind;
  verdict: ReviewVerdict;
  /** 1 (guess) .. 5 (verified against the cited source) */
  confidence: 1 | 2 | 3 | 4 | 5;
  /** required: an assessment without rationale is invalid */
  rationale: string;
  /** source ids or package element refs supporting the assessment */
  evidenceRefs: string[];
  submittedAt: string;
  /** what the reviewer disagrees about, when verdict === disagree */
  disagreementKind?: DisagreementKind;
  /** recorded only after a maintainer adjudicates */
  adjudication?: { decision: "accept-review" | "reject-review" | "defer"; rationale: string; decidedBy: string };
}

/** Task 12 — the review rubric every reviewer applies (auditable protocol). */
export const REVIEW_RUBRIC: { dimension: string; question: string }[] = [
  { dimension: "realism", question: "Is the scenario a realistic architecture situation an engineer would actually face?" },
  { dimension: "expected-outcome", question: "Is the documented expected outcome technically correct, independent of the implementation?" },
  { dimension: "correctness", question: "Does the engine's actual result match the documented expected outcome?" },
  { dimension: "assumptions", question: "Are the scenario's assumptions stated explicitly and are they reasonable?" },
  { dimension: "scoring", question: "Does the scoring criterion measure what it claims to measure?" },
];

/** Task 12 — reviewer qualification expectations (roles, not identities). */
export const REVIEWER_QUALIFICATIONS = [
  "Has designed or operated distributed systems in production (not necessarily formally credentialed).",
  "Can read the cited sources and judge whether the claim follows from them.",
  "Is not the author of the evaluated rule, scenario, or expected outcome (independence requirement).",
  "Records disagreements with evidence references rather than preference.",
];

export interface AssessmentProblem {
  assessmentId: string;
  problem: string;
}

/** An assessment is valid only with rationale; disagreement requires a kind + evidence. */
export function validateAssessments(assessments: ReviewAssessment[]): AssessmentProblem[] {
  const problems: AssessmentProblem[] = [];
  const seen = new Set<string>();
  for (const a of assessments) {
    if (!a.id || seen.has(a.id)) problems.push({ assessmentId: a.id, problem: "duplicate or missing id" });
    seen.add(a.id);
    if (!a.targetId) problems.push({ assessmentId: a.id, problem: "missing target" });
    if (!a.reviewerId) problems.push({ assessmentId: a.id, problem: "missing reviewer (self-declared is fine; anonymous is a valid choice)" });
    if (a.identity !== "self-declared" && a.identity !== "anonymous") {
      problems.push({ assessmentId: a.id, problem: "identity must be self-declared or anonymous — nothing else is claimed" });
    }
    if (a.rationale.trim().length < 20) problems.push({ assessmentId: a.id, problem: "rationale too short to be meaningful" });
    if (a.verdict === "disagree" && !a.disagreementKind) {
      problems.push({ assessmentId: a.id, problem: "disagreement must be classified (fact/assumption/interpretation/scoring-criteria)" });
    }
    if (a.verdict === "disagree" && a.evidenceRefs.length === 0) {
      problems.push({ assessmentId: a.id, problem: "disagreement without evidence references" });
    }
    if (a.confidence < 1 || a.confidence > 5) problems.push({ assessmentId: a.id, problem: "confidence must be 1..5" });
  }
  return problems;
}

/**
 * Task 15 — disagreement analysis across assessments of one target.
 * Agreement is reported as data, never as proof of correctness.
 */
export interface TargetConsensus {
  targetId: string;
  agree: number;
  disagree: number;
  uncertain: number;
  unresolvedDisagreements: DisagreementKind[];
  status: "unreviewed" | "agreement" | "disagreement-open" | "disagreement-adjudicated";
}

export function consensusFor(targetId: string, assessments: ReviewAssessment[]): TargetConsensus {
  const mine = assessments.filter((a) => a.targetId === targetId);
  const disagree = mine.filter((a) => a.verdict === "disagree");
  const unresolved = new Set(disagree.filter((d) => !d.adjudication).map((d) => d.disagreementKind!));
  const adjudicated = disagree.filter((d) => d.adjudication);
  return {
    targetId,
    agree: mine.filter((a) => a.verdict === "agree").length,
    disagree: disagree.length,
    uncertain: mine.filter((a) => a.verdict === "uncertain").length,
    unresolvedDisagreements: [...unresolved],
    status:
      mine.length === 0 ? "unreviewed" :
      unresolved.size > 0 ? "disagreement-open" :
      adjudicated.length > 0 ? "disagreement-adjudicated" : "agreement",
  };
}

/** Task 34 — review quality dimensions for one assessment (quality ≠ agreement). */
export interface ReviewQuality {
  assessmentId: string;
  hasRationale: boolean;
  citesEvidence: boolean;
  evidenceGrounded: boolean;
  reproducible: boolean;
  score: number; // 0..5 quality points, NOT correctness
}

export function reviewQuality(a: ReviewAssessment, validSourceIds: ReadonlySet<string>): ReviewQuality {
  const hasRationale = a.rationale.trim().length >= 20;
  const citesEvidence = a.evidenceRefs.length > 0;
  const evidenceGrounded = a.evidenceRefs.every((r) => validSourceIds.has(r));
  const reproducible = /fixture|seed|command|scenario|case [a-z0-9-]+/i.test(a.rationale);
  const score = [hasRationale, citesEvidence, evidenceGrounded, reproducible, a.confidence >= 3].filter(Boolean).length;
  return { assessmentId: a.id, hasRationale, citesEvidence, evidenceGrounded, reproducible, score };
}

/**
 * Task 15 — preserve original assessments across case updates: assessment
 * history is append-only. Updating a case never rewrites recorded reviews.
 */
export function assessmentHistory(targetId: string, assessments: ReviewAssessment[]): ReviewAssessment[] {
  return assessments
    .filter((a) => a.targetId === targetId)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
}
