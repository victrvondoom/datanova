/**
 * Starter architectures. For every scenario:
 *  - `baseline`: a deliberately naive first draft ("Version A") — what many
 *    learners would sketch first. It is NOT a recommended design.
 *  - `example`: ONE reasonable design ("Version B") used by Compare mode.
 *    It is a worked example, not the only valid answer, and is never shown
 *    inside the guided challenge before the learner has attempted it.
 */
import { Architecture, ConnType, Kind, Props, addNode, connect, emptyArchitecture, moveNode, KIND_DEFS, setGroup, setProp } from "./model";

export class Builder {
  private arch: Architecture = emptyArchitecture();
  private ids = new Map<string, string>();
  n(key: string, kind: Kind, col: number, row: number, props: Props = {}, name?: string, group = ""): this {
    this.arch = addNode(this.arch, kind, { name: name ?? KIND_DEFS[kind].label });
    const node = this.arch.nodes[this.arch.nodes.length - 1];
    this.ids.set(key, node.id);
    this.arch = moveNode(this.arch, node.id, 40 + col * 240, 40 + row * 115);
    if (group) this.arch = setGroup(this.arch, node.id, group);
    for (const [k, v] of Object.entries(props)) {
      const def = KIND_DEFS[kind].props.find((p) => p.key === k);
      if (!def) throw new Error(`Unknown prop ${k} on ${kind}`);
      this.arch = setProp(this.arch, node.id, k, def.type === "target" ? this.id(String(v)) : v);
    }
    return this;
  }
  id(key: string): string {
    const v = this.ids.get(key);
    if (!v) throw new Error(`Unknown key ${key}`);
    return v;
  }
  c(from: string, to: string, type: ConnType, label = ""): this {
    const r = connect(this.arch, this.id(from), this.id(to), type, label);
    if (!r.ok) throw new Error(`Blueprint connection ${from}→${to} (${type}) invalid: ${r.reason}`);
    this.arch = r.arch;
    return this;
  }
  build(): Architecture {
    return this.arch;
  }
}

const OBS = "logs_metrics";

// ------------------------------------------------------------------ pdf-saas
function pdfBaseline(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1)
    .n("api", "app_service", 1, 1, { paymentLike: true }, "PDF API")
    .n("ai", "external_service", 2, 0, { provider: "AI model API (simulated)" }, "AI API")
    .n("db", "postgres", 2, 2, {}, "Jobs DB")
    .c("client", "api", "sync", "request")
    .c("api", "ai", "sync", "generate")
    .c("api", "db", "data")
    .build();
}
function pdfExample(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1)
    .n("gw", "api_gateway", 1, 1, { validatesAuth: true, builtInRateLimit: true, ejectsUnhealthy: true })
    .n("api", "app_service", 2, 1, { instances: 2, requestTimeoutMs: 5000, healthCheck: "readiness", observability: OBS, paymentLike: true }, "PDF API")
    .n("hc", "health_check", 2, 0, { target: "api", action: "remove_from_rotation" })
    .n("idem", "idempotency_store", 3, 0)
    .n("db", "postgres", 3, 2, { dataOwner: "PDF API", backup: "daily_snapshots" }, "Jobs DB")
    .n("q", "queue", 3, 1, { retryLimit: 5, visibilityTimeoutSec: 180, deadLetterPolicy: "dlq" }, "PDF Jobs")
    .n("dlq", "dlq", 3, 3, { alerting: true }, "PDF Jobs DLQ")
    .n("w", "worker", 4, 1, { instances: 3, requestTimeoutMs: 60000, idempotentHandler: true, observability: OBS, processingRatePerSec: 0.5 }, "PDF Worker")
    .n("ai", "external_service", 5, 0, { provider: "AI model API (simulated)" }, "AI API")
    .n("retry", "retry_policy", 5, 1, { target: "ai", maxAttempts: 3, backoff: "exponential_jitter" })
    .n("cb", "circuit_breaker", 5, 2, { target: "ai", failureThreshold: 5, openSeconds: 30, fallback: "degrade_feature" })
    .n("files", "object_storage", 4, 3)
    .n("topic", "pubsub", 4, 2, { retentionHours: 24 }, "Job Events")
    .n("notify", "app_service", 5, 3, { requestTimeoutMs: 3000, observability: OBS }, "Notifier")
    .n("cron", "cron_runner", 1, 3, { schedule: "0 3 * * *", instances: 2, duplicateProtection: "distributed_lock" }, "Cleanup Scheduler")
    .n("lock", "redis_cache", 2, 3, { ttlSeconds: 60, keyPattern: "lock:{job}", sensitivity: "internal", justification: "Holds the scheduler lock so cleanup runs once" }, "Lock Store")
    .c("client", "gw", "sync", "HTTPS")
    .c("gw", "api", "sync")
    .c("api", "idem", "data", "claim key")
    .c("api", "db", "data", "job state")
    .c("api", "q", "async", "enqueue job")
    .c("api", "files", "data", "uploads")
    .c("q", "w", "async", "deliver")
    .c("q", "dlq", "async", "after 5 attempts")
    .c("w", "ai", "sync", "generate")
    .c("w", "db", "data", "update state")
    .c("w", "idem", "data")
    .c("w", "topic", "event", "job completed")
    .c("topic", "notify", "event", "subscribe")
    .c("cron", "api", "schedule", "daily cleanup")
    .c("cron", "lock", "data", "lock")
    .build();
}

// --------------------------------------------------------- ecommerce-checkout
function ecBaseline(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1)
    .n("shop", "app_service", 1, 1, { paymentLike: true }, "Checkout Monolith")
    .n("rec", "app_service", 2, 0, {}, "Recommendations")
    .n("pay", "external_service", 2, 1, { provider: "Payment provider (simulated)" }, "Payment Provider")
    .n("db", "postgres", 2, 2, {}, "Shop DB")
    .c("client", "shop", "sync")
    .c("shop", "rec", "sync", "recommend")
    .c("shop", "pay", "sync", "charge")
    .c("shop", "db", "data")
    .build();
}
function ecExample(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1)
    .n("gw", "api_gateway", 1, 1, { validatesAuth: true, builtInRateLimit: true, ejectsUnhealthy: true })
    .n("catalog", "app_service", 2, 0, { instances: 3, requestTimeoutMs: 2000, healthCheck: "readiness", observability: OBS }, "Catalog Service")
    .n("cache", "redis_cache", 3, 0, { ttlSeconds: 60, invalidation: "on_write", keyPattern: "catalog:{sku}" }, "Catalog Cache")
    .n("checkout", "app_service", 2, 2, { instances: 3, requestTimeoutMs: 5000, paymentLike: true, healthCheck: "readiness", observability: OBS }, "Checkout Service")
    .n("hc", "health_check", 2, 1, { target: "checkout" })
    .n("idem", "idempotency_store", 3, 3)
    .n("odb", "postgres", 3, 2, { dataOwner: "Checkout Service", backup: "daily_snapshots" }, "Order DB")
    .n("saga", "saga", 3, 1, { compensation: "defined_per_step", persistsState: true }, "Checkout Saga")
    .n("inv", "app_service", 4, 0, { instances: 2, requestTimeoutMs: 2000, observability: OBS }, "Inventory Service")
    .n("idb", "postgres", 5, 0, { dataOwner: "Inventory Service", backup: "daily_snapshots" }, "Inventory DB")
    .n("bill", "app_service", 4, 1, { instances: 2, requestTimeoutMs: 6000, paymentLike: true, observability: OBS }, "Billing Service")
    .n("ship", "app_service", 4, 2, { requestTimeoutMs: 2000, observability: OBS }, "Shipping Service")
    .n("pay", "external_service", 5, 1, { provider: "Payment provider (simulated)" }, "Payment Provider")
    .n("retry", "retry_policy", 5, 2, { target: "pay", maxAttempts: 3, backoff: "exponential_jitter" })
    .n("rec", "app_service", 2, 3, { requestTimeoutMs: 800 }, "Recommendations")
    .n("cb", "circuit_breaker", 1, 3, { target: "rec", failureThreshold: 3, openSeconds: 30, fallback: "degrade_feature" })
    .n("bus", "pubsub", 4, 3, { retentionHours: 24 }, "Order Events")
    .n("an", "worker", 5, 3, { idempotentHandler: true, observability: OBS }, "Analytics Consumer")
    .c("client", "gw", "sync")
    .c("gw", "catalog", "sync", "browse")
    .c("gw", "checkout", "sync", "place order")
    .c("catalog", "cache", "data", "cache-aside")
    .c("checkout", "idem", "data", "claim key")
    .c("checkout", "odb", "data", "order state")
    .c("checkout", "saga", "sync", "start saga")
    .c("saga", "inv", "sync", "reserve")
    .c("saga", "bill", "sync", "charge")
    .c("saga", "ship", "sync", "ship")
    .c("inv", "idb", "data")
    .c("bill", "idem", "data")
    .c("bill", "pay", "sync", "charge (sim)")
    .c("checkout", "rec", "sync", "recommend")
    .c("checkout", "bus", "event", "order placed")
    .c("bus", "an", "event")
    .build();
}

// ----------------------------------------------------------- realtime-collab
function rtBaseline(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1, { transport: "websocket" })
    .n("a", "app_service", 1, 1, { transport: "websocket" }, "Collab Server")
    .n("q", "queue", 2, 1, {}, "Edit Queue")
    .n("b", "app_service", 3, 1, { transport: "websocket" }, "Broadcast Server")
    .n("db", "postgres", 3, 2, {}, "Docs DB")
    .c("client", "a", "sync", "edits")
    .c("a", "q", "async", "every edit")
    .c("q", "b", "async")
    .c("a", "db", "data")
    .build();
}
function rtExample(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1, { transport: "websocket" })
    .n("lb", "load_balancer", 1, 1, { ejectsUnhealthy: true, algorithm: "least_connections" })
    .n("auth", "auth_service", 1, 0, { requestTimeoutMs: 1000, observability: OBS })
    .n("collab", "app_service", 2, 1, { transport: "websocket", instances: 3, requestTimeoutMs: 2000, healthCheck: "readiness", observability: OBS }, "Collab Gateway")
    .n("hc", "health_check", 2, 0, { target: "collab", intervalSec: 5 })
    .n("presence", "redis_cache", 3, 0, { ttlSeconds: 30, invalidation: "event_driven", keyPattern: "presence:{docId}:{userId}", sensitivity: "internal" }, "Presence Store")
    .n("db", "postgres", 3, 1, { dataOwner: "Collab Gateway", backup: "point_in_time_recovery" }, "Document Store")
    .n("q", "queue", 3, 2, { retryLimit: 3, deadLetterPolicy: "dlq", visibilityTimeoutSec: 120 }, "Export Jobs")
    .n("dlq", "dlq", 3, 3, { alerting: true }, "Export DLQ")
    .n("w", "worker", 4, 2, { idempotentHandler: true, requestTimeoutMs: 30000, observability: OBS }, "Export Worker")
    .c("client", "lb", "sync", "WebSocket")
    .c("lb", "collab", "sync")
    .c("collab", "auth", "sync", "verify token")
    .c("collab", "presence", "data")
    .c("collab", "db", "data", "persist edits")
    .c("collab", "q", "async", "export only")
    .c("q", "w", "async")
    .c("q", "dlq", "async")
    .build();
}

// ------------------------------------------------------ notification-platform
function ntBaseline(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1)
    .n("api", "app_service", 1, 1, {}, "Notification API")
    .n("prov", "external_service", 2, 0, { provider: "Email/SMS provider (simulated)" }, "Provider")
    .n("q", "queue", 2, 2, {}, "Outbox")
    .n("cron", "cron_runner", 0, 3, { instances: 2, schedule: "0 8 * * *" }, "Digest Scheduler")
    .c("client", "api", "sync")
    .c("api", "prov", "sync", "send inline")
    .c("api", "q", "async")
    .c("cron", "api", "schedule", "daily digest")
    .build();
}
function ntExample(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1)
    .n("gw", "api_gateway", 1, 1, { validatesAuth: true, builtInRateLimit: true, ejectsUnhealthy: true, justification: "Authenticates sender apps and rate-limits campaign bursts" })
    .n("api", "app_service", 2, 1, { instances: 2, requestTimeoutMs: 2000, healthCheck: "readiness", observability: OBS }, "Notification API")
    .n("hc", "health_check", 2, 0, { target: "api" })
    .n("q", "queue", 3, 1, { retryLimit: 5, visibilityTimeoutSec: 60, deadLetterPolicy: "dlq" }, "Notification Queue")
    .n("dlq", "dlq", 3, 2, { alerting: true }, "Notification DLQ")
    .n("w", "worker", 4, 1, { instances: 3, requestTimeoutMs: 8000, idempotentHandler: true, observability: OBS, processingRatePerSec: 6 }, "Sender Worker")
    .n("idem", "idempotency_store", 4, 2)
    .n("prov", "external_service", 5, 0, { provider: "Email/SMS provider (simulated)" }, "Provider")
    .n("retry", "retry_policy", 5, 1, { target: "prov", maxAttempts: 4, backoff: "exponential_jitter" })
    .n("db", "postgres", 5, 2, { dataOwner: "Sender Worker", backup: "daily_snapshots" }, "Delivery DB")
    .n("topic", "pubsub", 4, 3, { retentionHours: 24, justification: "Fans one delivery result out to webhooks and analytics" }, "Delivery Events")
    .n("hook", "app_service", 5, 3, { requestTimeoutMs: 2000, observability: OBS }, "Webhook Notifier")
    .n("an", "worker", 3, 3, { idempotentHandler: true }, "Analytics Consumer")
    .n("cron", "cron_runner", 1, 3, { instances: 2, schedule: "0 8 * * *", duplicateProtection: "distributed_lock" }, "Digest Scheduler")
    .n("lock", "redis_cache", 2, 3, { ttlSeconds: 120, keyPattern: "lock:digest", sensitivity: "internal", justification: "Holds the digest scheduler lock" }, "Lock Store")
    .c("client", "gw", "sync")
    .c("gw", "api", "sync")
    .c("api", "q", "async", "enqueue")
    .c("api", "db", "data", "request state")
    .c("q", "w", "async")
    .c("q", "dlq", "async")
    .c("w", "idem", "data", "claim key")
    .c("w", "prov", "sync", "send")
    .c("w", "db", "data", "delivery state")
    .c("w", "topic", "event", "delivered")
    .c("topic", "hook", "event")
    .c("topic", "an", "event")
    .c("cron", "q", "schedule", "digest jobs")
    .c("cron", "lock", "data", "lock")
    .build();
}

// ------------------------------------------------------- payments-rewards
function payBaseline(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1)
    .n("pay", "app_service", 1, 1, { paymentLike: true }, "Payment Service")
    .n("prov", "external_service", 2, 0, { provider: "Payment provider (simulated)" }, "Payment Provider")
    .n("rew", "app_service", 2, 1, {}, "Rewards Service")
    .n("rec", "app_service", 2, 2, {}, "Receipt Service")
    .n("db", "postgres", 3, 1, {}, "Ledger DB")
    .c("client", "pay", "sync")
    .c("pay", "prov", "sync", "charge (sim)")
    .c("pay", "rew", "sync", "grant points")
    .c("pay", "rec", "sync", "send receipt")
    .c("pay", "db", "data")
    .c("rew", "db", "data")
    .build();
}
function payExample(): Architecture {
  return new Builder()
    .n("client", "client", 0, 1)
    .n("gw", "api_gateway", 1, 1, { validatesAuth: true, builtInRateLimit: true, ejectsUnhealthy: true, justification: "Authenticates callers and bounds abusive payment traffic" })
    .n("pay", "app_service", 2, 1, { instances: 3, requestTimeoutMs: 4000, paymentLike: true, healthCheck: "readiness", observability: "logs_metrics_tracing" }, "Payment Service")
    .n("hc", "health_check", 2, 0, { target: "pay" })
    .n("idem", "idempotency_store", 3, 0)
    .n("db", "postgres", 3, 2, { dataOwner: "Payment Service", backup: "point_in_time_recovery", transactionBoundary: "per_request_transaction" }, "Ledger DB")
    .n("saga", "saga", 3, 1, { compensation: "defined_per_step", persistsState: true }, "Payment Saga")
    .n("prov", "external_service", 4, 0, { provider: "Payment provider (simulated)" }, "Payment Provider")
    .n("retry", "retry_policy", 5, 0, { target: "prov", maxAttempts: 3, backoff: "exponential_jitter" })
    .n("cb", "circuit_breaker", 5, 1, { target: "prov", fallback: "none", failureThreshold: 5 })
    .n("bus", "event_bus", 4, 2, { retentionHours: 168 }, "Payment Events")
    .n("rec", "app_service", 5, 2, { requestTimeoutMs: 2000, observability: OBS }, "Receipt Service")
    .n("rew", "worker", 5, 3, { idempotentHandler: true, observability: OBS }, "Rewards Subscriber")
    .n("an", "worker", 4, 3, { idempotentHandler: true }, "Analytics Subscriber")
    .c("client", "gw", "sync")
    .c("gw", "pay", "sync")
    .c("pay", "idem", "data", "claim key")
    .c("pay", "db", "data", "ledger")
    .c("pay", "saga", "sync", "workflow")
    .c("pay", "prov", "sync", "charge (sim)")
    .c("saga", "rec", "sync", "issue receipt")
    .c("pay", "bus", "event", "payment settled")
    .c("bus", "rec", "event")
    .c("bus", "rew", "event")
    .c("bus", "an", "event")
    .build();
}

export interface Blueprint {
  baseline: () => Architecture;
  example: () => Architecture;
}

export const BLUEPRINTS: Record<string, Blueprint> = {
  "pdf-saas": { baseline: pdfBaseline, example: pdfExample },
  "ecommerce-checkout": { baseline: ecBaseline, example: ecExample },
  "realtime-collab": { baseline: rtBaseline, example: rtExample },
  "notification-platform": { baseline: ntBaseline, example: ntExample },
  "payments-rewards": { baseline: payBaseline, example: payExample },
};
