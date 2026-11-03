/**
 * Campaign 05, Task 09 — Real-world architecture case library.
 *
 * Grounded cases built from the source registry. Each case separates:
 *  - `facts`: statements taken FROM the source (with the source id),
 *  - `adaptations`: Datanova-created scenario assumptions layered on top,
 * so nothing is presented as source fact that is actually our invention.
 * Validation refuses the `externally-grounded` label without facts that
 * reference existing sources.
 */

import { SOURCES } from "./sources";

export type CaseDimension =
  | "availability" | "overload" | "consistency" | "failure-propagation"
  | "tenant-isolation" | "security" | "recovery" | "latency" | "workflows";

export interface GroundedCase {
  id: string;
  title: string;
  dimension: CaseDimension;
  /** statements supported by the referenced sources */
  facts: { text: string; sourceId: string }[];
  /** Datanova-created scenario assumptions (NEVER presented as source facts) */
  adaptations: string[];
  /** what a reviewer should discuss when studying this case */
  discussionPoints: string[];
  /** which lab engines demonstrate the modeled counterpart */
  modeledBy: string[];
}

export const CASES: GroundedCase[] = [
  {
    id: "case-dynamo-cart",
    title: "Shopping cart availability over consistency (Amazon Dynamo)",
    dimension: "consistency",
    facts: [
      { text: "Amazon's shopping cart service required extreme availability and chose to keep serving during failures, accepting inconsistency.", sourceId: "src-dynamo2007" },
      { text: "Conflicting concurrent writes are detected with vector clocks and reconciled afterward.", sourceId: "src-dynamo2007" },
      { text: "A partition forces a choice between availability and atomic consistency.", sourceId: "src-gilbertlynch2002" },
    ],
    adaptations: [
      "Datanova models a simplified two-writer cart with last-write-wins reconciliation as a deterministic scenario; Dynamo's actual sloppy quorum mechanics are out of scope.",
    ],
    discussionPoints: [
      "When is stale-but-available cart data acceptable to the business?",
      "How does reconciliation complexity compare to simply queuing writes during a partition?",
      "What does the client see when a write is accepted during a partition?",
    ],
    modeledBy: ["engines/consistency.ts (cc-analytics satisfied vs cc-status violated)", "engines/intent-compiler.ts (contradiction check)"],
  },
  {
    id: "case-retry-storm",
    title: "Retry storms amplifying an overload (AWS Builders' Library)",
    dimension: "overload",
    facts: [
      { text: "Aggressive retry loops without limits or jitter multiply load and worsen the very failure being retried.", sourceId: "src-awstimeouts" },
      { text: "Bounded exponential backoff with jitter is the recommended client-side behavior.", sourceId: "src-awstimeouts" },
      { text: "HTTP 429 with Retry-After is the standard throttling response signal.", sourceId: "src-rfc6585" },
    ],
    adaptations: [
      "Datanova models a deterministic retry multiplier: a caller with retryMax=3 under sustained failure can generate up to 4x the offered load on the failing dependency.",
    ],
    discussionPoints: [
      "Where does the retry budget belong — client, gateway, or both?",
      "What breaks first when every caller retries at once: the target, the network, or the caller's own thread pool?",
      "When should a retry become a dead letter instead of a retry?",
    ],
    modeledBy: ["engines/causal.ts (retry-driven propagation)", "engines/traffic.ts (saturation)", "engines/critic.ts (unidempotent-mutations)"],
  },
  {
    id: "case-tail-latency",
    title: "One slow dependency dominating fanout latency (The Tail at Scale)",
    dimension: "latency",
    facts: [
      { text: "In a high-fanout service, the user-visible latency percentile is dominated by the slowest backend's tail.", sourceId: "src-tailatscale" },
      { text: "A single slow dependency worsens as parallelism grows; hedged requests and careful timeouts are standard mitigations.", sourceId: "src-tailatscale" },
    ],
    adaptations: [
      "Datanova models per-hop deterministic latency (latencyMs) with max-composition across parallel hops; real systems exhibit full percentile distributions the lab does not model.",
    ],
    discussionPoints: [
      "Which latency budget stage deserves the next engineering hour?",
      "How do timeouts convert a slow dependency into a fast partial failure?",
      "What user experience results from hedged requests doubling background load?",
    ],
    modeledBy: ["engines/latency.ts", "engines/sensitivity.ts (deadline sweeps)"],
  },
  {
    id: "case-saga-compensation",
    title: "Distributed transactions via compensations (Sagas, SIGMOD 1987)",
    dimension: "workflows",
    facts: [
      { text: "A saga decomposes a long transaction into subtransactions T1..Tn each paired with a compensation C1..Cn.", sourceId: "src-sagas1987" },
      { text: "Partial executions are undone by running the compensations of completed subtransactions in reverse order.", sourceId: "src-sagas1987" },
    ],
    adaptations: [
      "Datanova additionally models compensation failure and repeated events, which the original paper leaves to the application; the saga verifier validates compensation completeness for every forward path.",
    ],
    discussionPoints: [
      "Which operations have no meaningful compensation (e.g. sending an email)?",
      "When is a saga preferable to outbox-style eventual consistency?",
      "What must the operator do when a compensation itself fails?",
    ],
    modeledBy: ["engines/saga.ts", "engines/ownership.ts"],
  },
  {
    id: "case-tenant-leak",
    title: "Tenant isolation as an explicit design decision (AWS SaaS Lens)",
    dimension: "tenant-isolation",
    facts: [
      { text: "Tenant isolation exists on a spectrum: siloed, bridged, and pooled models with different cost and isolation properties.", sourceId: "src-awssaas" },
      { text: "Every shared resource must enforce tenant-scoping as an explicit design decision.", sourceId: "src-awssaas" },
      { text: "Broken access control is the top application-security risk class.", sourceId: "src-owasp-top10" },
    ],
    adaptations: [
      "Datanova generates an executable same-tenant/cross-tenant matrix from modeled data holders; a real leak additionally requires deployment and data-layer scoping the lab does not model.",
    ],
    discussionPoints: [
      "Which resources justify siloed isolation despite the cost?",
      "Where do tenant ids need to appear: query, row policy, or storage partition?",
      "How would you test for cross-tenant leakage before a customer does?",
    ],
    modeledBy: ["engines/tenant.ts", "engines/tenantmatrix.ts", "engines/authz.ts"],
  },
  {
    id: "case-zero-trust-crossing",
    title: "Distrusting network location (NIST SP 800-207)",
    dimension: "security",
    facts: [
      { text: "Zero trust grants no implicit trust from network location; authentication and authorization are explicit per resource.", sourceId: "src-nist-ztnull" },
      { text: "Trust-boundary crossings are explicit, audited decision points requiring the strongest available authentication for the context.", sourceId: "src-nist-ztnull" },
    ],
    adaptations: [
      "Datanova models boundary controls as per-connection properties (authn/authz/encryption/validation/ratelimit) and flags crossings that lack the required controls; real deployments add session management, device posture, and credential hygiene the lab does not model.",
    ],
    discussionPoints: [
      "Which crossings carry regulated or high-value data?",
      "Is service-to-service traffic inside a VPC exempt from authentication? (Zero trust says no.)",
      "What does rate limiting protect that encryption cannot?",
    ],
    modeledBy: ["engines/trust.ts", "engines/adversarial.ts"],
  },
  {
    id: "case-chaos-blast-radius",
    title: "Controlled fault injection with bounded blast radius (IEEE Software 2016)",
    dimension: "recovery",
    facts: [
      { text: "Chaos engineering is deliberate, controlled fault injection against real systems to surface weaknesses early.", sourceId: "src-chaoseng2016" },
      { text: "Experiments must define a hypothesis, a blast radius, and abort conditions.", sourceId: "src-chaoseng2016" },
    ],
    adaptations: [
      "Datanova applies the same discipline to its deterministic simulation: every chaos experiment carries a hypothesis, target, expected impact, and stop conditions; injected faults produce recordings that recovery verdicts fold.",
    ],
    discussionPoints: [
      "What hypothesis justifies an experiment whose blast radius includes a production path?",
      "When does the abort condition fire — error rate, budget, or time?",
      "What is the difference between chaos engineering and vandalism? (A falsifiable hypothesis.)",
    ],
    modeledBy: ["engines/chaos.ts", "engines/orchestrator.ts", "engines/recovery.ts"],
  },
  {
    id: "case-slo-budget-policy",
    title: "Error budgets steering reliability work (Google SRE)",
    dimension: "availability",
    facts: [
      { text: "SLOs define a target from user-visible needs; the complement (1 - SLO) is the error budget.", sourceId: "src-srebook" },
      { text: "When the error budget is exhausted, reliability work takes priority over new features.", sourceId: "src-srebook" },
    ],
    adaptations: [
      "Datanova evaluates modeled event counts against declared SLO windows; production SLOs need real telemetry and burn-rate alerting the lab does not provide.",
    ],
    discussionPoints: [
      "Is a 99.9% SLO honest if the measurement window hides monthly outages?",
      "Which SLI actually reflects user pain?",
      "What happens culturally when the budget is spent?",
    ],
    modeledBy: ["engines/slo.ts", "engines/scenario.ts (expectation checks)"],
  },
];

export interface CaseProblem {
  caseId: string;
  problem: string;
}

/** A case may only count as externally grounded if every fact cites an existing source. */
export function validateCaseLibrary(cases: GroundedCase[]): CaseProblem[] {
  const problems: CaseProblem[] = [];
  const sourceIds = new Set(SOURCES.map((s) => s.id));
  const seen = new Set<string>();
  for (const c of cases) {
    if (!c.id || seen.has(c.id)) problems.push({ caseId: c.id, problem: "duplicate or missing id" });
    seen.add(c.id);
    if (c.facts.length === 0) problems.push({ caseId: c.id, problem: "grounded case with no facts" });
    for (const f of c.facts) {
      if (!sourceIds.has(f.sourceId)) problems.push({ caseId: c.id, problem: `fact cites unknown source ${f.sourceId}` });
      if (f.text.length < 10) problems.push({ caseId: c.id, problem: "fact text too short to be meaningful" });
    }
    if (c.facts.length > 0 && c.adaptations.length === 0) {
      problems.push({ caseId: c.id, problem: "case presents source facts without declaring its adaptations" });
    }
    if (c.discussionPoints.length === 0) problems.push({ caseId: c.id, problem: "no discussion points" });
  }
  return problems;
}
