/**
 * Architecture Studio — component model and pure editor operations.
 *
 * Everything here is deterministic and DOM-free so it can be unit tested.
 * The canvas UI only renders this state and dispatches these operations.
 */

export type Category = "entry" | "application" | "data" | "async" | "reliability" | "distributed";

export const CATEGORY_LABELS: Record<Category, string> = {
  entry: "Entry and protection",
  application: "Application",
  data: "Data",
  async: "Asynchronous communication",
  reliability: "Reliability",
  distributed: "Distributed workflows",
};

export type Kind =
  | "client"
  | "cdn"
  | "rate_limiter"
  | "reverse_proxy"
  | "load_balancer"
  | "api_gateway"
  | "web_app"
  | "app_service"
  | "auth_service"
  | "worker"
  | "cron_runner"
  | "postgres"
  | "redis_cache"
  | "object_storage"
  | "idempotency_store"
  | "queue"
  | "dlq"
  | "pubsub"
  | "event_bus"
  | "circuit_breaker"
  | "timeout"
  | "retry_policy"
  | "health_check"
  | "tx_coordinator"
  | "saga"
  | "external_service";

export type PropValue = string | number | boolean;
export type Props = Record<string, PropValue>;

export interface PropDef {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "boolean" | "target";
  options?: string[];
  default: PropValue;
  help?: string;
  min?: number;
}

export interface KindDef {
  kind: Kind;
  label: string;
  category: Category;
  short: string;
  /** Foundations topics that teach this component (1..20) */
  topics: number[];
  props: PropDef[];
  /** policy components guard a target component instead of being wired in */
  policy?: boolean;
  /** holds state => operational overhead */
  stateful?: boolean;
  /** illustrative relative cost units per instance (NOT prices) */
  costUnits: number;
}

const J: PropDef = {
  key: "justification",
  label: "Why is this here? (requirement it serves)",
  type: "text",
  default: "",
  help: "A stated reason keeps infrastructure honest. Unjustified heavy components are flagged.",
};
const INST: PropDef = { key: "instances", label: "Instance count", type: "number", default: 1, min: 1 };
const TIMEOUT: PropDef = {
  key: "requestTimeoutMs",
  label: "Outbound request timeout (ms, 0 = none)",
  type: "number",
  default: 0,
  min: 0,
};
const TARGET: PropDef = { key: "target", label: "Protects component", type: "target", default: "" };

export const KIND_DEFS: Record<Kind, KindDef> = {
  client: {
    kind: "client", label: "Client", category: "entry", short: "Browser, mobile app or API caller", topics: [1], costUnits: 0,
    props: [
      { key: "transport", label: "Transport", type: "select", options: ["http", "websocket"], default: "http" },
      J,
    ],
  },
  cdn: {
    kind: "cdn", label: "CDN / Edge", category: "entry", short: "Caches static or public content near users", topics: [2, 4], costUnits: 1,
    props: [
      { key: "contentScope", label: "Content scope", type: "select", options: ["static_assets", "public_api_responses"], default: "static_assets" },
      { key: "cacheTtlSeconds", label: "Edge TTL (s)", type: "number", default: 300, min: 0 },
      J,
    ],
  },
  rate_limiter: {
    kind: "rate_limiter", label: "Rate Limiter", category: "entry", short: "Caps request rate per identity", topics: [1], costUnits: 1,
    props: [
      { key: "algorithm", label: "Algorithm", type: "select", options: ["token_bucket", "leaky_bucket", "fixed_window", "sliding_window"], default: "token_bucket" },
      { key: "capacity", label: "Capacity (burst)", type: "number", default: 100, min: 1 },
      { key: "refillPerSec", label: "Refill rate (req/s)", type: "number", default: 10, min: 0 },
      { key: "identityKey", label: "Identity key", type: "select", options: ["ip", "user", "api_key", "tenant"], default: "user" },
      { key: "enforcement", label: "Enforcement location", type: "select", options: ["edge", "gateway", "application"], default: "edge" },
      J,
    ],
  },
  reverse_proxy: {
    kind: "reverse_proxy", label: "Reverse Proxy", category: "entry", short: "TLS termination, routing, buffering", topics: [4], costUnits: 1,
    props: [
      { key: "tlsTermination", label: "Terminates TLS", type: "boolean", default: true },
      { key: "buffersSlowClients", label: "Buffers slow clients", type: "boolean", default: true },
      J,
    ],
  },
  load_balancer: {
    kind: "load_balancer", label: "Load Balancer", category: "entry", short: "Spreads traffic over instances", topics: [3, 9], costUnits: 1,
    props: [
      { key: "algorithm", label: "Algorithm", type: "select", options: ["round_robin", "least_connections", "ip_hash"], default: "round_robin" },
      { key: "ejectsUnhealthy", label: "Removes unhealthy instances", type: "boolean", default: false, help: "Needs a health check to know who is unhealthy." },
      J,
    ],
  },
  api_gateway: {
    kind: "api_gateway", label: "API Gateway", category: "entry", short: "Single entry: auth, routing, limits", topics: [5, 1], costUnits: 2,
    props: [
      { key: "validatesAuth", label: "Validates credentials", type: "boolean", default: false },
      { key: "builtInRateLimit", label: "Built-in rate limiting", type: "boolean", default: false },
      { key: "ejectsUnhealthy", label: "Removes unhealthy upstreams", type: "boolean", default: false },
      J,
    ],
  },
  web_app: {
    kind: "web_app", label: "Web Application", category: "application", short: "Serves UI and handles web requests", topics: [3, 7], costUnits: 1,
    props: [INST, TIMEOUT, { key: "observability", label: "Observability", type: "select", options: ["none", "logs", "logs_metrics", "logs_metrics_tracing"], default: "none" }, J],
  },
  app_service: {
    kind: "app_service", label: "Application Service", category: "application", short: "Business logic behind an API", topics: [3, 7, 8], costUnits: 1,
    props: [
      INST,
      TIMEOUT,
      { key: "transport", label: "Serves", type: "select", options: ["http", "websocket"], default: "http" },
      { key: "paymentLike", label: "Performs charge / billing-like operations", type: "boolean", default: false },
      { key: "healthCheck", label: "Health-check endpoint", type: "select", options: ["none", "liveness", "readiness"], default: "none" },
      { key: "observability", label: "Observability", type: "select", options: ["none", "logs", "logs_metrics", "logs_metrics_tracing"], default: "none" },
      { key: "capacityRps", label: "Approx. capacity per instance (req/s)", type: "number", default: 50, min: 1 },
      J,
    ],
  },
  auth_service: {
    kind: "auth_service", label: "Authentication Service", category: "application", short: "Verifies identity, issues tokens", topics: [5], costUnits: 1,
    props: [INST, TIMEOUT, { key: "tokenType", label: "Token type", type: "select", options: ["jwt", "opaque_token", "server_session"], default: "jwt" }, { key: "observability", label: "Observability", type: "select", options: ["none", "logs", "logs_metrics", "logs_metrics_tracing"], default: "none" }, J],
  },
  worker: {
    kind: "worker", label: "Background Worker", category: "application", short: "Consumes jobs and does heavy work", topics: [15, 11], costUnits: 1,
    props: [
      INST,
      TIMEOUT,
      { key: "processingRatePerSec", label: "Jobs/s per instance", type: "number", default: 1, min: 0 },
      { key: "idempotentHandler", label: "Handler safe to run twice", type: "boolean", default: false },
      { key: "autoscale", label: "Autoscales on backlog", type: "boolean", default: false },
      { key: "observability", label: "Observability", type: "select", options: ["none", "logs", "logs_metrics", "logs_metrics_tracing"], default: "none" },
      J,
    ],
  },
  cron_runner: {
    kind: "cron_runner", label: "Scheduled Job Runner", category: "application", short: "Triggers work on a schedule", topics: [20], costUnits: 1,
    props: [
      { key: "schedule", label: "Schedule (cron)", type: "text", default: "0 * * * *" },
      INST,
      { key: "duplicateProtection", label: "Duplicate-run protection", type: "select", options: ["none", "distributed_lock", "leader_election", "idempotent_job"], default: "none" },
      J,
    ],
  },
  postgres: {
    kind: "postgres", label: "PostgreSQL Database", category: "data", short: "Durable relational data", topics: [2], stateful: true, costUnits: 3,
    props: [
      { key: "dataOwner", label: "Owning service (data ownership)", type: "text", default: "", help: "Name of the single service allowed to write this data." },
      { key: "readWrite", label: "Read/write behavior", type: "select", options: ["primary_only", "primary_plus_read_replicas"], default: "primary_only" },
      { key: "transactionBoundary", label: "Transaction boundary", type: "select", options: ["single_statement", "per_request_transaction", "cross_service_saga"], default: "per_request_transaction" },
      { key: "backup", label: "Backup / recovery assumption", type: "select", options: ["none", "daily_snapshots", "point_in_time_recovery"], default: "none" },
      { key: "capacityOps", label: "Approx. capacity (ops/s)", type: "number", default: 500, min: 1 },
      J,
    ],
  },
  redis_cache: {
    kind: "redis_cache", label: "Redis Cache", category: "data", short: "Fast in-memory lookups", topics: [2], stateful: true, costUnits: 2,
    props: [
      { key: "strategy", label: "Cache strategy", type: "select", options: ["cache_aside", "read_through", "write_through", "write_behind"], default: "cache_aside" },
      { key: "ttlSeconds", label: "TTL (s, 0 = never expires)", type: "number", default: 0, min: 0 },
      { key: "keyPattern", label: "Key pattern", type: "text", default: "", help: "e.g. user:{userId}:profile" },
      { key: "invalidation", label: "Invalidation strategy", type: "select", options: ["none", "on_write", "event_driven", "manual"], default: "none" },
      { key: "sensitivity", label: "Data sensitivity", type: "select", options: ["public", "internal", "sensitive"], default: "public" },
      J,
    ],
  },
  object_storage: {
    kind: "object_storage", label: "Object Storage", category: "data", short: "Large files (uploads, PDFs)", topics: [2], stateful: true, costUnits: 1,
    props: [
      { key: "visibility", label: "Access", type: "select", options: ["private", "public_read"], default: "private" },
      { key: "retentionDays", label: "Retention (days, 0 = forever)", type: "number", default: 0, min: 0 },
      J,
    ],
  },
  idempotency_store: {
    kind: "idempotency_store", label: "Idempotency Store", category: "data", short: "Remembers processed request keys", topics: [14], stateful: true, costUnits: 1,
    props: [
      { key: "keyTtlHours", label: "Key retention (h)", type: "number", default: 24, min: 1 },
      { key: "atomicClaim", label: "Atomic claim (set-if-absent)", type: "boolean", default: true },
      { key: "storesResult", label: "Stores first result for replay", type: "boolean", default: true },
      J,
    ],
  },
  queue: {
    kind: "queue", label: "Message Queue", category: "async", short: "Buffers work for consumers", topics: [15], stateful: true, costUnits: 2,
    props: [
      { key: "retryLimit", label: "Delivery attempts before giving up (0 = unlimited)", type: "number", default: 0, min: 0 },
      { key: "visibilityTimeoutSec", label: "Visibility timeout (s, 0 = none)", type: "number", default: 30, min: 0 },
      { key: "deadLetterPolicy", label: "Dead-letter policy", type: "select", options: ["none", "dlq"], default: "none" },
      { key: "durable", label: "Persists messages", type: "boolean", default: true },
      { key: "maxDepth", label: "Max depth (0 = unbounded)", type: "number", default: 0, min: 0 },
      J,
    ],
  },
  dlq: {
    kind: "dlq", label: "Dead Letter Queue", category: "async", short: "Parking lot for poison messages", topics: [15], stateful: true, costUnits: 1,
    props: [
      { key: "alerting", label: "Alerts when non-empty", type: "boolean", default: false },
      { key: "retentionDays", label: "Retention (days)", type: "number", default: 14, min: 1 },
      J,
    ],
  },
  pubsub: {
    kind: "pubsub", label: "Pub/Sub Topic", category: "async", short: "Fan-out of events to subscribers", topics: [16], stateful: true, costUnits: 2,
    props: [
      { key: "retentionHours", label: "Retains events (h, 0 = drop if no subscriber)", type: "number", default: 0, min: 0 },
      { key: "delivery", label: "Delivery", type: "select", options: ["at_most_once", "at_least_once"], default: "at_least_once" },
      J,
    ],
  },
  event_bus: {
    kind: "event_bus", label: "Event Bus", category: "async", short: "Routes domain events between services", topics: [17, 16], stateful: true, costUnits: 2,
    props: [
      { key: "retentionHours", label: "Retains events (h, 0 = drop if no subscriber)", type: "number", default: 0, min: 0 },
      { key: "delivery", label: "Delivery", type: "select", options: ["at_most_once", "at_least_once"], default: "at_least_once" },
      J,
    ],
  },
  circuit_breaker: {
    kind: "circuit_breaker", label: "Circuit Breaker", category: "reliability", short: "Fails fast when a dependency is sick", topics: [10], policy: true, costUnits: 0,
    props: [
      TARGET,
      { key: "failureThreshold", label: "Failures before opening", type: "number", default: 5, min: 1 },
      { key: "openSeconds", label: "Open duration (s)", type: "number", default: 30, min: 1 },
      { key: "fallback", label: "Fallback while open", type: "select", options: ["none", "cached_response", "default_value", "degrade_feature"], default: "none" },
      J,
    ],
  },
  timeout: {
    kind: "timeout", label: "Timeout", category: "reliability", short: "Bounds how long a call may wait", topics: [11], policy: true, costUnits: 0,
    props: [TARGET, { key: "timeoutMs", label: "Timeout (ms)", type: "number", default: 3000, min: 1 }, J],
  },
  retry_policy: {
    kind: "retry_policy", label: "Retry Policy", category: "reliability", short: "Re-attempts transient failures", topics: [12, 13], policy: true, costUnits: 0,
    props: [
      TARGET,
      { key: "maxAttempts", label: "Max attempts (0 = unbounded)", type: "number", default: 3, min: 0 },
      { key: "backoff", label: "Backoff", type: "select", options: ["none", "fixed", "exponential", "exponential_jitter"], default: "fixed" },
      J,
    ],
  },
  health_check: {
    kind: "health_check", label: "Health Check", category: "reliability", short: "Detects unhealthy instances", topics: [9, 3], policy: true, costUnits: 0,
    props: [
      TARGET,
      { key: "intervalSec", label: "Interval (s)", type: "number", default: 10, min: 1 },
      { key: "action", label: "On failure", type: "select", options: ["alert_only", "remove_from_rotation", "restart"], default: "remove_from_rotation" },
      J,
    ],
  },
  tx_coordinator: {
    kind: "tx_coordinator", label: "Transaction Coordinator", category: "distributed", short: "Two-phase commit across participants", topics: [18], stateful: true, costUnits: 2,
    props: [
      { key: "participantTimeoutMs", label: "Participant timeout (ms, 0 = wait forever)", type: "number", default: 0, min: 0 },
      { key: "recoveryLog", label: "Durable recovery log", type: "boolean", default: false },
      J,
    ],
  },
  saga: {
    kind: "saga", label: "Saga Orchestrator", category: "distributed", short: "Multi-step workflow with compensation", topics: [19], stateful: true, costUnits: 2,
    props: [
      { key: "style", label: "Style", type: "select", options: ["orchestration", "choreography"], default: "orchestration" },
      { key: "compensation", label: "Compensating actions", type: "select", options: ["none", "defined_per_step"], default: "none" },
      { key: "persistsState", label: "Persists workflow state", type: "boolean", default: false },
      J,
    ],
  },
  external_service: {
    kind: "external_service", label: "External Service", category: "distributed", short: "Third-party API you do not control", topics: [10, 11, 12], costUnits: 0,
    props: [
      { key: "provider", label: "Provider (label)", type: "text", default: "" },
      { key: "criticality", label: "Criticality", type: "select", options: ["critical", "optional"], default: "critical" },
      { key: "simulated", label: "Simulated (not a real provider)", type: "boolean", default: true, help: "Studio never talks to real providers; mark honestly." },
      J,
    ],
  },
};

export const KIND_LIST: Kind[] = Object.keys(KIND_DEFS) as Kind[];
export const isKind = (v: unknown): v is Kind => typeof v === "string" && v in KIND_DEFS;

export const STORE_KINDS: Kind[] = ["postgres", "redis_cache", "object_storage", "idempotency_store"];
export const MESSAGING_KINDS: Kind[] = ["queue", "dlq", "pubsub", "event_bus"];
export const EDGE_KINDS: Kind[] = ["cdn", "rate_limiter", "reverse_proxy", "load_balancer", "api_gateway"];
export const SERVICE_KINDS: Kind[] = ["web_app", "app_service", "auth_service", "worker"];

// ---------------------------------------------------------------- graph types

export type ConnType = "sync" | "async" | "event" | "data" | "schedule";

export const CONN_LABELS: Record<ConnType, string> = {
  sync: "Synchronous request",
  async: "Asynchronous message",
  event: "Event publication",
  data: "Data access",
  schedule: "Scheduled trigger",
};

export interface ArchNode {
  id: string;
  kind: Kind;
  name: string;
  x: number;
  y: number;
  group: string;
  props: Props;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  type: ConnType;
  label: string;
}

export interface Architecture {
  version: 1;
  seq: number;
  nodes: ArchNode[];
  connections: Connection[];
}

export const emptyArchitecture = (): Architecture => ({ version: 1, seq: 0, nodes: [], connections: [] });

export const defaultProps = (kind: Kind): Props => {
  const out: Props = {};
  for (const p of KIND_DEFS[kind].props) out[p.key] = p.default;
  return out;
};

export const getNode = (a: Architecture, id: string): ArchNode | undefined => a.nodes.find((n) => n.id === id);
export const nodesOfKind = (a: Architecture, ...kinds: Kind[]): ArchNode[] =>
  a.nodes.filter((n) => kinds.includes(n.kind));
export const num = (n: ArchNode, key: string, fallback = 0): number => {
  const v = n.props[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};
export const str = (n: ArchNode, key: string): string => {
  const v = n.props[key];
  return typeof v === "string" ? v : "";
};
export const bool = (n: ArchNode, key: string): boolean => n.props[key] === true;

export const outgoing = (a: Architecture, id: string, ...types: ConnType[]): Connection[] =>
  a.connections.filter((c) => c.from === id && (types.length === 0 || types.includes(c.type)));
export const incoming = (a: Architecture, id: string, ...types: ConnType[]): Connection[] =>
  a.connections.filter((c) => c.to === id && (types.length === 0 || types.includes(c.type)));

/** policy components (timeout, retry, breaker, health) that protect `targetId` */
export const policiesFor = (a: Architecture, targetId: string, kind: Kind): ArchNode[] =>
  a.nodes.filter((n) => n.kind === kind && n.props.target === targetId);

// ---------------------------------------------------------- connection rules

export interface ConnCheck {
  ok: boolean;
  reason: string;
}

/** Every connection must have a meaningful source and destination. */
export function canConnect(a: Architecture, fromId: string, toId: string, type: ConnType): ConnCheck {
  const from = getNode(a, fromId);
  const to = getNode(a, toId);
  if (!from || !to) return { ok: false, reason: "Both endpoints must exist." };
  if (from.id === to.id) return { ok: false, reason: "A component cannot connect to itself." };
  if (KIND_DEFS[from.kind].policy || KIND_DEFS[to.kind].policy)
    return { ok: false, reason: "Reliability policies are not wired in; pick the component they protect in the inspector." };
  if (to.kind === "client") return { ok: false, reason: "Nothing initiates requests toward a client; clients are sources." };
  if (a.connections.some((c) => c.from === fromId && c.to === toId && c.type === type))
    return { ok: false, reason: "That exact connection already exists." };
  const fromMsg = MESSAGING_KINDS.includes(from.kind);
  const toMsg = MESSAGING_KINDS.includes(to.kind);
  const toStore = STORE_KINDS.includes(to.kind);
  const fromStore = STORE_KINDS.includes(from.kind);
  if (fromStore) return { ok: false, reason: "Data stores are passive; they do not initiate connections." };
  switch (type) {
    case "data":
      if (!toStore) return { ok: false, reason: "Data access must end at a data store (database, cache, object storage, idempotency store)." };
      return { ok: true, reason: "" };
    case "schedule":
      if (from.kind !== "cron_runner") return { ok: false, reason: "Only a Scheduled Job Runner can be the source of a scheduled trigger." };
      if (toStore) return { ok: false, reason: "A scheduled trigger should start work (a service or queue), not write to a store." };
      return { ok: true, reason: "" };
    case "async":
      if (!fromMsg && !toMsg) return { ok: false, reason: "Asynchronous messages need a queue or DLQ at one end." };
      if (from.kind === "pubsub" || from.kind === "event_bus" || to.kind === "pubsub" || to.kind === "event_bus")
        return { ok: false, reason: "Use an Event publication connection for topics and buses." };
      if (toStore) return { ok: false, reason: "Queues deliver to consumers, not directly to data stores." };
      return { ok: true, reason: "" };
    case "event":
      if (from.kind !== "pubsub" && from.kind !== "event_bus" && to.kind !== "pubsub" && to.kind !== "event_bus")
        return { ok: false, reason: "Event publication needs a Pub/Sub Topic or Event Bus at one end." };
      if (toStore) return { ok: false, reason: "Subscribers are services, not data stores." };
      return { ok: true, reason: "" };
    case "sync":
      if (fromMsg || toMsg) return { ok: false, reason: "Queues and topics are reached through asynchronous or event connections." };
      if (toStore) return { ok: false, reason: "Use a Data access connection to reach a data store." };
      if (from.kind === "cron_runner") return { ok: false, reason: "A Scheduled Job Runner uses scheduled triggers." };
      return { ok: true, reason: "" };
  }
}

// ----------------------------------------------------------- editor operations

const clampCoord = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(4000, Math.round(v))) : 0);

/** Grid placement: next free slot, deterministic (no randomness). */
export function nextPosition(a: Architecture): { x: number; y: number } {
  const cols = 5;
  for (let i = 0; i < 500; i++) {
    const x = 40 + (i % cols) * 190;
    const y = 40 + Math.floor(i / cols) * 120;
    if (!a.nodes.some((n) => Math.abs(n.x - x) < 150 && Math.abs(n.y - y) < 80)) return { x, y };
  }
  return { x: 40, y: 40 };
}

export function addNode(a: Architecture, kind: Kind, opts: { name?: string; x?: number; y?: number } = {}): Architecture {
  const def = KIND_DEFS[kind];
  const seq = a.seq + 1;
  const pos = nextPosition(a);
  const sameKind = a.nodes.filter((n) => n.kind === kind).length;
  const node: ArchNode = {
    id: `n${seq}`,
    kind,
    name: opts.name ?? (sameKind === 0 ? def.label : `${def.label} ${sameKind + 1}`),
    x: clampCoord(opts.x ?? pos.x),
    y: clampCoord(opts.y ?? pos.y),
    group: "",
    props: defaultProps(kind),
  };
  return { ...a, seq, nodes: [...a.nodes, node] };
}

const mapNode = (a: Architecture, id: string, f: (n: ArchNode) => ArchNode): Architecture =>
  a.nodes.some((n) => n.id === id) ? { ...a, nodes: a.nodes.map((n) => (n.id === id ? f(n) : n)) } : a;

export const moveNode = (a: Architecture, id: string, x: number, y: number): Architecture =>
  mapNode(a, id, (n) => ({ ...n, x: clampCoord(x), y: clampCoord(y) }));

export const renameNode = (a: Architecture, id: string, name: string): Architecture =>
  mapNode(a, id, (n) => ({ ...n, name: name.slice(0, 60) }));

export const setGroup = (a: Architecture, id: string, group: string): Architecture =>
  mapNode(a, id, (n) => ({ ...n, group: group.trim().slice(0, 40) }));

export function setProp(a: Architecture, id: string, key: string, value: PropValue): Architecture {
  return mapNode(a, id, (n) => {
    const def = KIND_DEFS[n.kind].props.find((p) => p.key === key);
    if (!def) return n;
    let v: PropValue = value;
    if (def.type === "number") {
      const parsed = typeof value === "number" ? value : parseFloat(String(value));
      v = Number.isFinite(parsed) ? Math.max(def.min ?? 0, parsed) : def.default;
    } else if (def.type === "boolean") v = value === true;
    else if (def.type === "select") v = def.options?.includes(String(value)) ? String(value) : def.default;
    else v = String(value).slice(0, 200);
    return { ...n, props: { ...n.props, [key]: v } };
  });
}

export function deleteNode(a: Architecture, id: string): Architecture {
  return {
    ...a,
    nodes: a.nodes
      .filter((n) => n.id !== id)
      .map((n) => (n.props.target === id ? { ...n, props: { ...n.props, target: "" } } : n)),
    connections: a.connections.filter((c) => c.from !== id && c.to !== id),
  };
}

export interface ConnectResult {
  arch: Architecture;
  ok: boolean;
  reason: string;
  id?: string;
}

export function connect(a: Architecture, from: string, to: string, type: ConnType, label = ""): ConnectResult {
  const chk = canConnect(a, from, to, type);
  if (!chk.ok) return { arch: a, ok: false, reason: chk.reason };
  const seq = a.seq + 1;
  const id = `c${seq}`;
  return { arch: { ...a, seq, connections: [...a.connections, { id, from, to, type, label: label.slice(0, 60) }] }, ok: true, reason: "", id };
}

export const disconnect = (a: Architecture, connId: string): Architecture => ({
  ...a,
  connections: a.connections.filter((c) => c.id !== connId),
});

export const setConnectionLabel = (a: Architecture, connId: string, label: string): Architecture => ({
  ...a,
  connections: a.connections.map((c) => (c.id === connId ? { ...c, label: label.slice(0, 60) } : c)),
});

/** Stable structural fingerprint — ignores positions so moving boxes is not an "improvement". */
export function archFingerprint(a: Architecture): string {
  const nodes = a.nodes
    .map((n) => `${n.kind}|${n.name}|${n.group}|${JSON.stringify(Object.keys(n.props).sort().map((k) => [k, n.props[k]]))}`)
    .sort();
  const idName = new Map(a.nodes.map((n) => [n.id, n.name]));
  const conns = a.connections.map((c) => `${idName.get(c.from)}>${idName.get(c.to)}|${c.type}|${c.label}`).sort();
  return `${nodes.join(";")}##${conns.join(";")}`;
}

// -------------------------------------------------------------- graph queries

/** nodes reachable from any node in `starts` following the given connection types */
export function reachable(a: Architecture, starts: string[], types: ConnType[]): Set<string> {
  const seen = new Set<string>(starts);
  const stack = [...starts];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const c of a.connections) {
      if (c.from === cur && types.includes(c.type) && !seen.has(c.to)) {
        seen.add(c.to);
        stack.push(c.to);
      }
    }
  }
  return seen;
}

/** All kinds of edge-layer nodes sitting between a client and a node (sync path). */
export function syncPathExists(a: Architecture, fromId: string, toId: string): boolean {
  return reachable(a, [fromId], ["sync", "data"]).has(toId);
}
