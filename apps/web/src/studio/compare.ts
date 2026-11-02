/**
 * Architecture comparison. Explains trade-offs; never declares a winner.
 * Cost figures are ILLUSTRATIVE relative units (KIND_DEFS.costUnits × instances), not prices.
 */
import { Architecture, KIND_DEFS, Kind, STORE_KINDS, bool, num, str } from "./model";
import { CapacityInputs, DEFAULT_CAPACITY, computeCapacity, fmtRatio, fromArchitecture } from "./capacity";
import { FailureComparisonRow, SURVIVED, compareFailureRuns, runAllFailures } from "./failures";
import { Scenario } from "./scenarios";
import { RequirementEvaluation, evaluateRequirement } from "./requirements";
import { validateArchitecture, countBySeverity } from "./validation";

export interface Metrics {
  components: number;
  connections: number;
  distinctKinds: number;
  statefulComponents: number;
  asyncConnections: number;
  appInstances: number;
  workerInstances: number;
  costUnits: number;
}

export function metricsOf(a: Architecture): Metrics {
  const stateful = a.nodes.filter((n) => KIND_DEFS[n.kind].stateful).length;
  const inst = (k: Kind[]) => a.nodes.filter((n) => k.includes(n.kind)).reduce((s, n) => s + Math.max(1, num(n, "instances", 1)), 0);
  return {
    components: a.nodes.length,
    connections: a.connections.length,
    distinctKinds: new Set(a.nodes.map((n) => n.kind)).size,
    statefulComponents: stateful,
    asyncConnections: a.connections.filter((c) => c.type === "async" || c.type === "event").length,
    appInstances: inst(["app_service", "web_app", "auth_service"]),
    workerInstances: inst(["worker"]),
    costUnits: a.nodes.reduce((s, n) => s + KIND_DEFS[n.kind].costUnits * Math.max(1, num(n, "instances", 1)), 0),
  };
}

export interface CompareRow {
  dimension: string;
  a: string;
  b: string;
  note: string;
}

export interface ComparisonReport {
  rows: CompareRow[];
  metricsA: Metrics;
  metricsB: Metrics;
  requirements: Array<{ id: string; text: string; a: RequirementEvaluation["status"]; b: RequirementEvaluation["status"] }>;
  failures: FailureComparisonRow[];
  tradeoffs: string[];
  perspective: string[];
}

const TRADEOFF_NOTES: Partial<Record<Kind, string>> = {
  queue: "Queue: decouples slow work from the request and absorbs spikes — but results arrive later (eventual consistency) and you must handle redelivery.",
  worker: "Worker pool: scales background throughput independently — but is another thing to deploy, monitor and size.",
  dlq: "Dead Letter Queue: parks poison messages instead of looping — but someone must triage them.",
  idempotency_store: "Idempotency Store: makes retries safe — but adds a store on the critical path and key-retention rules.",
  api_gateway: "API Gateway: central auth/limits/routing — but a critical shared component and a potential bottleneck.",
  rate_limiter: "Rate limiter: bounds abusive load — but may reject legitimate bursts.",
  load_balancer: "Load balancer: spreads load and survives instance loss — but needs health checks and stateless services.",
  redis_cache: "Cache: removes read load from the database — but data can be stale and invalidation is hard.",
  pubsub: "Pub/Sub: isolates downstream consumers from the publisher — but adds asynchronous behavior to reason about.",
  event_bus: "Event bus: flexible fan-out of domain events — but harder to trace end-to-end.",
  saga: "Saga: recoverable multi-service workflows — but visible intermediate states and compensation code.",
  tx_coordinator: "Two-phase commit: atomic across participants — but blocking and a coordinator single point of failure.",
  circuit_breaker: "Circuit breaker: fails fast when a dependency is down — but needs a deliberate fallback.",
  retry_policy: "Retries: ride out transient failures — but add latency and can amplify load without backoff.",
  timeout: "Timeouts: bound waiting — but can abort legitimately slow work.",
  health_check: "Health checks: remove dead instances — but flapping checks cause churn.",
  cron_runner: "Scheduler: time-based work — but needs duplicate-run protection once there is more than one instance.",
  auth_service: "Auth service: central identity — but a critical dependency of every authenticated call.",
  cdn: "CDN: serves static content near users — but cache invalidation and cost.",
  reverse_proxy: "Reverse proxy: TLS and buffering — but one more hop.",
};

const kindCounts = (a: Architecture): Map<Kind, number> => {
  const m = new Map<Kind, number>();
  for (const n of a.nodes) m.set(n.kind, (m.get(n.kind) ?? 0) + 1);
  return m;
};

function userExperience(a: Architecture): string {
  const hasAsyncWork = a.nodes.some((n) => n.kind === "queue") && a.nodes.some((n) => n.kind === "worker");
  const syncExternal = a.connections.some((c) => c.type === "sync" && a.nodes.find((n) => n.id === c.to)?.kind === "external_service" && a.nodes.find((n) => n.id === c.from)?.kind !== "worker");
  if (syncExternal && !hasAsyncWork) return "Requests wait for external work (synchronous). A slow dependency is a slow page.";
  if (hasAsyncWork) return "Requests are accepted quickly; heavy work finishes later, so the UI needs status/notification handling.";
  return "Requests are answered directly by the service tier.";
}

function consistencyOf(a: Architecture): string {
  const eventual = a.nodes.some((n) => ["queue", "pubsub", "event_bus", "saga"].includes(n.kind));
  const idem = a.nodes.some((n) => n.kind === "idempotency_store");
  const tx = a.nodes.some((n) => n.kind === "tx_coordinator");
  return [eventual ? "Eventual across async boundaries" : "Immediate within the request", idem ? "retries made safe by idempotency keys" : "retries/duplicates not guarded", tx ? "atomic steps via 2PC (blocking)" : ""].filter(Boolean).join("; ") + ".";
}

function recoveryOf(a: Architecture): string {
  const bits: string[] = [];
  if (a.nodes.some((n) => n.kind === "queue" && bool(n, "durable") && num(n, "visibilityTimeoutSec") > 0)) bits.push("durable queue with redelivery");
  if (a.nodes.some((n) => n.kind === "dlq")) bits.push("DLQ for poison jobs");
  if (a.nodes.some((n) => n.kind === "health_check")) bits.push("health checks");
  if (a.nodes.some((n) => n.kind === "postgres" && str(n, "backup") !== "none")) bits.push("database backups");
  if (a.nodes.some((n) => (n.kind === "pubsub" || n.kind === "event_bus") && num(n, "retentionHours") > 0)) bits.push("event retention/replay");
  return bits.length ? bits.join(", ") + "." : "No automated recovery mechanism modelled; restoring a failed part is manual and in-flight work is lost.";
}

export function compareArchitectures(a: Architecture, b: Architecture, scenario: Scenario, capBase: CapacityInputs = scenario.capacity ?? DEFAULT_CAPACITY): ComparisonReport {
  const ma = metricsOf(a);
  const mb = metricsOf(b);
  const capA = fromArchitecture(a, capBase);
  const capB = fromArchitecture(b, capBase);
  const ra = computeCapacity(capA);
  const rb = computeCapacity(capB);
  const failsA = runAllFailures(a, capA);
  const failsB = runAllFailures(b, capB);
  const survived = (rs: typeof failsA) => `${rs.filter((r) => r.applicable && SURVIVED.includes(r.outcome)).length}/${rs.filter((r) => r.applicable).length} applicable failures survived; ${rs.filter((r) => r.outcome === "data_risk").length} with data at risk`;
  const fa = countBySeverity(validateArchitecture(a, scenario));
  const fb = countBySeverity(validateArchitecture(b, scenario));
  const reqs = scenario.requirements.map((r) => ({
    id: r.id, text: r.text,
    a: evaluateRequirement(a, r, { linkedAdrCount: 0 }).status,
    b: evaluateRequirement(b, r, { linkedAdrCount: 0 }).status,
  }));
  const evA = reqs.filter((r) => r.a === "evidenced").length;
  const evB = reqs.filter((r) => r.b === "evidenced").length;
  const u = (r: ReturnType<typeof computeCapacity>) => `peak requests ${fmtRatio(r.peak.utilization)} of capacity; DB ${fmtRatio(r.peak.dbUtilization)}; workers at peak ${fmtRatio(r.queue.workerUtilizationPeak)}`;

  const rows: CompareRow[] = [
    { dimension: "Complexity", a: `${ma.components} components, ${ma.connections} connections, ${ma.distinctKinds} kinds`, b: `${mb.components} components, ${mb.connections} connections, ${mb.distinctKinds} kinds`, note: "Counts, not a quality score: more parts means more to understand, not a better design." },
    { dimension: "Operational overhead", a: `${ma.statefulComponents} stateful components; ${ma.appInstances} app + ${ma.workerInstances} worker instances`, b: `${mb.statefulComponents} stateful components; ${mb.appInstances} app + ${mb.workerInstances} worker instances`, note: "Every stateful component needs backup, monitoring and capacity planning." },
    { dimension: "Failure behavior", a: survived(failsA), b: survived(failsB), note: "From the Failure Injection Lab model on each architecture (not real fault injection)." },
    { dimension: "User experience", a: userExperience(a), b: userExperience(b), note: "Synchronous is simpler to explain; asynchronous is more resilient but needs status UX." },
    { dimension: "Consistency", a: consistencyOf(a), b: consistencyOf(b), note: "Stronger guarantees usually cost latency or availability." },
    { dimension: "Approx. resource utilization", a: u(ra), b: u(rb), note: "Educational capacity model using the scenario’s assumed traffic; not a load test." },
    { dimension: "Recovery behavior", a: recoveryOf(a), b: recoveryOf(b), note: "What survives and what is lost when something fails." },
    { dimension: "Cost assumptions", a: `${ma.costUnits} relative units`, b: `${mb.costUnits} relative units`, note: "Illustrative relative units per component/instance; real prices depend on your provider and are not modelled." },
    { dimension: "Validation findings", a: `${fa.critical} critical, ${fa.high} high, ${fa.medium} medium, ${fa.info} info`, b: `${fb.critical} critical, ${fb.high} high, ${fb.medium} medium, ${fb.info} info`, note: "Findings are context-dependent warnings, not automatic defects." },
    { dimension: "Requirements with structural evidence", a: `${evA}/${reqs.length}`, b: `${evB}/${reqs.length}`, note: "Evidence in the diagram, not proof of correct implementation." },
  ];

  const ca = kindCounts(a);
  const cb = kindCounts(b);
  const tradeoffs: string[] = [];
  for (const [k, n] of cb) if ((ca.get(k) ?? 0) < n && TRADEOFF_NOTES[k]) tradeoffs.push(`Version B adds — ${TRADEOFF_NOTES[k]}`);
  for (const [k, n] of ca) if ((cb.get(k) ?? 0) < n && TRADEOFF_NOTES[k]) tradeoffs.push(`Version B drops — ${TRADEOFF_NOTES[k]} (Removing it saves operating cost but gives up that capability.)`);
  if (ma.appInstances !== mb.appInstances) tradeoffs.push(`Instance counts differ (${ma.appInstances} → ${mb.appInstances} app instances): more instances add headroom and failure tolerance, and also cost.`);

  const perspective: string[] = [];
  if (evA === reqs.length) perspective.push("Version A already has structural evidence for every scenario requirement; extra components in B need their own justification.");
  else if (evB > evA) perspective.push(`Version B gives structural evidence for ${evB - evA} more requirement(s) than A, at ${mb.costUnits - ma.costUnits >= 0 ? `+${mb.costUnits - ma.costUnits}` : mb.costUnits - ma.costUnits} relative cost units and ${mb.components - ma.components >= 0 ? `+${mb.components - ma.components}` : mb.components - ma.components} components.`);
  else perspective.push("B does not add evidence for more requirements than A; check whether its extra parts are justified.");
  perspective.push("A simpler architecture can be the right choice for a small MVP, a prototype, or low and predictable traffic: it is cheaper to build, run and understand. Choose the extra machinery only when a stated requirement (traffic spikes, failure tolerance, correctness) needs it.");
  if (STORE_KINDS.length && mb.statefulComponents > ma.statefulComponents) perspective.push(`B adds ${mb.statefulComponents - ma.statefulComponents} stateful component(s): budget operational time for them.`);

  return { rows, metricsA: ma, metricsB: mb, requirements: reqs, failures: compareFailureRuns(a, b, capBase), tradeoffs, perspective };
}
