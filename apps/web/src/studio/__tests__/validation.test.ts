import { describe, expect, it } from "vitest";
import { Builder } from "../blueprints";
import { validateArchitecture, RULES } from "../validation";
import { getScenario } from "../scenarios";

const ids = (b: Builder, scenarioId?: string) => validateArchitecture(b.build(), scenarioId ? getScenario(scenarioId) : undefined).map((f) => f.ruleId);

describe("validation rules — detect problems", () => {
  it("flags a service exposed directly to clients", () => {
    expect(ids(new Builder().n("c", "client", 0, 0).n("s", "app_service", 1, 0).c("c", "s", "sync"))).toContain("exposed-direct");
  });
  it("flags a missing timeout on an external dependency, and on internal calls", () => {
    const r = ids(new Builder().n("s", "app_service", 0, 0).n("e", "external_service", 1, 0).n("a", "auth_service", 1, 1).c("s", "e", "sync").c("s", "a", "sync"));
    expect(r).toContain("missing-timeout-external");
    expect(r).toContain("missing-timeout-internal");
  });
  it("flags unbounded retries", () => {
    expect(ids(new Builder().n("e", "external_service", 0, 0).n("r", "retry_policy", 1, 0, { target: "e", maxAttempts: 0, backoff: "exponential" }))).toContain("retry-unbounded");
  });
  it("flags very high retry counts", () => {
    expect(ids(new Builder().n("e", "external_service", 0, 0).n("r", "retry_policy", 1, 0, { target: "e", maxAttempts: 25, backoff: "exponential" }))).toContain("retry-too-many");
  });
  it("flags retries without backoff, and fixed backoff more gently", () => {
    const none = validateArchitecture(new Builder().n("e", "external_service", 0, 0).n("r", "retry_policy", 1, 0, { target: "e", maxAttempts: 3, backoff: "none" }).build());
    expect(none.find((f) => f.ruleId === "retry-no-backoff")?.severity).toBe("high");
    expect(ids(new Builder().n("e", "external_service", 0, 0).n("r", "retry_policy", 1, 0, { target: "e", maxAttempts: 3, backoff: "fixed" }))).toContain("retry-fixed-backoff");
  });
  it("flags a payment-like operation without idempotency (by property or by name)", () => {
    expect(ids(new Builder().n("p", "app_service", 0, 0, { paymentLike: true }, "Ledger"))).toContain("payment-no-idempotency");
    expect(ids(new Builder().n("p", "app_service", 0, 0, {}, "Checkout Service"))).toContain("payment-no-idempotency");
    const f = validateArchitecture(new Builder().n("p", "app_service", 0, 0, { paymentLike: true }).build()).find((x) => x.ruleId === "payment-no-idempotency");
    expect(f?.severity).toBe("critical");
  });
  it("flags a queue with no consumer and one with no failure path", () => {
    const r = ids(new Builder().n("s", "app_service", 0, 0).n("q", "queue", 1, 0).c("s", "q", "async"));
    expect(r).toContain("queue-no-consumer");
    expect(r).toContain("queue-no-failure-path");
    expect(r).toContain("queue-unbounded-delivery");
  });
  it("flags a declared DLQ policy with no DLQ wired", () => {
    const f = validateArchitecture(new Builder().n("q", "queue", 0, 0, { deadLetterPolicy: "dlq", retryLimit: 3 }).build()).find((x) => x.ruleId === "queue-no-failure-path");
    expect(f?.detected).toContain("no Dead Letter Queue is connected");
  });
  it("flags duplicate cron execution risk with higher severity for several instances", () => {
    const multi = validateArchitecture(new Builder().n("c", "cron_runner", 0, 0, { instances: 3 }).build()).find((f) => f.ruleId === "cron-duplicate");
    expect(multi?.severity).toBe("high");
    const single = validateArchitecture(new Builder().n("c", "cron_runner", 0, 0, { instances: 1 }).build()).find((f) => f.ruleId === "cron-duplicate");
    expect(single?.severity).toBe("medium");
  });
  it("treats a declared lock without any store as unprotected", () => {
    expect(ids(new Builder().n("c", "cron_runner", 0, 0, { instances: 2, duplicateProtection: "distributed_lock" }))).toContain("cron-duplicate");
  });
  it("flags unclear data ownership across services", () => {
    const b = new Builder().n("a", "app_service", 0, 0, {}, "Orders").n("b", "app_service", 0, 1, {}, "Billing").n("d", "postgres", 1, 0).c("a", "d", "data").c("b", "d", "data");
    const f = validateArchitecture(b.build()).find((x) => x.ruleId === "data-ownership-unclear");
    expect(f?.severity).toBe("medium");
  });
  it("flags a cache without expiry or invalidation", () => {
    expect(ids(new Builder().n("c", "redis_cache", 0, 0))).toContain("cache-no-expiry");
  });
  it("flags sensitive cached data without a per-user key", () => {
    expect(ids(new Builder().n("c", "redis_cache", 0, 0, { ttlSeconds: 60, sensitivity: "sensitive", keyPattern: "profile" }))).toContain("cache-sensitive-key");
  });
  it("flags a critical dependency with no failure handling", () => {
    expect(ids(new Builder().n("s", "app_service", 0, 0, { requestTimeoutMs: 1000 }).n("e", "external_service", 1, 0).c("s", "e", "sync"))).toContain("critical-dependency-unhandled");
  });
  it("flags unnecessary infrastructure unless the scenario needs it or a reason is stated", () => {
    const b = () => new Builder().n("g", "saga", 0, 0, { compensation: "defined_per_step", persistsState: true });
    expect(validateArchitecture(b().build(), getScenario("realtime-collab")).some((f) => f.ruleId === "unnecessary-infrastructure")).toBe(true);
    expect(validateArchitecture(b().build(), getScenario("payments-rewards")).some((f) => f.ruleId === "unnecessary-infrastructure")).toBe(false);
    const withReason = new Builder().n("g", "saga", 0, 0, { compensation: "defined_per_step", persistsState: true, justification: "Needed for refund workflow" });
    expect(validateArchitecture(withReason.build(), getScenario("realtime-collab")).some((f) => f.ruleId === "unnecessary-infrastructure")).toBe(false);
  });
  it("flags a queue in the real-time path", () => {
    expect(ids(new Builder().n("a", "app_service", 0, 0, { transport: "websocket" }, "A").n("q", "queue", 1, 0).n("b", "app_service", 2, 0, { transport: "websocket" }, "B").c("a", "q", "async").c("q", "b", "async"))).toContain("realtime-queue");
  });
  it("flags pubsub without subscribers, sagas without compensation, 2PC blocking, policies with no target", () => {
    const r = ids(new Builder().n("t", "pubsub", 0, 0).n("s", "saga", 1, 0).n("x", "tx_coordinator", 2, 0).n("to", "timeout", 3, 0));
    expect(r).toEqual(expect.arrayContaining(["topic-no-subscriber", "saga-no-compensation", "saga-state-volatile", "tx-coordinator-blocking", "policy-no-target"]));
  });
  it("flags a load-balanced tier without a health check", () => {
    expect(ids(new Builder().n("lb", "load_balancer", 0, 0).n("s", "app_service", 1, 0, { instances: 3 }).c("lb", "s", "sync"))).toContain("lb-no-health-check");
  });
  it("every finding explains what, why, impact, topic and options with trade-offs", () => {
    const messy = new Builder()
      .n("c", "client", 0, 0).n("s", "app_service", 1, 0, { paymentLike: true }).n("e", "external_service", 2, 0).n("q", "queue", 2, 1).n("r", "redis_cache", 3, 0).n("cr", "cron_runner", 3, 1, { instances: 2 })
      .c("c", "s", "sync").c("s", "e", "sync").c("s", "q", "async");
    const fs = validateArchitecture(messy.build());
    expect(fs.length).toBeGreaterThan(5);
    for (const f of fs) {
      expect(f.detected.length).toBeGreaterThan(5);
      expect(f.why.length).toBeGreaterThan(10);
      expect(f.affects.length).toBeGreaterThan(3);
      expect(f.options.length).toBeGreaterThan(0);
      for (const o of f.options) { expect(o.fix.length).toBeGreaterThan(3); expect(o.tradeoff.length).toBeGreaterThan(3); }
      expect(f.contextNote.length).toBeGreaterThan(0);
      expect(["critical", "high", "medium", "info"]).toContain(f.severity);
    }
    // sorted most severe first
    const order = ["critical", "high", "medium", "info"];
    const idx = fs.map((f) => order.indexOf(f.severity));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });
  it("has the four required severities represented across the rule set", () => {
    const sev = new Set(RULES.map((r) => r.severity));
    expect(sev).toEqual(new Set(["critical", "high", "medium", "info"]));
  });
});

describe("validation rules — do not fail everything", () => {
  it("accepts a small, sound design with no findings above informational", () => {
    const b = new Builder()
      .n("c", "client", 0, 0).n("gw", "api_gateway", 1, 0, { validatesAuth: true, builtInRateLimit: true, justification: "Single entry for auth and limits" })
      .n("s", "app_service", 2, 0, { requestTimeoutMs: 3000, observability: "logs_metrics" }, "Notes API").n("d", "postgres", 3, 0, { dataOwner: "Notes API", backup: "daily_snapshots" })
      .c("c", "gw", "sync").c("gw", "s", "sync").c("s", "d", "data");
    const fs = validateArchitecture(b.build());
    expect(fs.filter((f) => f.severity !== "info")).toEqual([]);
  });
  it("does not flag a payment-like service that has an idempotency store", () => {
    const b = new Builder().n("p", "app_service", 0, 0, { paymentLike: true }).n("i", "idempotency_store", 1, 0).c("p", "i", "data");
    expect(ids(b)).not.toContain("payment-no-idempotency");
  });
  it("does not flag a timeout when the caller or a Timeout component provides one", () => {
    const viaCaller = new Builder().n("s", "app_service", 0, 0, { requestTimeoutMs: 2000 }).n("e", "external_service", 1, 0).c("s", "e", "sync");
    expect(ids(viaCaller)).not.toContain("missing-timeout-external");
    const viaPolicy = new Builder().n("s", "app_service", 0, 0).n("e", "external_service", 1, 0).n("t", "timeout", 1, 1, { target: "e", timeoutMs: 2000 }).c("s", "e", "sync");
    expect(ids(viaPolicy)).not.toContain("missing-timeout-external");
  });
  it("accepts a queue with consumer, DLQ, bounded delivery", () => {
    const b = new Builder().n("s", "app_service", 0, 0).n("q", "queue", 1, 0, { retryLimit: 5, deadLetterPolicy: "dlq" }).n("w", "worker", 2, 0, { idempotentHandler: true }).n("d", "dlq", 1, 1, { alerting: true })
      .c("s", "q", "async").c("q", "w", "async").c("q", "d", "async");
    const r = ids(b);
    expect(r).not.toContain("queue-no-consumer");
    expect(r).not.toContain("queue-no-failure-path");
    expect(r).not.toContain("queue-unbounded-delivery");
    expect(r).not.toContain("dlq-unwatched");
  });
  it("accepts a cache with a TTL, and a protected cron backed by a store", () => {
    expect(ids(new Builder().n("c", "redis_cache", 0, 0, { ttlSeconds: 30 }))).not.toContain("cache-no-expiry");
    const cron = new Builder().n("c", "cron_runner", 0, 0, { instances: 2, duplicateProtection: "distributed_lock" }).n("r", "redis_cache", 1, 0, { ttlSeconds: 30 }).c("c", "r", "data");
    expect(ids(cron)).not.toContain("cron-duplicate");
  });
  it("accepts a shared database with a declared single owner as informational only", () => {
    const b = new Builder().n("a", "app_service", 0, 0, {}, "Orders").n("b", "app_service", 0, 1, {}, "Billing").n("d", "postgres", 1, 0, { dataOwner: "Orders" }).c("a", "d", "data").c("b", "d", "data");
    const f = validateArchitecture(b.build()).find((x) => x.ruleId === "data-ownership-unclear");
    expect(f?.severity).toBe("info");
  });
  it("does not flag a single-instance tier for missing health checks", () => {
    expect(ids(new Builder().n("lb", "load_balancer", 0, 0).n("s", "app_service", 1, 0).c("lb", "s", "sync"))).not.toContain("lb-no-health-check");
  });
});
