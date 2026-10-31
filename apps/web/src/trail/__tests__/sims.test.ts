/**
 * Simulation behavior tests: each test drives the REAL simulation logic and
 * asserts the actual behavior the topic teaches — token consumption and
 * refill, cache hit/miss transitions, LB failover, gateway routing, CI
 * gating, docker image/container state, kube self-healing, service
 * discovery resolution, circuit-breaker opening, timeout math, retry limits,
 * exponential backoff + jitter, idempotent payment retry, queue retry and
 * DLQ movement, pub/sub isolation, event trace propagation, 2PC partial
 * failure, saga compensation, and cron duplicate prevention.
 */
import { describe, expect, it } from "vitest";
import * as L from "../sims/logic";

describe("01 token bucket", () => {
  it("consumes tokens and refills over time", () => {
    let b = L.makeBucket(100, 10);
    for (let i = 0; i < 60; i++) {
      b = L.bucketRequest(b).bucket;
    }
    expect(b.tokens).toBeCloseTo(40, 5);
    expect(b.accepted).toBe(60);
    b = L.refillBucket(b, 2); // 2s at 10/s
    expect(b.tokens).toBeCloseTo(60, 5);
  });

  it("rejects with 429 and a retry-after when empty", () => {
    let b = L.makeBucket(2, 1);
    b = L.bucketRequest(b).bucket;
    b = L.bucketRequest(b).bucket;
    const r = L.bucketRequest(b);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(429);
    expect(r.retryAfterSeconds).toBeCloseTo(1, 5);
    expect(r.bucket.rejected).toBe(1);
  });
});

describe("02 caching", () => {
  it("misses then hits, and populates the cache on the miss", () => {
    let s = L.makeCacheState();
    s = L.cacheRead(s, "user:123");
    expect(s.misses).toBe(1);
    expect(s.dbQueries).toBe(1);
    expect(s.cache["user:123"].version).toBe(1);
    s = L.cacheRead(s, "user:123");
    expect(s.hits).toBe(1);
    expect(s.dbQueries).toBe(1); // hit didn't touch the DB
  });

  it("serves stale data after a DB update until TTL/refresh", () => {
    let s = L.makeCacheState();
    s = L.cacheRead(s, "user:123");
    s = L.dbUpdate(s, "user:123", "bio v2");
    s = L.cacheRead(s, "user:123");
    expect(s.hits).toBe(1);
    expect(s.dbQueries).toBe(1); // the stale hit avoided the DB…
    expect(s.cache["user:123"].version).toBe(1); // …but served the OLD version (stale — the bug the topic teaches)
    s = L.forceRefresh(s, "user:123");
    expect(s.cache["user:123"].version).toBe(2);
  });

  it("expires keys via TTL", () => {
    let s = L.makeCacheState();
    s = L.cacheRead(s, "user:123");
    s = L.tickCacheTtl(s, 60);
    expect(s.cache["user:123"]).toBeUndefined();
    s = L.cacheRead(s, "user:123");
    expect(s.misses).toBe(2);
  });
});

describe("03 load balancer", () => {
  it("round-robins across healthy servers", () => {
    let servers = L.makeLbServers();
    const targets: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = L.lbRoute(servers, i);
      servers = r.servers;
      targets.push(r.target!.name);
    }
    expect(targets).toEqual(["Node 1", "Node 2", "Node 3", "Node 1", "Node 2", "Node 3"]);
  });

  it("stops routing to unhealthy servers and returns 503 when all die", () => {
    let servers = L.makeLbServers();
    servers = L.toggleServer(servers, "Node 2");
    const r = L.lbRoute(servers, 1);
    expect(r.target!.name).not.toBe("Node 2");
    expect(r.status).toBe(200);
    servers = L.toggleServer(servers, "Node 1");
    servers = L.toggleServer(servers, "Node 3");
    const dead = L.lbRoute(servers, 0);
    expect(dead.target).toBeNull();
    expect(dead.status).toBe(503);
  });
});

describe("05 api gateway", () => {
  it("rejects invalid JWT and rate-limit excess before reaching services", () => {
    const route = L.GATEWAY_ROUTES[0];
    const bad = L.gatewayHandle(route, false, false, false, false);
    expect(bad.status).toBe(401);
    expect(bad.reachedService).toBe(false);
    const limited = L.gatewayHandle(route, true, true, false, false);
    expect(limited.status).toBe(429);
    expect(limited.reachedService).toBe(false);
  });

  it("routes to the right service, reports downstream failures, and fails as SPOF", () => {
    const ok = L.gatewayHandle(L.GATEWAY_ROUTES[1], true, false, false, false);
    expect(ok.status).toBe(200);
    expect(ok.route!.service).toBe("Billing Service");
    expect(ok.reachedService).toBe(true);
    const down = L.gatewayHandle(L.GATEWAY_ROUTES[2], true, false, true, false);
    expect(down.status).toBe(503);
    const spof = L.gatewayHandle(L.GATEWAY_ROUTES[0], true, false, false, true);
    expect(spof.status).toBe(502);
  });
});

describe("06 ci/cd", () => {
  it("deploys only when everything passes", () => {
    let p = L.makePipeline();
    p = L.runPipeline(p);
    expect(p.stage).toBe("deploy");
    expect(p.deploys).toBe(1);
  });

  it("skips deployment when a test fails", () => {
    let p = { ...L.makePipeline(), injectFailingTest: true };
    p = L.runPipeline(p);
    expect(p.stage).toBe("deploy-skipped");
    expect(p.deploys).toBe(0);
  });

  it("fails on build errors before tests run", () => {
    let p = { ...L.makePipeline(), injectBuildError: true };
    p = L.runPipeline(p);
    expect(p.stage).toBe("failed");
    expect(p.deploys).toBe(0);
  });
});

describe("07 docker", () => {
  it("distinguishes images from running containers", () => {
    let d = L.makeDockerState();
    expect(d.images).toBe(0);
    d = L.dockerBuild(d);
    expect(d.images).toBe(1);
    d = L.dockerRun(d);
    d = L.dockerRun(d);
    expect(d.containers).toHaveLength(2);
    expect(d.containers.filter((c) => c.running)).toHaveLength(2);
    d = L.dockerStop(d, "c1");
    expect(d.containers.find((c) => c.id === "c1")!.running).toBe(false);
    expect(d.images).toBe(1); // image survives container stop
  });

  it("cannot run containers without an image", () => {
    const d = L.dockerRun(L.makeDockerState());
    expect(d.containers).toHaveLength(0);
  });
});

describe("08 kubernetes", () => {
  it("self-heals a crashed pod back to the desired state", () => {
    let k = L.makeKubeState(3);
    k = L.kubeCrashRandomPod(k, "pod-1");
    expect(k.pods.filter((p) => p.phase === "Running")).toHaveLength(2);
    k = L.kubeReconcile(k);
    expect(k.pods.filter((p) => p.phase === "Running")).toHaveLength(3);
    expect(k.events.some((e) => e.includes("desired state restored"))).toBe(true);
  });

  it("scales up and down to match the desired replica count", () => {
    let k = L.makeKubeState(3);
    k = L.kubeSetDesired(k, 5);
    k = L.kubeReconcile(k);
    expect(k.pods).toHaveLength(5);
    k = L.kubeSetDesired(k, 2);
    k = L.kubeReconcile(k);
    expect(k.pods).toHaveLength(2);
  });

  it("bounds the desired count to a sane range", () => {
    const k = L.kubeSetDesired(L.makeKubeState(), 99);
    expect(k.desired).toBe(8);
  });
});

describe("09 service discovery", () => {
  it("stale direct IPs fail; service names always resolve to the current IP", () => {
    let d = L.makeDiscoveryState();
    const oldIp = d.currentIp;
    d = L.discoveryRestartPod(d, "10.0.9.99");
    d = L.discoveryCallDirectIp(d, oldIp);
    expect(d.directCallResult).toBe("stale-ip-fail");
    d = L.discoveryCallServiceName(d);
    expect(d.serviceCallResult).toBe("ok");
    expect(d.resolvedIp).toBe("10.0.9.99");
  });
});

describe("10 circuit breaker", () => {
  it("opens after the failure threshold and fast-fails without calling downstream", () => {
    let b = L.makeBreaker(5);
    for (let i = 0; i < 4; i++) {
      const r = L.breakerCall(b, false);
      b = r.breaker;
      expect(r.outcome).toBe("slow-fail");
    }
    expect(b.state).toBe("closed");
    const trip = L.breakerCall(b, false);
    b = trip.breaker;
    expect(b.state).toBe("open");
    const r2 = L.breakerCall(b, true);
    expect(r2.outcome).toBe("fast-fail");
    expect(r2.breaker.state).toBe("open"); // half-open? no: still open, service NOT called
    expect(r2.breaker.fastFails).toBe(1);
  });

  it("half-opens after cooldown and closes on success", () => {
    let b = L.makeBreaker(2, 5);
    b = L.breakerCall(b, false).breaker;
    b = L.breakerCall(b, false).breaker;
    expect(b.state).toBe("open");
    b = L.breakerTickCooldown(b, 5);
    expect(b.state).toBe("half-open");
    const r = L.breakerCall(b, true);
    expect(r.breaker.state).toBe("closed");
    expect(r.outcome).toBe("success");
  });
});

describe("11 timeouts", () => {
  it("succeeds inside the deadline and fails fast beyond it", () => {
    const ok = L.timeoutCall(2000, 200);
    expect(ok.ok).toBe(true);
    expect(ok.waitedMs).toBe(200);
    const late = L.timeoutCall(2000, 4000);
    expect(late.ok).toBe(false);
    expect(late.waitedMs).toBe(2000); // bounded wait, not 4000
  });
});

describe("12 retries", () => {
  it("retries transient 5xx and network errors, never client errors", () => {
    expect(L.isRetryable(503)).toBe(true);
    expect(L.isRetryable(-1)).toBe(true);
    expect(L.isRetryable(400)).toBe(false);
    expect(L.isRetryable(401)).toBe(false);
    const d = L.retryStep(1, 3, 400);
    expect(d.action).toBe("fail");
    const r = L.retryStep(1, 3, 503);
    expect(r.action).toBe("retry");
  });

  it("stops after the maximum attempts", () => {
    const d = L.retryStep(3, 3, 503);
    expect(d.action).toBe("fail");
    expect(d.reason).toContain("Max attempts");
  });
});

describe("13 exponential backoff", () => {
  it("grows exponentially and jitter stays bounded", () => {
    const noJitter = (a: number) => L.backoffDelay(a, 1000, 0, () => 0.5);
    expect([noJitter(1), noJitter(2), noJitter(3), noJitter(4)]).toEqual([1000, 2000, 4000, 8000]);
    for (let i = 0; i < 100; i++) {
      const d = L.backoffDelay(3, 1000, 0.25, Math.random);
      expect(d).toBeGreaterThanOrEqual(4000 - 1000);
      expect(d).toBeLessThanOrEqual(4000 + 1000);
    }
  });

  it("shows synchronized waves without jitter vs decorrelated with jitter", () => {
    const waves = L.synchronizedWaves(3, 100);
    expect(waves.map((w) => w.t)).toEqual([0, 1, 3]);
    expect(waves[0].clients).toBe(100);
    const jittered = L.jitteredWave(3, 100, () => 0.5);
    expect(jittered).toHaveLength(100);
    expect(jittered.every((w) => w.clients === 1)).toBe(true);
  });
});

describe("14 idempotency", () => {
  it("double-charges without a key and charges exactly once with one", () => {
    let bad = L.makeIdempotencyState(250);
    bad = L.charge(bad, { amount: 50 }, false);
    bad = L.charge(bad, { amount: 50 }, true);
    expect(bad.balance).toBe(150);
    expect(bad.charges).toBe(2);

    let good = L.makeIdempotencyState(250);
    good = L.charge(good, { amount: 50, idempotencyKey: "k1" }, false);
    good = L.charge(good, { amount: 50, idempotencyKey: "k1" }, true);
    expect(good.balance).toBe(200);
    expect(good.charges).toBe(1);
    expect(good.processedKeys.get("k1")).toBe("charged $50");
  });
});

describe("15 queues & DLQ", () => {
  it("processes jobs when the API is up", () => {
    let q = L.makeQueueSystem();
    q = L.enqueueJob(q, "welcome_email");
    q = L.queueTick(q);
    expect(q.processed).toBe(1);
    expect(q.jobs[0].state).toBe("done");
  });

  it("retries failed jobs and moves them to the DLQ after 3 failures", () => {
    let q = { ...L.makeQueueSystem(), emailApiUp: false };
    q = L.enqueueJob(q, "welcome_email");
    q = L.queueTick(q);
    expect(q.jobs[0].state).toBe("queued");
    expect(q.jobs[0].attempts).toBe(1);
    q = L.queueTick(q);
    expect(q.jobs[0].state).toBe("queued");
    q = L.queueTick(q);
    expect(q.jobs[0].state).toBe("dlq");
    expect(q.dlqCount).toBe(1);
    expect(q.processed).toBe(0);
  });

  it("does not process anything with no workers online", () => {
    let q = { ...L.makeQueueSystem(), workersOnline: 0 };
    q = L.enqueueJob(q, "pdf_report");
    q = L.queueTick(q);
    expect(q.jobs[0].state).toBe("queued");
  });
});

describe("16 pub/sub", () => {
  it("broadcasts to all online subscribers and holds events for offline ones", () => {
    let ps = L.makePubSub();
    ps = L.toggleSubscriber(ps, "Analytics");
    ps = L.publishEvent(ps, "order_created");
    expect(ps.published).toBe(1);
    const inv = ps.subscribers.find((s) => s.name === "Inventory")!;
    const bill = ps.subscribers.find((s) => s.name === "Billing")!;
    const ana = ps.subscribers.find((s) => s.name === "Analytics")!;
    expect(inv.received).toBe(1);
    expect(bill.received).toBe(1);
    expect(ana.received).toBe(0);
    expect(ana.backlog).toBe(1);
  });

  it("drains the backlog when a subscriber recovers — failure isolation", () => {
    let ps = L.makePubSub();
    ps = L.toggleSubscriber(ps, "Analytics");
    ps = L.publishEvent(ps, "order_created");
    ps = L.publishEvent(ps, "order_created");
    ps = L.bringSubscriberOnline(ps, "Analytics");
    const ana = ps.subscribers.find((s) => s.name === "Analytics")!;
    expect(ana.received).toBe(2);
    expect(ana.backlog).toBe(0);
  });
});

describe("17 event-driven architecture", () => {
  it("propagates a trace id with every event", () => {
    let eda: L.EdaSystem = { events: [], consumedBy: {} };
    eda = L.edaPublish(eda, "UserCreated", "User Service", "trace-001");
    expect(eda.events[0].traceId).toBe("trace-001");
    expect(L.EDA_CONSUMERS["UserCreated"]).toContain("Email Service");
  });

  it("derives event-sourced balance by folding events (no stored row)", () => {
    const events: L.BankEvent[] = [
      { type: "Deposit", amount: 50 },
      { type: "Withdraw", amount: 10 },
      { type: "Deposit", amount: 60 },
    ];
    expect(L.foldBalance(events)).toBe(100);
  });
});

describe("18 distributed transactions", () => {
  it("commits when all vote YES", () => {
    const prepared = L.twoPCPrepare({ "Billing DB": "YES", "Rewards DB": "YES" });
    const out = L.twoPCCommit(prepared);
    expect(out.kind).toBe("committed");
  });

  it("aborts cleanly on a NO vote", () => {
    const prepared = L.twoPCPrepare({ "Billing DB": "YES", "Rewards DB": "NO" });
    const out = L.twoPCCommit(prepared);
    expect(out.kind).toBe("aborted");
  });

  it("exposes the partial-failure window when a participant crashes during commit", () => {
    const prepared = L.twoPCPrepare({ "Billing DB": "YES", "Rewards DB": "YES" });
    const out = L.twoPCCommit(prepared, "Rewards DB");
    expect(out.kind).toBe("partial-failure");
    expect(out.detail).toContain("LOCKED");
  });
});

describe("19 saga", () => {
  it("runs forward to completion when nothing fails", () => {
    const r = L.runSaga(L.makeSaga(), undefined, "orchestration");
    expect(r.steps.every((s) => s.state === "done")).toBe(true);
  });

  it("compensates backward when shipping fails", () => {
    const r = L.runSaga(L.makeSaga(), 3, "choreography");
    expect(r.steps[2].state).toBe("failed");
    expect(r.steps[0].state).toBe("compensated");
    expect(r.steps[1].state).toBe("compensated");
    const refund = r.log.find((l) => l.includes("refund $50"));
    expect(refund).toBeDefined();
    const cancel = r.log.find((l) => l.includes("order cancelled"));
    expect(cancel).toBeDefined();
  });
});

describe("20 cron", () => {
  it("duplicates execution across servers without a lock", () => {
    let c = L.makeCronState();
    const r = L.cronTick(c, false);
    c = r.state;
    expect(c.servers.every((s) => s.emailsSent === 1)).toBe(true);
    expect(r.log.some((l) => l.includes("3 identical"))).toBe(true);
  });

  it("executes exactly once with a distributed lock", () => {
    let c = { ...L.makeCronState(), distributedLock: true };
    const r = L.cronTick(c, true);
    c = r.state;
    const total = c.servers.reduce((a, s) => a + s.emailsSent, 0);
    expect(total).toBe(1);
    expect(r.log.some((l) => l.includes("enqueues"))).toBe(true); // scheduler → queue → worker
  });

  it("converts a UTC midnight run to the local hour (DST-aware)", () => {
    expect(L.utcToLocalHour(0, -5, 0)).toBe(19); // EST: 7 PM the previous evening
    expect(L.utcToLocalHour(0, -5, 1)).toBe(20); // EDT: 8 PM
  });
});
