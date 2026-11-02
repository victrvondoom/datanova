/**
 * Architecture review across ten categories. Every statement is derived from
 * what is actually in the diagram or the findings — no opaque score.
 */
import { Architecture, KIND_DEFS, bool, nodesOfKind, num, str } from "./model";
import { CapacityInputs, DEFAULT_CAPACITY, computeCapacity, fmtRatio, fromArchitecture } from "./capacity";
import { SURVIVED, runAllFailures } from "./failures";
import { Scenario } from "./scenarios";
import { evaluateRequirement } from "./requirements";
import { Finding, ReviewCategory, SEVERITY_LABEL, validateArchitecture } from "./validation";
import { Adr } from "./adr";
import { metricsOf } from "./compare";

export interface ReviewCategoryResult {
  id: ReviewCategory;
  label: string;
  evidence: string[];
  missing: string[];
  risks: string[];
  questions: string[];
  topics: number[];
  next: string;
}

export interface ReviewResult {
  generatedAt: string;
  categories: ReviewCategoryResult[];
  findingCount: number;
}

export const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  functional: "Functional completeness", reliability: "Reliability", scalability: "Scalability", consistency: "Data consistency",
  security: "Security", recovery: "Failure recovery", observability: "Observability", complexity: "Operational complexity",
  cost: "Cost assumptions", maintainability: "Maintainability",
};

const uniq = (xs: number[]): number[] => [...new Set(xs)].sort((a, b) => a - b);

export function reviewArchitecture(a: Architecture, scenario: Scenario, adrs: Adr[], now: string, capBase: CapacityInputs = scenario.capacity ?? DEFAULT_CAPACITY): ReviewResult {
  const findings = validateArchitecture(a, scenario);
  const cap = fromArchitecture(a, capBase);
  const capacity = computeCapacity(cap);
  const failures = runAllFailures(a, cap);
  const m = metricsOf(a);
  const evals = scenario.requirements.map((r) => ({ r, e: evaluateRequirement(a, r, { linkedAdrCount: adrs.filter((d) => d.relatedRequirementIds.includes(r.id)).length }) }));
  const fOf = (cat: ReviewCategory): Finding[] => findings.filter((f) => f.category === cat);
  const out: ReviewCategoryResult[] = [];
  const add = (id: ReviewCategory, evidence: string[], missing: string[], questions: string[], topics: number[], next: string, extraRisks: string[] = []): void => {
    const fs = fOf(id).filter((f) => f.severity !== "info" || id === "complexity" || id === "maintainability" || id === "observability");
    out.push({
      id, label: CATEGORY_LABEL[id], evidence: evidence.length ? evidence : ["Nothing in the architecture addresses this yet."],
      missing, risks: [...fs.map((f) => `${SEVERITY_LABEL[f.severity]}: ${f.detected}`), ...extraRisks],
      questions, topics: uniq([...topics, ...fs.flatMap((f) => f.topics)]), next,
    });
  };

  // functional
  const ev = evals.filter((x) => x.e.status === "evidenced");
  const nev = evals.filter((x) => x.e.status !== "evidenced");
  add("functional",
    ev.map((x) => `Evidence for: ${x.r.text}`),
    nev.map((x) => `${x.r.text} — missing: ${x.e.needs.filter((n) => !n.met).map((n) => n.text).join("; ")}`),
    ["Which requirement is hardest to prove from the diagram alone?", "Which unmet requirement would users notice first?"],
    ev.concat(nev).flatMap((x) => x.r.topics),
    nev.length ? `Start with: ${nev[0].r.text}` : "Validate each evidenced requirement with the Failure Injection Lab.");

  // reliability
  const rel: string[] = [];
  if (nodesOfKind(a, "timeout").length || nodesOfKind(a, "app_service", "web_app", "worker").some((n) => num(n, "requestTimeoutMs") > 0)) rel.push("Timeouts are configured on at least one caller.");
  if (nodesOfKind(a, "retry_policy").length) rel.push(`${nodesOfKind(a, "retry_policy").length} retry policy(ies) defined.`);
  if (nodesOfKind(a, "circuit_breaker").length) rel.push("Circuit breaker present.");
  if (nodesOfKind(a, "health_check").length) rel.push("Health check present.");
  if (m.appInstances > 1) rel.push(`${m.appInstances} application instances (no single instance is a single point of failure).`);
  const survived = failures.filter((r) => r.applicable && SURVIVED.includes(r.outcome)).length;
  const applicable = failures.filter((r) => r.applicable).length;
  rel.push(`Failure Lab model: ${survived}/${applicable} applicable failures survived.`);
  add("reliability", rel,
    [!nodesOfKind(a, "circuit_breaker").length && "No circuit breaker for dependencies", !nodesOfKind(a, "health_check").length && "No health checks"].filter((x): x is string => !!x),
    ["What happens to a user request if each dependency is down for a minute?", "Which call has no timeout?"], [10, 11, 12, 13, 3], "Run the Failure Injection Lab against the dependency with the most callers.");

  // scalability
  const sc: string[] = [];
  if (m.appInstances > 1) sc.push(`${m.appInstances} application instances.`);
  if (nodesOfKind(a, "load_balancer", "api_gateway").length) sc.push("Traffic distributor present.");
  if (nodesOfKind(a, "redis_cache").length) sc.push("Cache absorbs read load.");
  if (nodesOfKind(a, "queue").length) sc.push("Queue absorbs bursts of background work.");
  sc.push(`Capacity model at assumed peak ${cap.peakRps} req/s: ${fmtRatio(capacity.peak.utilization)} request utilization, ${fmtRatio(capacity.peak.dbUtilization)} database.`);
  add("scalability", sc,
    capacity.bottlenecks.map((b) => `Possible bottleneck: ${b.component} at ${fmtRatio(b.utilization)}`),
    ["What is the per-instance capacity, measured?", "What happens at 10× the assumed peak?"], [3, 2, 15, 1],
    "Replace the capacity assumptions with measurements from a real load test.", capacity.warnings);

  // consistency
  const co: string[] = [];
  if (nodesOfKind(a, "idempotency_store").length) co.push("Idempotency Store present.");
  if (nodesOfKind(a, "saga", "tx_coordinator").length) co.push("Cross-service workflow coordinated (saga/2PC).");
  nodesOfKind(a, "postgres").forEach((d) => str(d, "dataOwner") && co.push(`“${d.name}” has an owner: ${str(d, "dataOwner")}.`));
  add("consistency", co,
    [!nodesOfKind(a, "idempotency_store").length && "No idempotency protection anywhere"].filter((x): x is string => !!x),
    ["Which operations must never run twice?", "Which data may be stale, and for how long?"], [14, 18, 19, 2], "Write an ADR for the consistency model of your most important write.");

  // security
  const se: string[] = [];
  if (nodesOfKind(a, "auth_service").length || nodesOfKind(a, "api_gateway").some((g) => bool(g, "validatesAuth"))) se.push("Authentication present.");
  if (nodesOfKind(a, "rate_limiter").length || nodesOfKind(a, "api_gateway").some((g) => bool(g, "builtInRateLimit"))) se.push("Abuse protection (rate limiting) present.");
  if (nodesOfKind(a, "object_storage").every((o) => str(o, "visibility") === "private") && nodesOfKind(a, "object_storage").length) se.push("Object storage is private.");
  add("security", se, [!se.length && "No authentication or rate limiting visible"].filter((x): x is string => !!x),
    ["Who can call each entry point?", "Is any cached data user-specific?"], [5, 1, 4], "Trace one request from the client and name where identity is verified.");

  // recovery
  const rc: string[] = [];
  if (nodesOfKind(a, "queue").some((q) => bool(q, "durable") && num(q, "visibilityTimeoutSec") > 0)) rc.push("Durable queue with redelivery.");
  if (nodesOfKind(a, "dlq").length) rc.push("Dead Letter Queue present.");
  if (nodesOfKind(a, "postgres").some((d) => str(d, "backup") !== "none")) rc.push("Database backup assumption stated.");
  const dataRisk = failures.filter((r) => r.outcome === "data_risk");
  add("recovery", rc, dataRisk.map((r) => `Data at risk in: ${r.failureId}`), ["After a crash, which work is replayed and which is lost?", "Who looks at the DLQ?"], [15, 19, 14],
    dataRisk.length ? "Fix the data-at-risk failures first (Failure Lab)." : "Rehearse restore: run each failure, then use Recover.");

  // observability
  const ob: string[] = [];
  const svcs = nodesOfKind(a, "app_service", "web_app", "worker", "auth_service");
  const observed = svcs.filter((s) => str(s, "observability") !== "none" && str(s, "observability") !== "");
  if (observed.length) ob.push(`${observed.length}/${svcs.length} services emit logs/metrics.`);
  if (nodesOfKind(a, "dlq").some((d) => bool(d, "alerting"))) ob.push("DLQ alerting enabled.");
  if (nodesOfKind(a, "health_check").length) ob.push("Health checks give liveness signals.");
  add("observability", ob, svcs.length > observed.length ? [`${svcs.length - observed.length} service(s) emit nothing`] : [], ["How will you know a protection (breaker, retry, DLQ) activated?", "What is the first metric you would look at in an incident?"], [17], "Add metrics for queue depth and error rate to the most critical service.");

  // complexity
  add("complexity",
    [`${m.components} components, ${m.connections} connections, ${m.statefulComponents} stateful.`],
    findings.filter((f) => f.ruleId === "unnecessary-infrastructure").map((f) => f.detected),
    ["Which component could you remove without breaking a stated requirement?", "Who is on call for each stateful component?"], [8, 3], "For each heavy component, write the requirement it serves in its ‘Why is this here?’ field.");

  // cost
  add("cost",
    [`${m.costUnits} illustrative relative cost units (components × instances).`, ...(scenario.budget.length ? scenario.budget : [])],
    ["Real prices are not modelled."], ["What is the largest recurring cost, and what drives it?", "What does a retry storm cost?"], [15, 12],
    "Pick the most expensive component and ask: what is the cheapest design that still meets its requirement?");

  // maintainability
  const named = a.nodes.filter((n) => !new RegExp(`^${KIND_DEFS[n.kind].label}( \\d+)?$`).test(n.name)).length;
  add("maintainability",
    [`${named}/${a.nodes.length} components have descriptive names.`, adrs.length ? `${adrs.length} ADR(s) recorded.` : ""].filter(Boolean),
    [adrs.length === 0 ? "No decisions recorded" : "", a.nodes.some((n) => n.group) ? "" : "No component groups to show boundaries"].filter(Boolean),
    ["Could a new teammate explain this diagram after ten minutes?", "Which decision would they most likely question?"], [], "Record an ADR for the decision you are least sure about.");

  return { generatedAt: now, categories: out, findingCount: findings.length };
}
