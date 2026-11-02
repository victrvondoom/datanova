/**
 * Architecture validation. A finding is not automatically a defect: every
 * rule states its context-dependence. Rules inspect structure only — they
 * never assume one universally correct architecture.
 */
import {
  Architecture,
  ArchNode,
  KIND_DEFS,
  Kind,
  bool,
  incoming,
  num,
  nodesOfKind,
  outgoing,
  str,
} from "./model";
import {
  accessors,
  breakerFor,
  clients,
  consumersOf,
  cronProtectionEffective,
  dlqsOf,
  effectiveTimeoutMs,
  healthCheckFor,
  isPaymentLike,
  publishersOf,
  realtimeQueues,
  retryFor,
  subscribersOf,
  syncCallers,
} from "./graph";
import { Scenario } from "./scenarios";
import { kindsRequiredBy } from "./requirements";

export type Severity = "critical" | "high" | "medium" | "info";
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "info"];
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", info: "Informational" };

export type ReviewCategory =
  | "functional" | "reliability" | "scalability" | "consistency" | "security"
  | "recovery" | "observability" | "complexity" | "cost" | "maintainability";

export interface FixOption {
  fix: string;
  tradeoff: string;
}

export interface Finding {
  /** ruleId + affected nodes: stable identity for a specific problem */
  id: string;
  ruleId: string;
  severity: Severity;
  title: string;
  nodeIds: string[];
  /** 1. what was detected */
  detected: string;
  /** 2. why it may be a problem */
  why: string;
  /** 3. which requirement or risk it affects */
  affects: string;
  /** 4. which topics teach the concept */
  topics: number[];
  /** 5+6. ways to address it, each with its trade-off */
  options: FixOption[];
  /** when this is acceptable */
  contextNote: string;
  category: ReviewCategory;
}

interface Hit {
  nodeIds: string[];
  detected: string;
  severity?: Severity;
}

interface Rule {
  id: string;
  title: string;
  severity: Severity;
  category: ReviewCategory;
  why: string;
  affects: string;
  topics: number[];
  options: FixOption[];
  contextNote: string;
  check: (a: Architecture, s?: Scenario) => Hit[];
}

const byId = (a: Architecture, id: string): ArchNode | undefined => a.nodes.find((n) => n.id === id);
const name = (n: ArchNode): string => `“${n.name}”`;

const CALLERS: Kind[] = ["web_app", "app_service", "worker", "auth_service"];
const HEAVY: Kind[] = ["cdn", "load_balancer", "api_gateway", "queue", "pubsub", "event_bus", "redis_cache", "saga", "tx_coordinator"];

export const RULES: Rule[] = [
  {
    id: "exposed-direct", title: "Service reachable directly from clients", severity: "high", category: "security",
    why: "With no edge layer (proxy, gateway, load balancer) in front, the service itself must absorb abuse, terminate TLS and authenticate — and cannot be scaled or swapped transparently.",
    affects: "Security, abuse protection, and the ability to scale horizontally.", topics: [4, 5, 1],
    options: [
      { fix: "Put an API Gateway in front.", tradeoff: "Single entry point (auth, limits, routing) but one more component to run and a potential bottleneck." },
      { fix: "Put a Reverse Proxy / Load Balancer in front.", tradeoff: "TLS, buffering and distribution, but no request-level policy such as per-user limits." },
      { fix: "Accept direct exposure for a single-instance MVP.", tradeoff: "Simplest, but you carry the abuse and scaling risk in the app itself." },
    ],
    contextNote: "Direct exposure can be a reasonable choice for a small MVP with a managed platform edge you are not modelling here.",
    check: (a) => {
      const out: Hit[] = [];
      for (const c of clients(a))
        for (const e of outgoing(a, c.id, "sync")) {
          const t = byId(a, e.to);
          if (t && CALLERS.includes(t.kind)) out.push({ nodeIds: [c.id, t.id, e.id], detected: `${name(c)} calls ${name(t)} directly.` });
        }
      return out;
    },
  },
  {
    id: "missing-timeout-external", title: "No timeout on an external dependency", severity: "high", category: "reliability",
    why: "Without a timeout, one hung dependency holds a thread/connection per request until the caller is exhausted — the failure spreads upstream.",
    affects: "Availability of everything that shares the caller's connection/thread pool.", topics: [11, 10],
    options: [
      { fix: "Set a request timeout on the caller (e.g. 3–10 s).", tradeoff: "Bounded waiting, but a legitimately slow response is abandoned." },
      { fix: "Add a Timeout component targeting the dependency.", tradeoff: "Explicit and visible, but one more thing to keep consistent with real settings." },
      { fix: "Move the call behind a queue and worker.", tradeoff: "Requests no longer wait, but the result becomes asynchronous." },
    ],
    contextNote: "A tiny internal tool calling a very reliable dependency may tolerate this; an external API you do not control should not.",
    check: (a) => {
      const out: Hit[] = [];
      for (const e of nodesOfKind(a, "external_service"))
        for (const c of syncCallers(a, e))
          if (CALLERS.includes(c.kind) && effectiveTimeoutMs(a, c, e) <= 0)
            out.push({ nodeIds: [c.id, e.id], detected: `${name(c)} calls external ${name(e)} with no timeout (caller timeout is 0 and no Timeout component targets it).` });
      return out;
    },
  },
  {
    id: "missing-timeout-internal", title: "No timeout on an internal remote call", severity: "medium", category: "reliability",
    why: "Internal services also hang or slow down; an unbounded wait on them lets a slow service drag down its callers.",
    affects: "Latency and failure containment between services.", topics: [11],
    options: [
      { fix: "Set the caller's request timeout.", tradeoff: "Bounded waits; choose a value from observed latency, not a guess." },
      { fix: "Add a Timeout component for the callee.", tradeoff: "Explicit documentation of the bound; duplicates the setting if the caller also has one." },
    ],
    contextNote: "Within a single process or a trivially fast dependency this matters less.",
    check: (a) => {
      const out: Hit[] = [];
      for (const callee of nodesOfKind(a, "auth_service", "app_service"))
        for (const c of syncCallers(a, callee))
          if (CALLERS.includes(c.kind) && effectiveTimeoutMs(a, c, callee) <= 0)
            out.push({ nodeIds: [c.id, callee.id], detected: `${name(c)} calls ${name(callee)} with no timeout.` });
      return out;
    },
  },
  {
    id: "retry-unbounded", title: "Retry policy without a maximum attempt count", severity: "high", category: "reliability",
    why: "Unbounded retries turn a brief outage into a permanent load multiplier and keep failing work alive forever.",
    affects: "Dependency recovery, cost, and queue/thread exhaustion.", topics: [12, 13],
    options: [
      { fix: "Set a small max attempts (e.g. 3–5).", tradeoff: "Bounded load; after the limit the failure must be surfaced or parked in a DLQ." },
      { fix: "Pair retries with a circuit breaker.", tradeoff: "Stops retrying a dependency that is clearly down; adds breaker state to tune." },
    ],
    contextNote: "Never acceptable for synchronous user requests; background consumers still need a bound plus a DLQ.",
    check: (a) =>
      nodesOfKind(a, "retry_policy")
        .filter((n) => num(n, "maxAttempts") === 0)
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} has maxAttempts = 0 (unbounded).` })),
  },
  {
    id: "retry-too-many", title: "Very high retry count", severity: "medium", category: "reliability",
    why: "More than ~10 attempts rarely helps a transient failure and multiplies load during an incident.",
    affects: "Dependency load during incidents.", topics: [12],
    options: [{ fix: "Lower max attempts.", tradeoff: "Gives up sooner; persistent failures surface faster." }],
    contextNote: "Long retry horizons can be fine for non-urgent background jobs if spaced with backoff.",
    check: (a) => nodesOfKind(a, "retry_policy").filter((n) => num(n, "maxAttempts") > 10).map((n) => ({ nodeIds: [n.id], detected: `${name(n)} allows ${num(n, "maxAttempts")} attempts.` })),
  },
  {
    id: "retry-no-backoff", title: "Retries without backoff", severity: "high", category: "reliability",
    why: "Immediate retries hit an already-overloaded dependency at full speed (a retry storm) and make recovery harder.",
    affects: "Recovery of overloaded dependencies.", topics: [13, 12],
    options: [
      { fix: "Use exponential backoff.", tradeoff: "Gives the dependency room to recover; slower to succeed after a blip." },
      { fix: "Use exponential backoff with jitter.", tradeoff: "Also de-synchronises many clients; harder to predict exact timing." },
    ],
    contextNote: "For a dependency that fails only by rare isolated errors, a single immediate retry may be acceptable.",
    check: (a) =>
      nodesOfKind(a, "retry_policy")
        .filter((n) => num(n, "maxAttempts") !== 1 && str(n, "backoff") === "none")
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} retries with no backoff.` })),
  },
  {
    id: "retry-fixed-backoff", title: "Fixed-interval retries", severity: "medium", category: "reliability",
    why: "Fixed intervals keep every client retrying in lock-step, which re-creates the spike each cycle.",
    affects: "Recovery of overloaded dependencies.", topics: [13],
    options: [{ fix: "Switch to exponential backoff with jitter.", tradeoff: "More moving parts to reason about; much smoother load." }],
    contextNote: "Fine for a single client against a rate-limited API with a known interval.",
    check: (a) =>
      nodesOfKind(a, "retry_policy")
        .filter((n) => num(n, "maxAttempts") !== 1 && str(n, "backoff") === "fixed")
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} uses a fixed retry interval.` })),
  },
  {
    id: "payment-no-idempotency", title: "Payment-like operation without idempotency protection", severity: "critical", category: "consistency",
    why: "Retries (client, queue redelivery, timeouts that actually succeeded) will repeat the charge/side effect.",
    affects: "Duplicate charges or duplicate billing — direct financial harm.", topics: [14, 12, 15],
    options: [
      { fix: "Add an Idempotency Store with atomic claim and connect it.", tradeoff: "Safe retries, but adds a store on the critical path and key-retention rules." },
      { fix: "Rely on the provider's own idempotency keys.", tradeoff: "Less to build, but you depend on provider behavior and cannot dedupe your own side effects." },
    ],
    contextNote: "Only applies to operations flagged payment-like (property or name). If the operation is naturally idempotent (e.g. PUT of a value) this is a false positive — say so in an ADR.",
    check: (a) =>
      a.nodes
        .filter((n) => isPaymentLike(n) && !outgoing(a, n.id, "data").some((c) => byId(a, c.to)?.kind === "idempotency_store"))
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} looks payment-like but has no data access to an Idempotency Store.` })),
  },
  {
    id: "idempotency-not-atomic", title: "Idempotency store without atomic claim", severity: "high", category: "consistency",
    why: "Check-then-write is a race: two concurrent identical requests can both pass the check.",
    affects: "Duplicate execution under concurrency.", topics: [14],
    options: [{ fix: "Enable atomic claim (set-if-absent / unique constraint).", tradeoff: "A slightly stricter store requirement; removes the race." }],
    contextNote: "Low-concurrency internal tools may accept the race.",
    check: (a) => nodesOfKind(a, "idempotency_store").filter((n) => !bool(n, "atomicClaim")).map((n) => ({ nodeIds: [n.id], detected: `${name(n)} does not claim keys atomically.` })),
  },
  {
    id: "queue-no-consumer", title: "Queue with no consumer", severity: "high", category: "functional",
    why: "Messages are accepted and never processed; the backlog only grows and users wait forever.",
    affects: "Any feature that depends on the queued work.", topics: [15],
    options: [
      { fix: "Connect the queue to a Background Worker (async message).", tradeoff: "Work gets done; you now operate and scale workers." },
      { fix: "Remove the queue and process synchronously.", tradeoff: "Simpler, but the request waits for the work." },
    ],
    contextNote: "None — a queue nobody reads is unfinished.",
    check: (a) => nodesOfKind(a, "queue").filter((q) => consumersOf(a, q.id).length === 0).map((q) => ({ nodeIds: [q.id], detected: `${name(q)} has no consumer.` })),
  },
  {
    id: "queue-no-failure-path", title: "Queue with no failure-handling path", severity: "medium", category: "recovery",
    why: "A message that always fails is either retried forever or silently dropped; neither is visible or recoverable.",
    affects: "Recovery from poison messages and operational visibility.", topics: [15],
    options: [
      { fix: "Attach a Dead Letter Queue and set deadLetterPolicy = dlq.", tradeoff: "Poison messages are parked and inspectable; someone must triage them." },
      { fix: "Accept drops and log them.", tradeoff: "Simplest; only valid when losing the message is harmless." },
    ],
    contextNote: "Reasonable for best-effort, loss-tolerant messages.",
    check: (a) => {
      const out: Hit[] = [];
      for (const q of nodesOfKind(a, "queue")) {
        const wired = dlqsOf(a, q.id).length > 0;
        const declared = str(q, "deadLetterPolicy") === "dlq";
        if (!wired && !declared) out.push({ nodeIds: [q.id], detected: `${name(q)} has no DLQ and no dead-letter policy.` });
        else if (declared && !wired) out.push({ nodeIds: [q.id], detected: `${name(q)} declares a DLQ policy but no Dead Letter Queue is connected.` });
        else if (wired && !declared) out.push({ nodeIds: [q.id], detected: `${name(q)} is wired to a DLQ but its dead-letter policy is 'none'.`, severity: "info" });
      }
      return out;
    },
  },
  {
    id: "queue-unbounded-delivery", title: "Queue redelivers without a limit", severity: "high", category: "recovery",
    why: "A poison message is redelivered forever, burning worker capacity and blocking healthy work.",
    affects: "Worker capacity and queue health.", topics: [15, 12],
    options: [{ fix: "Set a delivery-attempt limit (e.g. 5) and route to a DLQ.", tradeoff: "Bounded waste; requires a DLQ process." }],
    contextNote: "Only safe if something else removes poison messages.",
    check: (a) => nodesOfKind(a, "queue").filter((q) => num(q, "retryLimit") === 0).map((q) => ({ nodeIds: [q.id], detected: `${name(q)} has an unlimited delivery-attempt count.` })),
  },
  {
    id: "queue-not-durable", title: "Queue does not persist messages", severity: "medium", category: "recovery",
    why: "A broker restart loses every queued message.", affects: "Job loss after a crash.", topics: [15],
    options: [{ fix: "Enable persistence.", tradeoff: "Slightly higher latency and storage cost." }],
    contextNote: "OK for ephemeral, re-creatable work.",
    check: (a) => nodesOfKind(a, "queue").filter((q) => !bool(q, "durable")).map((q) => ({ nodeIds: [q.id], detected: `${name(q)} is not durable.` })),
  },
  {
    id: "worker-not-idempotent", title: "Queue consumer may repeat side effects", severity: "medium", category: "consistency",
    why: "Queues deliver at-least-once; a redelivered message is processed twice unless the handler is safe to repeat.",
    affects: "Duplicate emails, charges, or records.", topics: [14, 15],
    options: [
      { fix: "Mark/make the handler idempotent.", tradeoff: "Requires deliberate design of each handler." },
      { fix: "Record processed message ids in an Idempotency Store.", tradeoff: "General solution; adds a store lookup per message." },
    ],
    contextNote: "If the work is naturally repeatable (e.g. overwrite a file), the handler may already be safe.",
    check: (a) => {
      const out: Hit[] = [];
      for (const w of nodesOfKind(a, "worker")) {
        const fromQueue = incoming(a, w.id, "async").some((c) => byId(a, c.from)?.kind === "queue");
        if (fromQueue && !bool(w, "idempotentHandler") && !outgoing(a, w.id, "data").some((c) => byId(a, c.to)?.kind === "idempotency_store"))
          out.push({ nodeIds: [w.id], detected: `${name(w)} consumes a queue but is not idempotent and has no Idempotency Store.` });
      }
      return out;
    },
  },
  {
    id: "dlq-unwatched", title: "Dead Letter Queue nobody watches", severity: "medium", category: "recovery",
    why: "A DLQ without alerts or a redrive path is a graveyard: failures pile up unnoticed.",
    affects: "Visibility of permanently failing work.", topics: [15],
    options: [{ fix: "Enable alerting on non-empty.", tradeoff: "Someone is paged; you need a triage routine." }, { fix: "Add a worker/service that reviews or redrives it.", tradeoff: "More code for a rare path." }],
    contextNote: "During early prototyping a manual look is enough.",
    check: (a) => nodesOfKind(a, "dlq").filter((d) => !bool(d, "alerting") && outgoing(a, d.id).length === 0).map((d) => ({ nodeIds: [d.id], detected: `${name(d)} has no alert and no redrive consumer.` })),
  },
  {
    id: "cache-no-expiry", title: "Cache without expiration or invalidation", severity: "high", category: "consistency",
    why: "Entries live forever and are never refreshed, so users see stale data indefinitely and memory fills.",
    affects: "Data freshness and memory growth.", topics: [2],
    options: [
      { fix: "Set a TTL.", tradeoff: "Simple and bounded staleness; extra misses after expiry." },
      { fix: "Invalidate on write or by event.", tradeoff: "Fresher data; invalidation bugs cause stale reads and the write path gets more complex." },
    ],
    contextNote: "Immutable data (content-addressed assets) legitimately never expires.",
    check: (a) =>
      nodesOfKind(a, "redis_cache")
        .filter((n) => num(n, "ttlSeconds") <= 0 && str(n, "invalidation") === "none")
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} has TTL 0 and invalidation 'none'.` })),
  },
  {
    id: "cache-sensitive-key", title: "Sensitive cached data without a per-user key", severity: "high", category: "security",
    why: "A shared key for per-user data can serve one user's data to another.",
    affects: "Confidentiality.", topics: [2],
    options: [{ fix: "Include user/tenant id in the key pattern.", tradeoff: "Lower hit rate (less sharing); correct isolation." }, { fix: "Do not cache sensitive data.", tradeoff: "Every read hits the source." }],
    contextNote: "Sensitive but global data (e.g. a public price list marked sensitive in error) is a false positive — fix the label.",
    check: (a) =>
      nodesOfKind(a, "redis_cache")
        .filter((n) => str(n, "sensitivity") === "sensitive" && !/\{(user|tenant|account|customer)/i.test(str(n, "keyPattern")))
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} caches sensitive data with key pattern “${str(n, "keyPattern") || "(none)"}”.` })),
  },
  {
    id: "cron-duplicate", title: "Scheduled job may run more than once", severity: "high", category: "consistency",
    why: "With several instances (or overlapping deploys) every instance fires the schedule, so work is done N times.",
    affects: "Duplicate emails, charges or cleanups.", topics: [20, 14],
    options: [
      { fix: "Distributed lock held in a shared store.", tradeoff: "One runner wins; locks can expire mid-run." },
      { fix: "Leader election / lease.", tradeoff: "Clean single runner; needs failover handling." },
      { fix: "Make the job idempotent (Idempotency Store).", tradeoff: "Duplicates are harmless but still cost compute." },
    ],
    contextNote: "A single instance with duplicate protection 'none' has lower risk, but redeploy overlap and restarts can still double-run it.",
    check: (a) => {
      const out: Hit[] = [];
      for (const c of nodesOfKind(a, "cron_runner")) {
        const p = cronProtectionEffective(a, c);
        if (p.effective) continue;
        const multi = num(c, "instances", 1) > 1;
        out.push({ nodeIds: [c.id], detected: `${name(c)} (${num(c, "instances", 1)} instance${multi ? "s" : ""}): ${p.reason}`, severity: multi ? "high" : "medium" });
      }
      return out;
    },
  },
  {
    id: "critical-dependency-unhandled", title: "Critical dependency with no failure-handling strategy", severity: "high", category: "reliability",
    why: "If it fails, nothing retries, short-circuits, buffers or degrades — the failure goes straight to the user.",
    affects: "Availability of the feature (and possibly the whole request path).", topics: [10, 12, 13, 15],
    options: [
      { fix: "Circuit breaker with a fallback.", tradeoff: "Fails fast and degrades gracefully; fallback behavior must be designed." },
      { fix: "Bounded retry with backoff.", tradeoff: "Handles transient errors; does nothing for long outages." },
      { fix: "Buffer the work through a queue.", tradeoff: "Absorbs outages; results arrive later." },
    ],
    contextNote: "If the dependency is optional or its failure is acceptable to users, mark it 'optional'.",
    check: (a) => {
      const out: Hit[] = [];
      for (const e of nodesOfKind(a, "external_service")) {
        if (str(e, "criticality") !== "critical") continue;
        const callers = syncCallers(a, e);
        if (callers.length === 0) continue;
        const buffered = callers.every((c) => c.kind === "worker" && incoming(a, c.id, "async").length > 0);
        if (!breakerFor(a, e.id) && !retryFor(a, e.id) && !buffered)
          out.push({ nodeIds: [e.id, ...callers.map((c) => c.id)], detected: `Critical ${name(e)} has no breaker, retry policy, or queue buffer.` });
      }
      return out;
    },
  },
  {
    id: "unnecessary-infrastructure", title: "Infrastructure with no stated requirement", severity: "info", category: "complexity",
    why: "Every extra component costs money, adds failure modes and needs operating. Complexity is not quality.",
    affects: "Operational complexity and cost.", topics: [8, 3],
    options: [
      { fix: "State the requirement it serves in the component’s ‘Why is this here?’ field.", tradeoff: "Forces a justification; may reveal it is not needed." },
      { fix: "Remove it.", tradeoff: "Simpler; ensure no requirement silently depended on it." },
    ],
    contextNote: "A component can be justified by a requirement the scenario does not list — write that reason down.",
    check: (a, s) => {
      const required = s ? kindsRequiredBy(s.requirements) : new Set<Kind>();
      return a.nodes
        .filter((n) => HEAVY.includes(n.kind) && str(n, "justification").trim().length < 8 && !required.has(n.kind))
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} (${KIND_DEFS[n.kind].label}) is not needed by any scenario requirement and has no stated reason.`, severity: KIND_DEFS[n.kind].costUnits >= 2 ? ("medium" as Severity) : ("info" as Severity) }));
    },
  },
  {
    id: "data-ownership-unclear", title: "Data ownership unclear across services", severity: "medium", category: "consistency",
    why: "When several services read/write the same store, schema and invariants have no single guardian; changes in one break others.",
    affects: "Data consistency and independent deployability.", topics: [18, 19],
    options: [
      { fix: "Name one owning service and make others call it.", tradeoff: "Clear invariants; extra network hop and dependency." },
      { fix: "Give each service its own store.", tradeoff: "Independence; cross-service queries/transactions become harder (sagas)." },
      { fix: "Document shared access explicitly.", tradeoff: "Cheap; coupling remains." },
    ],
    contextNote: "A single deployable (modular monolith) sharing a database is a valid choice — declare an owner anyway.",
    check: (a) => {
      const out: Hit[] = [];
      for (const db of nodesOfKind(a, "postgres")) {
        const users = accessors(a, db.id).filter((n) => ["app_service", "web_app", "worker", "auth_service"].includes(n.kind));
        const owner = str(db, "dataOwner").trim();
        if (users.length >= 2 && !owner) out.push({ nodeIds: [db.id, ...users.map((u) => u.id)], detected: `${name(db)} is accessed by ${users.map((u) => name(u)).join(", ")} and has no declared owner.` });
        else if (users.length >= 2 && owner) out.push({ nodeIds: [db.id], detected: `${name(db)} is shared by ${users.length} services; owner declared as “${owner}”.`, severity: "info" });
      }
      return out;
    },
  },
  {
    id: "lb-no-health-check", title: "Load-balanced tier without health checking", severity: "medium", category: "reliability",
    why: "Without health checks the balancer keeps sending traffic to dead instances.",
    affects: "Availability during instance failures.", topics: [3, 9],
    options: [{ fix: "Add a Health Check targeting the balancer/service and enable ejection.", tradeoff: "Dead instances leave rotation; flapping checks can cause churn." }],
    contextNote: "Not relevant for a single-instance tier.",
    check: (a) => {
      const out: Hit[] = [];
      for (const lb of nodesOfKind(a, "load_balancer", "api_gateway", "reverse_proxy")) {
        const ups = outgoing(a, lb.id, "sync").map((c) => byId(a, c.to)).filter((n): n is ArchNode => !!n && CALLERS.includes(n.kind));
        const multi = ups.some((u) => num(u, "instances", 1) > 1);
        if (!multi) continue;
        const checked = !!healthCheckFor(a, lb.id) || ups.some((u) => !!healthCheckFor(a, u.id));
        if (!checked) out.push({ nodeIds: [lb.id, ...ups.map((u) => u.id)], detected: `${name(lb)} balances multi-instance services with no Health Check.` });
      }
      return out;
    },
  },
  {
    id: "topic-no-subscriber", title: "Topic with no subscribers", severity: "high", category: "functional",
    why: "Events are published and nobody reacts; the feature that depends on them never happens.", affects: "Downstream workflows.", topics: [16, 17],
    options: [{ fix: "Connect at least one subscriber (event connection).", tradeoff: "Adds a consumer to operate." }, { fix: "Remove the topic.", tradeoff: "Simpler; confirm nothing relies on it." }],
    contextNote: "A topic created ahead of future subscribers should say so in its justification.",
    check: (a) => nodesOfKind(a, "pubsub", "event_bus").filter((t) => subscribersOf(a, t.id).length === 0).map((t) => ({ nodeIds: [t.id], detected: `${name(t)} has no subscribers.` })),
  },
  {
    id: "topic-no-publisher", title: "Topic with no publisher", severity: "medium", category: "functional",
    why: "Subscribers wait for events that are never published.", affects: "Downstream workflows.", topics: [16],
    options: [{ fix: "Connect a publisher.", tradeoff: "The producer now owns an event contract." }],
    contextNote: "May be intentional if events come from an off-canvas source — say so.",
    check: (a) => nodesOfKind(a, "pubsub", "event_bus").filter((t) => publishersOf(a, t.id).length === 0 && subscribersOf(a, t.id).length > 0).map((t) => ({ nodeIds: [t.id], detected: `${name(t)} has subscribers but no publisher.` })),
  },
  {
    id: "saga-no-compensation", title: "Saga without compensating actions", severity: "high", category: "consistency",
    why: "If a later step fails, earlier steps cannot be undone — the system is left in a half-finished state.", affects: "Consistency after partial failure.", topics: [19],
    options: [{ fix: "Define a compensating action per step.", tradeoff: "Real undo logic to write and test; compensations can fail too." }],
    contextNote: "Pure read workflows need no compensation.",
    check: (a) => nodesOfKind(a, "saga").filter((s) => str(s, "compensation") === "none").map((s) => ({ nodeIds: [s.id], detected: `${name(s)} has no compensation defined.` })),
  },
  {
    id: "saga-state-volatile", title: "Saga state is not persisted", severity: "medium", category: "recovery",
    why: "A crash mid-workflow loses track of which steps ran.", affects: "Recovery from orchestrator crashes.", topics: [19],
    options: [{ fix: "Persist workflow state before each step.", tradeoff: "Extra writes; enables resume/compensate." }],
    contextNote: "Short, fully retryable workflows may accept this.",
    check: (a) => nodesOfKind(a, "saga").filter((s) => !bool(s, "persistsState")).map((s) => ({ nodeIds: [s.id], detected: `${name(s)} does not persist its state.` })),
  },
  {
    id: "tx-coordinator-blocking", title: "Two-phase commit blocks on a silent participant", severity: "high", category: "reliability",
    why: "A participant that never answers leaves locks held and the transaction stuck; the coordinator is also a single point of failure.", affects: "Availability of every participant.", topics: [18],
    options: [{ fix: "Set a participant timeout and a durable recovery log.", tradeoff: "Bounded blocking; in-doubt transactions still need resolution." }, { fix: "Use a saga instead.", tradeoff: "No blocking locks, but visible intermediate states and compensations." }],
    contextNote: "2PC can be appropriate among a few trusted, low-latency participants.",
    check: (a) => nodesOfKind(a, "tx_coordinator").filter((t) => num(t, "participantTimeoutMs") === 0 || !bool(t, "recoveryLog")).map((t) => ({ nodeIds: [t.id], detected: `${name(t)}: ${num(t, "participantTimeoutMs") === 0 ? "waits forever on participants" : "has no durable recovery log"}.` })),
  },
  {
    id: "realtime-queue", title: "Queue in the real-time path", severity: "medium", category: "scalability",
    why: "A queue between two real-time services adds latency and a failure mode; a queue does not replace a persistent connection.", affects: "Live-edit latency.", topics: [15, 4],
    options: [{ fix: "Send live events directly; keep queues for non-real-time work.", tradeoff: "You handle backpressure in the real-time service." }],
    contextNote: "Acceptable if the ‘real-time’ requirement is actually near-real-time (seconds).",
    check: (a) => realtimeQueues(a).map((q) => ({ nodeIds: [q.id], detected: `${name(q)} sits between two WebSocket services.` })),
  },
  {
    id: "no-observability", title: "No observability on request-handling services", severity: "info", category: "observability",
    why: "Without logs/metrics you cannot tell whether a failure protection ever activated or whether cost is rising.", affects: "Debuggability and cost visibility.", topics: [17],
    options: [{ fix: "Set observability to logs + metrics on key services.", tradeoff: "Telemetry cost and data-sensitivity review." }],
    contextNote: "Prototype-stage systems may defer this.",
    check: (a) => {
      const svcs = nodesOfKind(a, "app_service", "web_app", "worker");
      if (svcs.length === 0 || svcs.some((s) => str(s, "observability") !== "none")) return [];
      return [{ nodeIds: svcs.map((s) => s.id), detected: "No service emits metrics or logs." }];
    },
  },
  {
    id: "policy-no-target", title: "Reliability policy protecting nothing", severity: "medium", category: "reliability",
    why: "A policy with no target has no effect, but it looks like protection on the diagram — a false sense of safety.", affects: "Honesty of the reliability story.", topics: [10, 11, 12],
    options: [{ fix: "Choose the component it protects in the inspector.", tradeoff: "None." }, { fix: "Delete it.", tradeoff: "None." }],
    contextNote: "None.",
    check: (a) =>
      a.nodes
        .filter((n) => KIND_DEFS[n.kind].policy && !byId(a, String(n.props.target)))
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} (${KIND_DEFS[n.kind].label}) has no target.` })),
  },
  {
    id: "orphan-component", title: "Component not connected to anything", severity: "info", category: "maintainability",
    why: "Disconnected components are dead weight or an unfinished design.", affects: "Clarity of the architecture.", topics: [],
    options: [{ fix: "Connect it, or delete it.", tradeoff: "None." }],
    contextNote: "Fine while you are still sketching.",
    check: (a) =>
      a.nodes
        .filter((n) => !KIND_DEFS[n.kind].policy && !a.connections.some((c) => c.from === n.id || c.to === n.id))
        .map((n) => ({ nodeIds: [n.id], detected: `${name(n)} has no connections.` })),
  },
  {
    id: "real-provider-claimed", title: "External service marked as real", severity: "info", category: "security",
    why: "The Studio only models behavior; it cannot process real payments or contact real providers.", affects: "Honesty of claims about the design.", topics: [],
    options: [{ fix: "Mark it ‘simulated’ unless this diagram describes a real production plan.", tradeoff: "None." }],
    contextNote: "OK if the diagram documents a real planned integration — the Studio still simulates it.",
    check: (a) => nodesOfKind(a, "external_service").filter((e) => !bool(e, "simulated")).map((e) => ({ nodeIds: [e.id], detected: `${name(e)} is marked as a real provider.` })),
  },
];

export function validateArchitecture(a: Architecture, scenario?: Scenario): Finding[] {
  const out: Finding[] = [];
  for (const r of RULES) {
    for (const h of r.check(a, scenario)) {
      out.push({
        id: `${r.id}:${h.nodeIds.join(",")}`, ruleId: r.id, severity: h.severity ?? r.severity, title: r.title,
        nodeIds: h.nodeIds, detected: h.detected, why: r.why, affects: r.affects, topics: r.topics,
        options: r.options, contextNote: r.contextNote, category: r.category,
      });
    }
  }
  return out.sort((x, y) => SEVERITY_ORDER.indexOf(x.severity) - SEVERITY_ORDER.indexOf(y.severity));
}

export const countBySeverity = (f: Finding[]): Record<Severity, number> => ({
  critical: f.filter((x) => x.severity === "critical").length,
  high: f.filter((x) => x.severity === "high").length,
  medium: f.filter((x) => x.severity === "medium").length,
  info: f.filter((x) => x.severity === "info").length,
});

