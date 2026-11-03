/**
 * Task 37 — Adaptive System-Design Challenge Generator.
 *
 * Generates challenge variations with controlled knobs, estimates difficulty
 * from constraint conflicts and required concepts, recommends based on
 * VERIFIED prior performance only (no invented learner abilities), and
 * validates that challenges are solvable within the supported model.
 */

import { type Requirement } from "../model";

export interface ChallengeSpec {
  id: string;
  title: string;
  scenario: string;
  requirements: Requirement[];
  constraints: string[];
  expectedConcepts: string[];
  difficulty: number;
  completion: { minRequirementsCovered: number; requiredConcepts: string[] };
}

/** Concepts the Lab's canonical model can actually reason about. */
export const SUPPORTED_CONCEPTS = [
  "queueing", "async-decoupling", "caching", "idempotency", "retries", "backoff",
  "read-replica", "rate-limiting", "trust-zones", "tenant-isolation", "sagas",
  "eventual-consistency", "error-budgets", "observability",
] as const;

export type ChallengeKnobs = {
  /** multiplier on the stated peak traffic */
  trafficMultiplier?: number;
  /** require immediate consistency instead of eventual */
  strictConsistency?: boolean;
  /** tighten the latency budget (ms) */
  latencyBudgetMs?: number;
  /** availability target in percent */
  availabilityTarget?: number;
  /** restrict the allowed component count (deployment constraint) */
  maxDeployables?: number;
};

const BASE: Omit<ChallengeSpec, "id" | "difficulty"> = {
  title: "Document processing pipeline",
  scenario: "A SaaS product accepts document uploads, processes them asynchronously, and must stay responsive and reliable at peak.",
  requirements: [
    { id: "C-1", kind: "functional", category: "functionality",
      statement: "Users can upload documents and receive processed results.",
      acceptance: "An upload is acknowledged and a processed result becomes retrievable." },
    { id: "C-2", kind: "nfr", category: "latency",
      statement: "Upload acknowledgement within 800 ms at p95.",
      acceptance: "p95 ack latency <= 800 ms under peak load." },
    { id: "C-3", kind: "nfr", category: "availability",
      statement: "The service is available 99.9% monthly.",
      acceptance: "Availability >= 99.9% over a rolling 30-day window." },
    { id: "C-4", kind: "nfr", category: "consistency",
      statement: "Status reads may lag by up to 30 s.",
      acceptance: "Status freshness between 0 and 30 s." },
  ],
  constraints: [],
  expectedConcepts: ["queueing", "async-decoupling", "idempotency", "retries"],
  completion: { minRequirementsCovered: 4, requiredConcepts: ["queueing", "async-decoupling"] },
};

/** Task 37.2 — deterministic controlled variation. */
export function generateChallenge(id: string, knobs: ChallengeKnobs = {}): ChallengeSpec {
  const requirements = BASE.requirements.map((r) => ({ ...r }));
  const constraints: string[] = [];
  const concepts = new Set<string>(BASE.expectedConcepts);

  if (knobs.trafficMultiplier && knobs.trafficMultiplier !== 1) {
    constraints.push(`Peak traffic is ${knobs.trafficMultiplier}x the base estimate — capacity must be justified.`);
    concepts.add("error-budgets");
  }
  if (knobs.strictConsistency) {
    const c4 = requirements.find((r) => r.id === "C-4")!;
    c4.statement = "Status reads must be immediately consistent (read-after-write).";
    c4.acceptance = "A read after the upload ack never returns a pre-upload state.";
    constraints.push("No staleness window is acceptable for status reads.");
    concepts.add("eventual-consistency"); // the learner must reason about what they give up
  }
  if (knobs.latencyBudgetMs && knobs.latencyBudgetMs !== 800) {
    const c2 = requirements.find((r) => r.id === "C-2")!;
    c2.statement = `Upload acknowledgement within ${knobs.latencyBudgetMs} ms at p95.`;
    c2.acceptance = `p95 ack latency <= ${knobs.latencyBudgetMs} ms under peak load.`;
    constraints.push("The tighter deadline leaves less room for synchronous dependencies.");
    concepts.add("caching");
  }
  if (knobs.availabilityTarget && knobs.availabilityTarget > 99.9) {
    requirements.find((r) => r.id === "C-3")!.statement =
      `The service is available ${knobs.availabilityTarget}% monthly.`;
    constraints.push(`The ${knobs.availabilityTarget}% target halves the error budget relative to 99.9%.`);
    concepts.add("read-replica");
  }
  if (knobs.maxDeployables) {
    constraints.push(`At most ${knobs.maxDeployables} deployable components are allowed (team + budget constraint).`);
  }

  const spec: ChallengeSpec = {
    id, title: BASE.title, scenario: BASE.scenario,
    requirements, constraints,
    expectedConcepts: [...concepts],
    difficulty: estimateDifficulty({ ...BASE, id, requirements, constraints, expectedConcepts: [...concepts], difficulty: 0 }),
    completion: BASE.completion,
  };
  return spec;
}

/** Task 37.3 — difficulty from dependency/conflict/concept pressure. */
export function estimateDifficulty(c: ChallengeSpec): number {
  let score = c.requirements.length * 0.5;
  score += c.expectedConcepts.length * 0.8;
  if (c.constraints.some((x) => /No staleness|immediately consistent/i.test(x))) score += 2; // consistency conflict
  if (c.constraints.some((x) => /At most \d+ deployable/i.test(x))) score += 1.5; // scarcity
  if (c.constraints.some((x) => /halves the error budget/i.test(x))) score += 1.5;
  return Math.round(score * 10) / 10;
}

export interface PriorPerformance {
  /** challenge ids with VERIFIED completion (evidence: accepted submissions) */
  solvedChallenges: string[];
  /** ids of concepts demonstrated in verified solutions */
  demonstratedConcepts: string[];
}

/** Task 37.4 — recommend the next challenge from verified performance only. */
export function recommendChallenge(catalog: ChallengeSpec[], prior: PriorPerformance): { challenge: ChallengeSpec; reason: string } | null {
  if (catalog.length === 0) return null;
  const solved = new Set(prior.solvedChallenges);
  const open = catalog.filter((c) => !solved.has(c.id));
  if (open.length === 0) return null;
  // target the easiest OPEN challenge whose concepts are not yet demonstrated
  const gap = open.find((c) => c.expectedConcepts.some((k) => !prior.demonstratedConcepts.includes(k)))
    ?? open.reduce((a, b) => (b.difficulty < a.difficulty ? b : a));
  return {
    challenge: gap,
    reason: prior.solvedChallenges.length === 0
      ? "no verified prior performance: start with the entry challenge"
      : `targets concepts not yet demonstrated (${gap.expectedConcepts.filter((k) => !prior.demonstratedConcepts.includes(k)).join(", ") || "consolidation"}) based on verified completions only`,
  };
}

/** Task 37.5 — validate that a challenge is solvable within the supported model. */
export function validateChallenge(c: ChallengeSpec): { valid: boolean; problems: string[] } {
  const problems: string[] = [];
  c.requirements.forEach((r) => {
    if (!r.acceptance || r.acceptance.length < 5) problems.push(`requirement ${r.id} has no reviewable acceptance condition`);
  });
  const supported = new Set<string>(SUPPORTED_CONCEPTS);
  c.expectedConcepts.forEach((k) => {
    if (!supported.has(k)) problems.push(`concept "${k}" is outside the supported model`);
  });
  if (c.completion.requiredConcepts.some((k) => !c.expectedConcepts.includes(k))) {
    problems.push("completion requires concepts the challenge does not teach");
  }
  if (c.difficulty <= 0) problems.push("difficulty not computed");
  return { valid: problems.length === 0, problems };
}
