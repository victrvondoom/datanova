/**
 * Campaign 03, Milestone 3 tests — traffic/queueing (T11), latency budget (T12),
 * SLO/error budget (T13), resources/bottleneck (T14), cost-risk-complexity (T15).
 */

import { describe, it, expect } from "vitest";
import { emptyModel } from "../model";
import { docflowModel, flawedCheckoutModel } from "../samples";
import { simulateQueue, type TrafficProfile } from "../engines/traffic";
import { analyzeLatency } from "../engines/latency";
import { errorBudget, consumeBudget } from "../engines/slo";
import { saturate, scaleResource, saturationFindings } from "../engines/resource";
import {
  monthlyCost, riskExposure, complexity, frontier, costSensitivity,
  DEFAULT_COST_ASSUMPTIONS, type RiskItem,
} from "../engines/tradeoff";

// ---------------------------------------------------------------------------
// Task 11 — traffic and queueing
// ---------------------------------------------------------------------------

describe("T11 traffic and queueing model", () => {
  const steady: TrafficProfile = { kind: "steady", baseRatePerSec: 10, durationSec: 60, seed: 42 };

  it("stable load keeps the queue bounded with no drops", () => {
    const r = simulateQueue(steady, { kind: "fixed", ms: 100 }, { workers: 4, queueCapacity: 100 });
    expect(r.totalArrived).toBeGreaterThan(500); // ~600 expected
    expect(r.totalProcessed).toBeGreaterThan(500);
    expect(r.totalDropped).toBe(0);
    expect(r.maxDepth).toBeLessThan(10);
    expect(r.saturated).toBe(false);
    expect(r.assumptions.length).toBeGreaterThanOrEqual(3);
  });

  it("overload grows the backlog and flags saturation", () => {
    const overload: TrafficProfile = { kind: "steady", baseRatePerSec: 50, durationSec: 30, seed: 7 };
    const r = simulateQueue(overload, { kind: "fixed", ms: 250 }, { workers: 4, queueCapacity: 5000 });
    // capacity = 16/s vs 50/s arrivals: backlog must grow
    expect(r.saturated).toBe(true);
    expect(r.maxDepth).toBeGreaterThan(100);
    expect(r.timeline[r.timeline.length - 1].depth).toBeGreaterThan(r.timeline[10].depth);
  });

  it("bursts spike the queue and the system recovers afterwards", () => {
    const bursty: TrafficProfile = {
      kind: "bursty", baseRatePerSec: 10, burstMultiplier: 4,
      burstEverySec: 10, burstDurationSec: 2, durationSec: 40, seed: 3,
    };
    const r = simulateQueue(bursty, { kind: "fixed", ms: 100 }, { workers: 4, queueCapacity: 500 });
    const burstTick = r.timeline.find((p) => p.arrived > 30);
    expect(burstTick).toBeTruthy(); // a burst happened
    expect(r.saturated).toBe(false); // recovery: backlog drains between bursts
    const lastDepth = r.timeline[r.timeline.length - 1].depth;
    expect(lastDepth).toBeLessThan(20);
  });

  it("dropped work is counted when capacity is exceeded", () => {
    const r = simulateQueue(
      { kind: "steady", baseRatePerSec: 50, durationSec: 20, seed: 1 },
      { kind: "fixed", ms: 1000 }, { workers: 2, queueCapacity: 50 });
    expect(r.totalDropped).toBeGreaterThan(0);
    expect(r.totalProcessed).toBeLessThan(r.totalArrived);
  });

  it("is deterministic given the seed and varies across seeds", () => {
    const a = simulateQueue(steady, { kind: "exponential", ms: 200 }, { workers: 3, queueCapacity: 200 });
    const b = simulateQueue(steady, { kind: "exponential", ms: 200 }, { workers: 3, queueCapacity: 200 });
    expect(a).toEqual(b);
    const c = simulateQueue({ ...steady, seed: 43 }, { kind: "exponential", ms: 200 }, { workers: 3, queueCapacity: 200 });
    expect(c.timeline.map((p) => p.arrived).join()).not.toBe(a.timeline.map((p) => p.arrived).join());
  });

  it("scaling workers resolves saturation", () => {
    const overload: TrafficProfile = { kind: "steady", baseRatePerSec: 50, durationSec: 30, seed: 7 };
    const small = simulateQueue(overload, { kind: "fixed", ms: 100 }, { workers: 4, queueCapacity: 5000 });
    const big = simulateQueue(overload, { kind: "fixed", ms: 100 }, { workers: 16, queueCapacity: 5000 });
    expect(small.saturated).toBe(true);
    expect(big.saturated).toBe(false);
    expect(big.maxDepth).toBeLessThan(small.maxDepth);
  });
});

// ---------------------------------------------------------------------------
// Task 12 — latency budget
// ---------------------------------------------------------------------------

describe("T12 latency budget composer", () => {
  it("aggregates the critical synchronous path against the deadline", () => {
    const la = analyzeLatency(docflowModel(), "op-upload");
    // paths: web->gateway->upload-svc->doc-store (350) and ->meta-db (270)
    expect(la.paths.length).toBe(2);
    expect(la.modeledMs).toBe(350);
    expect(la.deadlineMs).toBe(800);
    expect(la.remainingMs).toBe(450);
    expect(la.missesDeadline).toBe(false);
    expect(la.criticalPath?.nodes).toEqual(["web", "gateway", "upload-svc", "doc-store"]);
    expect(la.largestConsumer?.componentId).toBe("upload-svc"); // 10 conn + 120 alloc
    expect(la.asyncHops.some((h) => h.includes("work-queue"))).toBe(true);
  });

  it("reports deadline violations with the largest consumer", () => {
    const m = docflowModel();
    m.latencyBudget!.allocations["upload-svc"] = 700;
    const la = analyzeLatency(m, "op-upload");
    expect(la.modeledMs).toBe(930);
    expect(la.missesDeadline).toBe(true);
    expect(la.remainingMs).toBe(-130);
    expect(la.largestConsumer?.share).toBeGreaterThan(0.5);
  });

  it("worst-case retry overhead is quantified per hop", () => {
    const m = flawedCheckoutModel();
    m.components.find((c) => c.id === "c-api")!.config.retryMax = 2;
    const la = analyzeLatency(m, "op-checkout");
    const payHop = la.criticalPath?.hops.find((h) => h.to === "c-pay");
    // 2 retries of the full hop (900 ms conn + 0 allocation)
    expect(payHop?.retriesWorstCaseMs).toBe(1800);
  });

  it("missing budget assumptions are surfaced, not invented", () => {
    const m = flawedCheckoutModel();
    m.latencyBudget = undefined;
    const la = analyzeLatency(m, "op-checkout");
    expect(la.deadlineMs).toBeNull();
    expect(la.remainingMs).toBeNull();
    expect(la.missesDeadline).toBeNull();
    expect(la.modeledMs).toBe(930); // 30 + 900 through the payment path, no allocations declared
    expect(la.assumptions.some((a) => a.includes("allocations"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 13 — SLO and error budgets
// ---------------------------------------------------------------------------

describe("T13 SLO explorer", () => {
  it("computes a transparent availability error budget", () => {
    const slo = docflowModel().slos.find((s) => s.kind === "availability")!;
    const b = errorBudget(slo);
    expect(b.windowRequests).toBe(30 * 4_320_000);
    expect(b.allowedBad).toBe(129_600); // 0.1% of the window
    expect(b.applicable).toBe(true);
    expect(b.note).toContain("(1 - 99.9/100)");
  });

  it("marks latency SLOs as not applicable for budget math (honest limits)", () => {
    const slo = docflowModel().slos.find((s) => s.kind === "latency")!;
    const b = errorBudget(slo);
    expect(b.applicable).toBe(false);
    expect(b.note).toContain("does not measure");
  });

  it("downtime consumes the budget with explicit math", () => {
    const m = docflowModel();
    const r = consumeBudget(m, "meta-db", 43);
    const avail = r.find((x) => x.sloId === "slo-avail")!;
    // 3000 modeled req/min -> 43 min = 129000 lost < 129600 budget
    expect(avail.modeledLostRequests).toBe(129_000);
    expect(avail.verdict).toBe("within-budget");
    expect(avail.remaining).toBe(600);
    const exhausted = consumeBudget(m, "meta-db", 43.2).find((x) => x.sloId === "slo-avail")!;
    expect(exhausted.verdict).toBe("budget-exhausted"); // window boundary: exactly 129600
  });

  it("unmapped components do not consume a budget", () => {
    const r = consumeBudget(docflowModel(), "analytics", 600);
    expect(r.find((x) => x.sloId === "slo-avail")?.verdict).toBe("not-applicable");
    expect(r.find((x) => x.sloId === "slo-avail")?.modeledLostRequests).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 14 — resources and bottleneck
// ---------------------------------------------------------------------------

describe("T14 resource saturation explorer", () => {
  it("finds the bottleneck with Little's law and names the slack resources", () => {
    const s = saturate(docflowModel(), 50);
    // Little's law: 50 rps * 4s processing = 200 slots needed vs 8 configured
    // (the seeded DocFlow is undersized at its own assumed peak — a real finding)
    expect(s.bottleneck?.componentId).toBe("worker");
    expect(s.bottleneck?.resource).toBe("workerSlots");
    expect(s.bottleneck?.required).toBe(200);
    expect(s.bottleneck?.utilization).toBe(25);
    expect(s.slack.some((u) => u.componentId === "meta-db")).toBe(true);
    expect(s.explanation).toContain("will NOT improve throughput");
  });

  it("scaling the bottleneck moves it; scaling slack does not", () => {
    const m = docflowModel();
    const fix = scaleResource(m, 50, "worker", "workerSlots", 100);
    expect(fix.result.bottleneckMoved).toBe(true);
    expect(fix.result.newBottleneck?.componentId).toBe("gateway"); // cpu now binds
    const useless = scaleResource(m, 50, "meta-db", "connPool", 100);
    expect(useless.result.bottleneckMoved).toBe(false);
    expect(useless.result.note).toContain("was not the constraint");
    // original untouched
    expect(m.components.find((c) => c.id === "worker")?.config.concurrency).toBe(8);
  });

  it("produces saturation findings with evidence", () => {
    const findings = saturationFindings(docflowModel(), 50);
    expect(findings.some((f) => f.id === "resource-sat:worker:workerSlots" && f.severity === "critical")).toBe(true);
    expect(findings.find((f) => f.id === "resource-slack")?.evidence.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Task 15 — cost/risk/complexity frontier
// ---------------------------------------------------------------------------

describe("T15 cost-risk-complexity frontier", () => {
  const risksOf = (archId: string): RiskItem[] =>
    archId === "arch-docflow"
      ? [
        { id: "r1", description: "queue overflow at peak", severity: 4, likelihood: 0.3, mitigatedBy: "work-queue" },
        { id: "r2", description: "provider outage", severity: 3, likelihood: 0.1 },
      ]
      : [{ id: "r3", description: "duplicate charge", severity: 5, likelihood: 0.4 }];

  it("computes cost from declared assumptions only", () => {
    const { total, breakdown } = monthlyCost(docflowModel());
    expect(breakdown.length).toBe(10);
    expect(total).toBeGreaterThan(150);
    expect(total).toBeLessThan(400); // clearly labeled as modeled, not pricing
  });

  it("mitigation reduces risk exposure by the documented factor", () => {
    const { total, items } = riskExposure(risksOf("arch-docflow"));
    expect(items.find((i) => i.id === "r1")?.net).toBe(4 * 0.3 * 0.4);
    expect(items.find((i) => i.id === "r2")?.mitigated).toBe(false);
    expect(total).toBeCloseTo(4 * 0.3 * 0.4 + 3 * 0.1, 2);
  });

  it("complexity counts deployables, state, and integration points", () => {
    const c = complexity(docflowModel());
    expect(c.deployables).toBe(9);
    expect(c.stateful).toBe(3);
    expect(c.integrationPoints).toBe(12);
    expect(c.externalDependencies).toBe(1);
  });

  it("the frontier marks dominated architectures without a single score", () => {
    const pts = frontier([docflowModel(), flawedCheckoutModel()], (m) => risksOf(m.id));
    expect(pts.length).toBe(2);
    expect(pts.every((p) => typeof p.dominated === "boolean")).toBe(true);
    // neither dominates the other: docflow costs more but has higher reliability proxy
    expect(pts.every((p) => !p.dominated)).toBe(true);
    const props = Object.keys(pts[0]).filter((k) => k !== "archId" && k !== "dominated");
    expect(props.length).toBe(4); // cost, risk, complexity, reliability — no single score
  });

  it("sensitivity analysis changes rankings only when assumptions matter", () => {
    const storageHeavy = emptyModel("storage-heavy", "storage heavy");
    storageHeavy.components = [
      { id: "s1", kind: "objectstore", name: "Blob store", config: { storageGB: 100 }, requirementIds: [] },
    ];
    const cpuHeavy = emptyModel("cpu-heavy", "cpu heavy");
    cpuHeavy.components = [
      { id: "c1", kind: "service", name: "Hot service", config: { cpuUnits: 32 }, requirementIds: [] },
    ];
    const cheap = costSensitivity([cpuHeavy, storageHeavy], "costPerGBStorage", 1);
    expect(cheap.beforeRanking).toEqual(cheap.afterRanking);
    const expensive = costSensitivity([cpuHeavy, storageHeavy], "costPerGBStorage", 100);
    expect(expensive.rankingChanged).toBe(true);
    expect(expensive.afterRanking[0]).toBe("cpu-heavy");
    expect(DEFAULT_COST_ASSUMPTIONS.costPerGBStorage).toBe(0.08); // assumptions stay explicit
  });
});
