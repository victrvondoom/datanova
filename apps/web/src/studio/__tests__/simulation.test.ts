import { describe, expect, it } from "vitest";
import { Builder } from "../blueprints";
import { DEFAULT_CAPACITY, FORMULAS, UNRELIABLE_WHEN, computeCapacity, fromArchitecture, sanitize, simulateQueue } from "../capacity";
import { FAILURES, compareFailureRuns, recoverPending, restoreComponent, runAllFailures, runFailure, summarizeFailures } from "../failures";

describe("capacity model", () => {
  const base = { ...DEFAULT_CAPACITY };
  it("traffic input changes modelled load and utilization", () => {
    const low = computeCapacity({ ...base, peakRps: 100 });
    const high = computeCapacity({ ...base, peakRps: 400 });
    expect(low.peak.utilization).toBeCloseTo(100 / (2 * 80), 5);
    expect(high.peak.utilization).toBeCloseTo(400 / (2 * 80), 5);
    expect(high.peak.status).toBe("overloaded");
    expect(low.peak.status).toBe("comfortable");
  });
  it("instance count changes utilization (documented formula)", () => {
    expect(computeCapacity({ ...base, instances: 4 }).peak.utilization).toBeCloseTo(base.peakRps / (4 * base.perInstanceRps), 5);
  });
  it("cache hit rate changes database load", () => {
    const cold = computeCapacity({ ...base, cacheHitRate: 0 });
    const warm = computeCapacity({ ...base, cacheHitRate: 0.9 });
    expect(warm.peak.dbLoad).toBeLessThan(cold.peak.dbLoad);
    expect(warm.peak.cacheHits).toBeCloseTo(base.peakRps * base.readShare * 0.9, 5);
    expect(warm.peak.cacheHits + warm.peak.cacheMisses).toBeCloseTo(base.peakRps * base.readShare, 5);
    expect(computeCapacity({ ...base, hasCache: false, cacheHitRate: 0.9 }).peak.cacheHits).toBe(0);
  });
  it("worker rate changes queue depth and drain", () => {
    const slow = simulateQueue(sanitize({ ...base, workers: 1, workerRatePerSec: 0.5 }));
    const fast = simulateQueue(sanitize({ ...base, workers: 4, workerRatePerSec: 6 }));
    expect(slow.maxDepth).toBeGreaterThan(fast.maxDepth);
    expect(fast.depthAtPeakEnd).toBe(0);
    expect(slow.secondsToDrainAfterPeak === null || slow.secondsToDrainAfterPeak > 0).toBe(true);
  });
  it("queue grows when arrival exceeds drain and never drains if workers are slower than steady arrivals", () => {
    const q = simulateQueue(sanitize({ ...base, jobArrivalRate: 5, workers: 1, workerRatePerSec: 1 }));
    expect(q.secondsToDrainAfterPeak).toBeNull();
    expect(q.workerUtilizationAvg).toBeGreaterThan(1);
    const noWorkers = computeCapacity({ ...base, workers: 0 });
    expect(noWorkers.warnings.join(" ")).toContain("no workers");
  });
  it("queue drains after a peak when workers out-pace steady arrivals", () => {
    const q = simulateQueue(sanitize({ ...base, jobArrivalRate: 1, peakRps: 100, avgRps: 20, workers: 2, workerRatePerSec: 1.5, peakDurationSec: 60 }));
    expect(q.depthAtPeakEnd).toBeGreaterThan(0);
    expect(q.secondsToDrainAfterPeak).not.toBeNull();
  });
  it("sanitizes invalid input and never returns NaN", () => {
    const r = computeCapacity({ ...base, avgRps: Number.NaN, peakRps: -5, instances: 0, cacheHitRate: 7 });
    expect(Number.isNaN(r.peak.dbLoad)).toBe(false);
    expect(r.peak.status).toBe("comfortable");
    expect(sanitize({ ...base, cacheHitRate: 7 }).cacheHitRate).toBe(1);
  });
  it("derives inputs from the architecture", () => {
    const a = new Builder().n("s", "app_service", 0, 0, { instances: 5, capacityRps: 100 }).n("w", "worker", 1, 0, { instances: 3, processingRatePerSec: 4 }).build();
    const c = fromArchitecture(a, base);
    expect(c.instances).toBe(5);
    expect(c.perInstanceRps).toBe(100);
    expect(c.workers).toBe(3);
    expect(c.workerRatePerSec).toBe(4);
    expect(c.hasCache).toBe(false);
  });
  it("documents every formula and the conditions under which it is unreliable", () => {
    expect(FORMULAS.length).toBeGreaterThanOrEqual(8);
    for (const f of FORMULAS) { expect(f.formula).toContain("="); expect(f.units.length).toBeGreaterThan(0); expect(f.note.length).toBeGreaterThan(10); }
    expect(UNRELIABLE_WHEN.length).toBeGreaterThan(3);
  });
});

/* ------------------------------------------------------------------ failures */

const callChain = (callerProps: Record<string, string | number | boolean> = {}) =>
  new Builder().n("c", "client", 0, 0).n("gw", "api_gateway", 1, 0).n("s", "app_service", 2, 0, callerProps, "API").n("e", "external_service", 3, 0).c("c", "gw", "sync").c("gw", "s", "sync").c("s", "e", "sync");

describe("failure injection — structural outcomes", () => {
  it("covers at least the twelve required failures", () => {
    expect(FAILURES.map((f) => f.id)).toHaveLength(12);
  });

  it("503 with no protection fails every request; a bounded retry with backoff recovers transient errors only if they are transient (here sustained)", () => {
    const none = runFailure(callChain().build(), "api-503");
    expect(none.stats.failed).toBe(none.stats.total);
    expect(none.outcome).toBe("failed");
    expect(none.protections.find((p) => p.name === "Timeout")?.active).toBe(false);
  });

  it("retry limits are respected: attempts never exceed maxAttempts", () => {
    const b = callChain({ requestTimeoutMs: 2000 }).n("r", "retry_policy", 4, 0, { target: "e", maxAttempts: 3, backoff: "exponential" });
    const r = runFailure(b.build(), "api-503");
    expect(r.stats.retries).toBeLessThanOrEqual(r.stats.total * 2); // 3 attempts = 2 retries per request
    expect(r.stats.retries).toBe(r.stats.total * 2);
    expect(r.stats.amplification).toBeCloseTo(3, 0);
  });

  it("unbounded retries are capped by the model but flagged as amplifying without backoff", () => {
    const b = callChain({ requestTimeoutMs: 2000 }).n("r", "retry_policy", 4, 0, { target: "e", maxAttempts: 5, backoff: "none" });
    const r = runFailure(b.build(), "api-503");
    expect(r.stats.amplification).toBeGreaterThanOrEqual(3);
    expect(r.propagates).toBe(true);
    expect(r.propagationNote).toContain("retry storm");
  });

  it("timeouts change outcomes: a hung dependency without a timeout saturates the caller; with a timeout it is contained", () => {
    const without = runFailure(callChain().build(), "api-timeout");
    expect(without.stats.hung).toBe(without.stats.total);
    expect(without.propagates).toBe(true);
    expect(without.propagationNote).toContain("never released");
    const withTo = runFailure(callChain({ requestTimeoutMs: 1000 }).build(), "api-timeout", {}, { ...DEFAULT_CAPACITY, peakRps: 5 });
    expect(withTo.stats.hung).toBe(0);
    expect(withTo.propagates).toBe(false);
    expect(withTo.stats.failed).toBe(withTo.stats.total);
  });

  it("a circuit breaker changes dependency behavior: fast-fails and serves the fallback", () => {
    const plain = runFailure(callChain({ requestTimeoutMs: 1000 }).build(), "api-503");
    const b = callChain({ requestTimeoutMs: 1000 }).n("cb", "circuit_breaker", 4, 0, { target: "e", failureThreshold: 3, openSeconds: 30, fallback: "cached_response" });
    const guarded = runFailure(b.build(), "api-503");
    expect(guarded.stats.fastFailed).toBeGreaterThan(0);
    expect(guarded.stats.degraded).toBeGreaterThan(0);
    expect(guarded.stats.failed).toBeLessThan(plain.stats.failed);
    expect(guarded.protections.find((p) => p.name === "Circuit breaker")?.active).toBe(true);
    // without a fallback the breaker still fast-fails but does not hide the error
    const noFb = callChain({ requestTimeoutMs: 1000 }).n("cb", "circuit_breaker", 4, 0, { target: "e", failureThreshold: 3, fallback: "none" });
    const nf = runFailure(noFb.build(), "api-503");
    expect(nf.stats.fastFailed).toBeGreaterThan(0);
    expect(nf.stats.degraded).toBe(0);
  });

  it("a sustained dependency outage reports breaker probes and wasted calls", () => {
    const b = callChain({ requestTimeoutMs: 1000 }).n("cb", "circuit_breaker", 4, 0, { target: "e", failureThreshold: 3, openSeconds: 10, fallback: "degrade_feature" });
    const r = runFailure(b.build(), "dependency-unhealthy");
    expect(r.stats.total).toBe(60);
    expect(r.stats.fastFailed).toBeGreaterThan(30);
    expect(r.steps.some((s) => s.text.includes("half-open"))).toBe(true);
  });

  it("returns not-applicable (not a fake pass) when the architecture has nothing for the failure to hit", () => {
    const r = runFailure(new Builder().n("c", "client", 0, 0).build(), "api-503");
    expect(r.applicable).toBe(false);
    expect(r.outcome).toBe("not_applicable");
  });

  it("a single instance crash is an outage; multiple instances with a health-checked balancer contain it", () => {
    const single = runFailure(new Builder().n("c", "client", 0, 0).n("s", "app_service", 1, 0).c("c", "s", "sync").build(), "instance-crash");
    expect(single.outcome).toBe("failed");
    expect(single.stats.failed).toBe(single.stats.total);
    const noHc = new Builder().n("c", "client", 0, 0).n("lb", "load_balancer", 1, 0).n("s", "app_service", 2, 0, { instances: 3 }).c("c", "lb", "sync").c("lb", "s", "sync");
    const r1 = runFailure(noHc.build(), "instance-crash", {}, { ...DEFAULT_CAPACITY, peakRps: 50 });
    expect(r1.stats.failed).toBeGreaterThan(1);
    const withHc = new Builder().n("c", "client", 0, 0).n("lb", "load_balancer", 1, 0, { ejectsUnhealthy: true }).n("s", "app_service", 2, 0, { instances: 3 }).n("h", "health_check", 2, 1, { target: "s" }).c("c", "lb", "sync").c("lb", "s", "sync");
    const r2 = runFailure(withHc.build(), "instance-crash", {}, { ...DEFAULT_CAPACITY, peakRps: 50 });
    expect(r2.stats.failed).toBe(1);
    expect(r2.stats.failed).toBeLessThan(r1.stats.failed);
  });

  it("losing an instance at peak can overload the survivors", () => {
    const b = new Builder().n("c", "client", 0, 0).n("lb", "load_balancer", 1, 0, { ejectsUnhealthy: true }).n("s", "app_service", 2, 0, { instances: 2 }).n("h", "health_check", 2, 1, { target: "s" }).c("c", "lb", "sync").c("lb", "s", "sync");
    const r = runFailure(b.build(), "instance-crash", {}, { ...DEFAULT_CAPACITY, peakRps: 500, perInstanceRps: 100 });
    expect(r.propagates).toBe(true);
    expect(r.outcome).not.toBe("handled");
  });

  it("a slow database: cache absorbs reads, timeouts bound waiting", () => {
    const noCache = new Builder().n("s", "app_service", 0, 0).n("d", "postgres", 1, 0).c("s", "d", "data");
    const withCache = new Builder().n("s", "app_service", 0, 0).n("d", "postgres", 1, 0).n("r", "redis_cache", 1, 1, { ttlSeconds: 60 }).c("s", "d", "data").c("s", "r", "data");
    const a = runFailure(noCache.build(), "db-slow");
    const b = runFailure(withCache.build(), "db-slow");
    expect(b.stats.ok - b.stats.slow).toBeGreaterThan(a.stats.ok - a.stats.slow);
    const timed = new Builder().n("s", "app_service", 0, 0, { requestTimeoutMs: 1000 }).n("d", "postgres", 1, 0).c("s", "d", "data");
    const t = runFailure(timed.build(), "db-slow", { latencyMs: 4000 });
    expect(t.stats.failed).toBe(t.stats.total);
    expect(a.stats.failed).toBe(0);
    expect(a.stats.slow).toBeGreaterThan(0);
  });

  it("cache loss raises database load and cascades unless load is shed", () => {
    const hot = { ...DEFAULT_CAPACITY, peakRps: 800, dbCapacityOps: 500, readShare: 0.9, cacheHitRate: 0.9 };
    const base = () => new Builder().n("s", "app_service", 0, 0).n("r", "redis_cache", 1, 0, { ttlSeconds: 60 }).n("d", "postgres", 1, 1, { capacityOps: 500 }).c("s", "r", "data").c("s", "d", "data");
    const bare = runFailure(base().build(), "cache-down", {}, hot);
    expect(bare.propagates).toBe(true);
    expect(bare.stats.failed).toBeGreaterThan(0);
    const shed = runFailure(base().n("rl", "rate_limiter", 2, 0).build(), "cache-down", {}, hot);
    expect(shed.stats.failed).toBe(0);
    expect(shed.stats.degraded).toBeGreaterThan(0);
  });

  it("a crashed queue consumer: redelivery only with a visibility timeout; backlog grows with no consumer left", () => {
    const mk = (vis: number, instances: number) => new Builder().n("s", "app_service", 0, 0).n("q", "queue", 1, 0, { visibilityTimeoutSec: vis, retryLimit: 3, deadLetterPolicy: "dlq" }).n("w", "worker", 2, 0, { instances }).c("s", "q", "async").c("q", "w", "async");
    const lost = runFailure(mk(0, 1).build(), "consumer-crash");
    expect(lost.outcome).toBe("data_risk");
    const redelivered = runFailure(mk(30, 1).build(), "consumer-crash");
    expect(redelivered.outcome).not.toBe("data_risk");
    expect(redelivered.stats.failed).toBe(1); // no consumer remains
    expect(redelivered.series.at(-1)?.[1]).toBeGreaterThan(0);
    const survivors = runFailure(mk(30, 6).build(), "consumer-crash", {}, { ...DEFAULT_CAPACITY, jobArrivalRate: 1, workerRatePerSec: 1 });
    expect(survivors.outcome).toBe("handled");
    const noQueue = runFailure(new Builder().n("w", "worker", 0, 0).build(), "consumer-crash");
    expect(noQueue.applicable).toBe(false);
  });

  it("queue backlog grows when arrival exceeds drain; a bounded queue sheds instead", () => {
    const mk = (maxDepth: number) => new Builder().n("s", "app_service", 0, 0).n("q", "queue", 1, 0, { maxDepth }).n("w", "worker", 2, 0, { processingRatePerSec: 1 }).c("s", "q", "async").c("q", "w", "async");
    const cap = { ...DEFAULT_CAPACITY, jobArrivalRate: 1, peakDurationSec: 120 };
    const unb = runFailure(mk(0).build(), "backlog-growth", { multiplier: 5 }, cap);
    expect(unb.series.length).toBeGreaterThan(2);
    expect(unb.stats.slow + unb.stats.failed).toBeGreaterThan(0);
    const bounded = runFailure(mk(50).build(), "backlog-growth", { multiplier: 5 }, cap);
    expect(bounded.stats.degraded).toBeGreaterThan(0);
    const small = runFailure(mk(0).build(), "backlog-growth", { multiplier: 1 }, { ...cap, jobArrivalRate: 0.2 });
    expect(small.outcome).toBe("handled");
  });

  it("DLQ receives repeatedly failing jobs; without a DLQ the job vanishes; unbounded retry loops forever", () => {
    const withDlq = new Builder().n("q", "queue", 0, 0, { retryLimit: 3, deadLetterPolicy: "dlq" }).n("w", "worker", 1, 0).n("d", "dlq", 0, 1, { alerting: true }).c("q", "w", "async").c("q", "d", "async");
    const ok = runFailure(withDlq.build(), "poison-job");
    expect(ok.outcome).toBe("handled");
    expect(ok.pending.count).toBe(1);
    expect(ok.steps.some((s) => s.text.includes("moves to"))).toBe(true);
    const silent = new Builder().n("q", "queue", 0, 0, { retryLimit: 3, deadLetterPolicy: "dlq" }).n("w", "worker", 1, 0).n("d", "dlq", 0, 1, { alerting: false }).c("q", "w", "async").c("q", "d", "async");
    expect(runFailure(silent.build(), "poison-job").outcome).toBe("degraded");
    const noDlq = new Builder().n("q", "queue", 0, 0, { retryLimit: 3 }).n("w", "worker", 1, 0).c("q", "w", "async");
    expect(runFailure(noDlq.build(), "poison-job").outcome).toBe("data_risk");
    const loop = new Builder().n("q", "queue", 0, 0, { retryLimit: 0 }).n("w", "worker", 1, 0).c("q", "w", "async");
    const l = runFailure(loop.build(), "poison-job");
    expect(l.outcome).toBe("failed");
    expect(l.propagates).toBe(true);
  });

  it("idempotency prevents duplicate simulated operations; absence or a non-atomic claim does not", () => {
    const store = (atomic: boolean) => new Builder().n("p", "app_service", 0, 0, { paymentLike: true }, "Billing").n("i", "idempotency_store", 1, 0, { atomicClaim: atomic }).c("p", "i", "data");
    const ok = runFailure(store(true).build(), "duplicate-payment", { copies: 3 });
    expect(ok.stats.duplicatesExecuted).toBe(0);
    expect(ok.stats.duplicatesPrevented).toBe(2);
    expect(ok.outcome).toBe("handled");
    const racy = runFailure(store(false).build(), "duplicate-payment", { copies: 3 });
    expect(racy.stats.duplicatesExecuted).toBe(2);
    expect(racy.outcome).toBe("data_risk");
    const none = runFailure(new Builder().n("p", "app_service", 0, 0, { paymentLike: true }, "Billing").build(), "duplicate-payment", { copies: 2 });
    expect(none.stats.duplicatesExecuted).toBe(1);
    expect(none.outcome).toBe("data_risk");
  });

  it("scheduled-task duplication: real protection runs once; declared-but-unbacked protection does not", () => {
    const run = (b: Builder) => runFailure(b.build(), "cron-multi");
    expect(run(new Builder().n("c", "cron_runner", 0, 0, { instances: 3 })).stats.duplicatesExecuted).toBe(2);
    expect(run(new Builder().n("c", "cron_runner", 0, 0, { instances: 3, duplicateProtection: "distributed_lock" })).stats.duplicatesExecuted).toBe(2); // no store
    const real = run(new Builder().n("c", "cron_runner", 0, 0, { instances: 3, duplicateProtection: "distributed_lock" }).n("r", "redis_cache", 1, 0, { ttlSeconds: 30 }).c("c", "r", "data"));
    expect(real.stats.duplicatesExecuted).toBe(0);
    expect(real.outcome).toBe("handled");
    expect(run(new Builder().n("c", "cron_runner", 0, 0, { instances: 1 })).outcome).toBe("handled");
  });

  it("subscriber outage: retention preserves events; without it they are lost; publishers stay isolated", () => {
    const mk = (retention: number) => new Builder().n("p", "app_service", 0, 0, {}, "Orders").n("t", "pubsub", 1, 0, { retentionHours: retention }).n("s", "worker", 2, 0, {}, "Rewards").c("p", "t", "event").c("t", "s", "event");
    const kept = runFailure(mk(24).build(), "subscriber-down", {}, { ...DEFAULT_CAPACITY, jobArrivalRate: 2 });
    expect(kept.outcome).toBe("degraded");
    expect(kept.pending.count).toBe(120);
    expect(kept.pending.durable).toBe(true);
    const lost = runFailure(mk(0).build(), "subscriber-down");
    expect(lost.outcome).toBe("data_risk");
    expect(lost.protections.find((p) => p.name === "Publisher isolation")?.active).toBe(true);
    const coupled = mk(24).c("p", "s", "sync");
    expect(runFailure(coupled.build(), "subscriber-down").propagates).toBe(true);
  });

  it("a failure trace names affected components, edges and a final explanation", () => {
    const r = runFailure(callChain({ requestTimeoutMs: 1000 }).build(), "api-503");
    expect(r.steps.length).toBeGreaterThan(2);
    expect(r.steps[0].kind).toBe("trigger");
    expect(Object.values(r.nodeStates).some((s) => s === "failed")).toBe(true);
    expect(Object.values(r.edgeStates).length).toBeGreaterThan(0);
    expect(r.explanation.length).toBeGreaterThan(10);
    expect(r.missing.length).toBeGreaterThan(0);
  });
});

describe("recovery only happens when the mechanism exists", () => {
  it("restoring a component does not resurrect failed synchronous requests", () => {
    const a = callChain({ requestTimeoutMs: 1000 }).build();
    const res = runFailure(a, "api-503");
    const rest = restoreComponent(a, res);
    expect(rest.restored).toBe(true);
    expect(rest.nodeStates[res.targetId as string]).toBe("recovered");
    const rec = recoverPending(res, true);
    expect(rec.recovered).toBe(0);
    expect(rec.note).toContain("not replayed");
  });

  it("recovery of queued work needs the component restored first", () => {
    const a = new Builder().n("s", "app_service", 0, 0).n("q", "queue", 1, 0, { visibilityTimeoutSec: 30, retryLimit: 3, deadLetterPolicy: "dlq" }).n("w", "worker", 2, 0).c("s", "q", "async").c("q", "w", "async").build();
    const res = runFailure(a, "consumer-crash");
    const early = recoverPending(res, false);
    expect(early.recovered).toBe(0);
    const done = recoverPending(res, true);
    expect(done.recovered).toBe(res.pending.count);
    expect(done.recovered).toBeGreaterThan(0);
  });

  it("a non-durable queue cannot recover its backlog", () => {
    const a = new Builder().n("s", "app_service", 0, 0).n("q", "queue", 1, 0, { durable: false, visibilityTimeoutSec: 30, retryLimit: 3 }).n("w", "worker", 2, 0).c("s", "q", "async").c("q", "w", "async").build();
    const rec = recoverPending(runFailure(a, "consumer-crash"), true);
    expect(rec.recovered).toBe(0);
    expect(rec.lost).toBeGreaterThan(0);
  });

  it("redriving a poison job does not pretend to fix it", () => {
    const a = new Builder().n("q", "queue", 0, 0, { retryLimit: 3, deadLetterPolicy: "dlq" }).n("w", "worker", 1, 0).n("d", "dlq", 0, 1, { alerting: true }).c("q", "w", "async").c("q", "d", "async").build();
    const rec = recoverPending(runFailure(a, "poison-job"), true);
    expect(rec.recovered).toBe(0);
    expect(rec.note).toContain("fails again");
  });

  it("event retention enables replay of missed events", () => {
    const a = new Builder().n("p", "app_service", 0, 0).n("t", "pubsub", 1, 0, { retentionHours: 12 }).n("s", "worker", 2, 0).c("p", "t", "event").c("t", "s", "event").build();
    const res = runFailure(a, "subscriber-down");
    expect(recoverPending(res, true).recovered).toBe(res.pending.count);
  });
});

describe("before/after comparison and aggregate runs", () => {
  it("improving the architecture changes failure outcomes", () => {
    const before = callChain().build();
    const after = callChain({ requestTimeoutMs: 1000 }).n("cb", "circuit_breaker", 4, 0, { target: "e", failureThreshold: 3, fallback: "degrade_feature" }).build();
    const rows = compareFailureRuns(before, after, { ...DEFAULT_CAPACITY, peakRps: 5 });
    const row = rows.find((r) => r.failureId === "api-503");
    expect(row?.before).toBe("failed");
    expect(row?.after).not.toBe("failed");
    expect(row?.changed).toBe(true);
  });
  it("runAllFailures returns one result per failure and summarises survived vs unhandled", () => {
    const res = runAllFailures(callChain().build());
    expect(res).toHaveLength(12);
    const s = summarizeFailures(res);
    expect(s.survived.length + s.notHandled.length + s.notApplicable.length).toBe(12);
    expect(s.notApplicable.length).toBeGreaterThan(0);
  });
});
