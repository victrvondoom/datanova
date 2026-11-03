/**
 * Campaign 05, Task 07 — Architecture claim-to-source mapping.
 *
 * A bibliography alone is not evidence. This registry inventories the
 * important technical claims Datanova's lab makes (critique rules, models,
 * recommendations) and maps each to either real external sources (with the
 * section that supports it) or an explicit internal classification
 * (assumption / simplification / heuristic). Validation rejects:
 *  - claims marked `external` that cite zero or nonexistent sources,
 *  - claims marked internal that cite sources as if externally grounded,
 *  - dangling source ids.
 */

import { SOURCES, validateSourceRegistry, type ExternalSource } from "./sources";

export type ClaimKind = "external" | "assumption" | "simplification" | "heuristic";

export interface GroundedClaim {
  id: string;
  /** the claim in one sentence */
  statement: string;
  kind: ClaimKind;
  /** source ids from the registry (required iff kind === "external") */
  sources: string[];
  /** which lab capability makes this claim */
  appliesTo: string[];
  /** what the lab models BEYOND the source (honest delta) */
  labDelta?: string;
}

export const CLAIMS: GroundedClaim[] = [
  {
    id: "claim-retry-storms",
    statement: "Retries without limits, backoff, or jitter amplify overload instead of recovering from it.",
    kind: "external",
    sources: ["src-awstimeouts"],
    appliesTo: ["engines/causal.ts (retry-driven propagation rules)", "engines/critic.ts (unidempotent-mutations)"],
    labDelta: "The lab models retry-driven load multiplication deterministically; the source documents the operational failure mode.",
  },
  {
    id: "claim-timeouts-required",
    statement: "Every synchronous dependency call needs an explicit timeout, or a hanging dependency stalls the caller until its own resources are exhausted.",
    kind: "external",
    sources: ["src-releaseit", "src-awstimeouts"],
    appliesTo: ["engines/critic.ts (sync-external rule)", "engines/latency.ts"],
  },
  {
    id: "claim-tail-fanout",
    statement: "In high-fanout request paths, user-visible latency approaches the slowest backend's tail, so one slow dependency degrades the whole operation.",
    kind: "external",
    sources: ["src-tailatscale"],
    appliesTo: ["engines/latency.ts (path composition)", "engines/sensitivity.ts"],
    labDelta: "The lab models per-hop maxima rather than full percentile distributions; the source motivates the pattern.",
  },
  {
    id: "claim-littles-law",
    statement: "Long-run queue depth equals arrival rate multiplied by average time in system (L = λW).",
    kind: "external",
    sources: ["src-little1961"],
    appliesTo: ["engines/traffic.ts (queue estimates)"],
    labDelta: "Applied to steady-state approximations; burst dynamics use the discrete workload simulation instead.",
  },
  {
    id: "claim-backpressure",
    statement: "Queues without capacity bounds convert overload into invisible memory growth; bounded queues make overload visible as backpressure or rejection.",
    kind: "external",
    sources: ["src-reactive-manifesto", "src-awstimeouts"],
    appliesTo: ["engines/critic.ts (unbounded-queue rule)", "engines/traffic.ts (saturation)"],
  },
  {
    id: "claim-spof-redundancy",
    statement: "A component on a critical path without redundancy or an async buffer in front is a single point of failure for the operations that traverse it.",
    kind: "external",
    sources: ["src-releaseit", "src-srebook"],
    appliesTo: ["engines/critic.ts (spof rule)", "engines/blastradius.ts"],
    labDelta: "The lab's blast-radius analysis computes the actual impacted operations rather than asserting criticality by role.",
  },
  {
    id: "claim-idempotency-keys",
    statement: "For mutating APIs reachable through retries, idempotency keys bound to the payload (with stored first responses and a retention window) make retries safe.",
    kind: "external",
    sources: ["src-stripe-idem", "src-ietf-idem"],
    appliesTo: ["engines/idempotency.ts", "engines/critic.ts (unidempotent-mutations rule)"],
    labDelta: "The IETF draft is standards-track but not yet an RFC — cited with that status.",
  },
  {
    id: "claim-cap-partition",
    statement: "During a network partition, a system cannot guarantee both availability and atomic consistency; continuing to serve implies reconciliation of stale data afterward.",
    kind: "external",
    sources: ["src-gilbertlynch2002", "src-brewer2012"],
    appliesTo: ["engines/consistency.ts", "engines/intent-compiler.ts (contradiction check)"],
  },
  {
    id: "claim-dynamo-availability",
    statement: "A production system (Amazon Dynamo) deliberately chose availability over strong consistency for its shopping cart, reconciling conflicts after partitions.",
    kind: "external",
    sources: ["src-dynamo2007"],
    appliesTo: ["engines/cases.ts (availability case)", "engines/consistency.ts"],
  },
  {
    id: "claim-saga-compensation",
    statement: "A distributed transaction can be decomposed into subtransactions each paired with a compensation, so partial executions can be semantically undone in reverse order.",
    kind: "external",
    sources: ["src-sagas1987"],
    appliesTo: ["engines/saga.ts", "engines/ownership.ts (boundary audit)"],
    labDelta: "The saga engine also models compensation failure, which the original paper leaves to the application.",
  },
  {
    id: "claim-slo-error-budgets",
    statement: "Reliability work is steered by SLOs and the remaining error budget; when the budget is exhausted, reliability takes priority over new features.",
    kind: "external",
    sources: ["src-srebook"],
    appliesTo: ["engines/slo.ts", "engines/scenario.ts (expectations)"],
    labDelta: "The lab evaluates modeled outcomes against SLOs; it does not present them as production telemetry.",
  },
  {
    id: "claim-zero-trust",
    statement: "Trust must not be implied by network location: every crossing of a trust boundary needs explicit authentication/authorization decisions.",
    kind: "external",
    sources: ["src-nist-ztnull"],
    appliesTo: ["engines/trust.ts", "engines/authz.ts", "engines/critic.ts boundary checks"],
  },
  {
    id: "claim-access-control-rank",
    statement: "Broken access control is the top application-security risk class, ahead of injection.",
    kind: "external",
    sources: ["src-owasp-top10"],
    appliesTo: ["engines/authz.ts", "engines/tenantmatrix.ts", "engines/lineage.ts"],
  },
  {
    id: "claim-tenant-isolation-spectrum",
    statement: "Tenant isolation is an explicit design decision on a spectrum (pooled/bridged/siloed); any shared resource without a tenant-scope check is a cross-tenant leak risk.",
    kind: "external",
    sources: ["src-awssaas"],
    appliesTo: ["engines/tenant.ts", "engines/tenantmatrix.ts"],
  },
  {
    id: "claim-trace-model",
    statement: "A distributed trace is a tree of spans (parent-child, timing, status) correlated by propagated context ids across service boundaries.",
    kind: "external",
    sources: ["src-otel"],
    appliesTo: ["engines/trace.ts", "engines/flightrecorder.ts"],
  },
  {
    id: "claim-chaos-principles",
    statement: "Controlled fault injection with a hypothesis, a bounded blast radius, and abort conditions surfaces resilience weaknesses before real outages do.",
    kind: "external",
    sources: ["src-chaoseng2016"],
    appliesTo: ["engines/chaos.ts", "engines/orchestrator.ts", "engines/scenario.ts"],
  },
  {
    id: "claim-cache-staleness",
    statement: "Serving cached responses requires explicit freshness information; without it, caches must not reuse responses (the lab models this as TTL-based staleness vs read-after-write requirements).",
    kind: "external",
    sources: ["src-rfc9110"],
    appliesTo: ["engines/consistency.ts (cc-status TTL violation)"],
    labDelta: "HTTP semantics are the analog the lab borrows; database read-after-write has its own mechanisms the lab models separately.",
  },
  {
    id: "claim-429-throttling",
    statement: "HTTP 429 with Retry-After is the standard signal for client-side throttling of overloaded services.",
    kind: "external",
    sources: ["src-rfc6585"],
    appliesTo: ["src/trail topic 01 (rate limiting)", "engines/traffic.ts (shedding)"],
  },
  {
    id: "claim-data-minimisation",
    statement: "Shared artifacts should contain only data that is adequate, relevant, and limited to what is necessary (data minimisation), and be retained no longer than necessary.",
    kind: "external",
    sources: ["src-gdpr"],
    appliesTo: ["engines/dep.ts (redaction policy)", "engines/exchange.ts (retention)"],
    labDelta: "Engineering interpretation of Art. 5; not legal advice.",
  },
  // ---- internal claims: honestly labeled, never dressed as external ----
  {
    id: "claim-complexity-needs-requirement",
    statement: "A component that maps to no requirement, assumption, or documented purpose is unjustified complexity.",
    kind: "heuristic",
    sources: [],
    appliesTo: ["engines/critic.ts (complexity-without-requirement rule)"],
    labDelta: "Datanova design philosophy: complexity must be paid for by an explicit requirement. No external source is cited because this is a normative stance, not a measured fact.",
  },
  {
    id: "claim-queue-model-mms",
    statement: "Queue waiting time grows hyperbolically toward infinity as utilization approaches 1, and the lab approximates queueing with a deterministic formula.",
    kind: "simplification",
    sources: ["src-little1961"],
    appliesTo: ["engines/traffic.ts"],
    labDelta: "The lab uses a simplified deterministic approximation (not a full stochastic model) so results stay reproducible; Little's law is cited for the invariant, but the utilization curve is a first-order simplification.",
  },
  {
    id: "claim-genome-fingerprint",
    statement: "A compact trait fingerprint usefully summarizes architecture behavior for comparison.",
    kind: "assumption",
    sources: [],
    appliesTo: ["engines/genome.ts"],
    labDelta: "Internal modeling assumption: traits are chosen by Datanova, and the fingerprint is a comparison aid, not an architecture quality score.",
  },
  {
    id: "claim-causal-rules",
    statement: "The lab's causal propagation rules (e.g. 'database latency increases request duration') correctly describe modeled failure chains.",
    kind: "assumption",
    sources: ["src-awstimeouts", "src-tailatscale"],
    appliesTo: ["engines/causal.ts"],
    labDelta: "Rules are qualitative first-order relationships inspired by documented failure modes; magnitudes are lab-modeled assumptions, not measurements.",
  },
];

export function claimById(id: string): GroundedClaim | undefined {
  return CLAIMS.find((c) => c.id === id);
}

export interface ClaimProblem {
  claimId: string;
  problem: string;
}

/**
 * Claim-registry integrity:
 *  - `external` claims MUST cite >= 1 existing source (else they are falsely grounded),
 *  - internal claims (assumption/simplification/heuristic) must NOT be marked external,
 *  - all cited source ids must exist in the source registry,
 *  - the source registry itself must validate.
 */
export function validateClaimRegistry(claims: GroundedClaim[], sources: ExternalSource[]): ClaimProblem[] {
  const problems: ClaimProblem[] = [];
  for (const s of validateSourceRegistry(sources)) {
    problems.push({ claimId: "(registry)", problem: `source ${s.sourceId}: ${s.problem}` });
  }
  const ids = new Set(sources.map((s) => s.id));
  const seen = new Set<string>();
  for (const c of claims) {
    if (!c.id || seen.has(c.id)) problems.push({ claimId: c.id, problem: "duplicate or missing id" });
    seen.add(c.id);
    if (!c.statement || !c.appliesTo.length) problems.push({ claimId: c.id, problem: "missing statement or appliesTo" });
    for (const sid of c.sources) {
      if (!ids.has(sid)) problems.push({ claimId: c.id, problem: `dangling source reference ${sid}` });
    }
    if (c.kind === "external" && c.sources.length === 0) {
      problems.push({ claimId: c.id, problem: "marked external but cites no sources — falsely grounded" });
    }
    if (c.kind !== "external" && c.sources.length > 0 && !c.labDelta) {
      problems.push({ claimId: c.id, problem: "internal claim citing sources must state its labDelta (what goes beyond the source)" });
    }
  }
  return problems;
}

/** All registry invariants in one call — the regression gate for grounding. */
export function groundingIsIntact(): boolean {
  return validateClaimRegistry(CLAIMS, SOURCES).length === 0;
}
