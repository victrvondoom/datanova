/**
 * Campaign 03, Milestone 6 tests — observability (T26), trace reconstruction (T27),
 * flight recorder (T28), drift detection (T29), recovery runbooks (T30).
 */

import { describe, it, expect } from "vitest";
import { cloneModel } from "../model";
import { docflowModel } from "../samples";
import { observabilityGaps } from "../engines/observability";
import { generateTrace, diagnoseBrokenTrace, validateTraceStructure } from "../engines/trace";
import {
  startRecording, record, recordFromPropagation, stateAt, windowEvents, integrityIssues,
} from "../engines/flightrecorder";
import { propagate } from "../engines/causal";
import { takeSnapshot, restore } from "../engines/ledger";
import { detectDrift } from "../engines/drift";
import { generateRunbook, validateRunbook } from "../engines/runbook";

// ---------------------------------------------------------------------------
// Task 26 — observability coverage
// ---------------------------------------------------------------------------

describe("T26 observability coverage analyzer", () => {
  it("detects async hops without trace propagation and queues without depth metrics", () => {
    const { gaps, findings } = observabilityGaps(docflowModel());
    // upload-svc does not declare tracePropagation: enqueue -> worker hop is dark
    expect(gaps.some((g) => g.kind === "trace-propagation" && g.connectionId === "cn-queue-worker")).toBe(true);
    // work-queue reports queue_depth: no gap for it
    expect(gaps.some((g) => g.kind === "queue-depth" && g.componentId === "work-queue")).toBe(false);
    expect(findings.every((f) => f.evidence.length > 0)).toBe(true);
  });

  it("detects unmeasured retries and unlogged critical edges", () => {
    const m = docflowModel();
    // worker retries 3x but reports only processed/processing_time metrics
    const { gaps } = observabilityGaps(m);
    expect(gaps.some((g) => g.kind === "retry-metrics" && g.componentId === "worker")).toBe(true);
    // make the worker->store edge unobservable at both ends
    const worker = m.components.find((c) => c.id === "worker")!;
    worker.telemetry!.logs = false;
    const { gaps: gaps2 } = observabilityGaps(m);
    expect(gaps2.some((g) => g.kind === "unlogged-critical" && g.connectionId === "cn-worker-store")).toBe(true);
  });

  it("flags operations with no tracing at all", () => {
    const m = docflowModel();
    m.components.forEach((c) => { if (c.telemetry) c.telemetry.traces = false; });
    const { gaps } = observabilityGaps(m);
    expect(gaps.filter((g) => g.kind === "untraced-operation").length).toBe(m.operations.length);
  });
});

// ---------------------------------------------------------------------------
// Task 27 — trace reconstruction
// ---------------------------------------------------------------------------

describe("T27 trace reconstruction lab", () => {
  it("generates an illustrative trace from the latency model", () => {
    const trace = generateTrace(docflowModel(), "op-upload");
    expect(trace.note).toContain("ILLUSTRATIVE");
    expect(trace.spans.length).toBe(4); // 3 sync hops + async link to work-queue? -> see below
    expect(validateTraceStructure(trace)).toEqual([]);
    // parent-child chain along the critical path
    expect(trace.spans[0].parentId).toBeNull();
    expect(trace.spans[1].parentId).toBe("span-1");
  });

  it("diagnoses broken correlation across async hops", () => {
    const m = docflowModel();
    // op-process async hop: work-queue -> worker (work-queue has no tracePropagation)
    const trace = generateTrace(m, "op-process");
    expect(trace.broken).toBe(true);
    const diag = diagnoseBrokenTrace(m, trace);
    expect(diag?.brokenAt).toContain("worker");
    expect(diag?.consequence).toContain("cannot be joined");
    expect(diag?.missingContext.length).toBe(2);
  });

  it("a fully propagated path produces an unbroken trace", () => {
    const m = docflowModel();
    m.components.find((c) => c.id === "work-queue")!.telemetry = { metrics: ["queue_depth"], traces: true, tracePropagation: true };
    m.components.find((c) => c.id === "worker")!.telemetry!.tracePropagation = true;
    const trace = generateTrace(m, "op-process");
    expect(trace.broken).toBe(false);
    expect(diagnoseBrokenTrace(m, trace)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 28 — architecture flight recorder
// ---------------------------------------------------------------------------

describe("T28 architecture flight recorder", () => {
  it("records are append-only and immutable", () => {
    const rec = startRecording("exp-1", "2026-01-01T00:00:00Z");
    const r2 = record(rec, { t: 0, type: "fault", componentId: "meta-db", detail: "injected" });
    const r3 = record(r2, { t: 1, type: "status-change", componentId: "upload-svc", variable: "status", to: "down", detail: "blocked" });
    expect(rec.events.length).toBe(0); // original untouched
    expect(r2.events.length).toBe(1);
    expect(r3.events.map((e) => e.seq)).toEqual([1, 2]);
  });

  it("imports a causal propagation as a linked recording", () => {
    const m = docflowModel();
    const prop = propagate(m, { componentId: "meta-db", fault: "down" });
    const rec = recordFromPropagation(startRecording("exp-2", "t0"), prop, "exp-2");
    expect(rec.events[0].type).toBe("fault");
    expect(rec.events[0].componentId).toBe("meta-db");
    expect(rec.events.some((e) => e.ruleId === "R-SYNC-BLOCK")).toBe(true);
    expect(rec.events.every((e) => e.experimentId === "exp-2")).toBe(true);
  });

  it("replay is a deterministic fold: state at any seq is reproducible", () => {
    const m = docflowModel();
    const prop = propagate(m, { componentId: "meta-db", fault: "down" });
    const rec = recordFromPropagation(startRecording("exp-3", "t0"), prop, "exp-3");
    const mid = Math.floor(rec.events.length / 2);
    const sMid = stateAt(rec, mid);
    const sMidAgain = stateAt(rec, mid);
    expect(sMid).toEqual(sMidAgain); // deterministic
    const sEnd = stateAt(rec, rec.events.length);
    expect(sEnd.lastSeq).toBe(rec.events.length);
    expect(sEnd.statuses["meta-db"]).toBe("down");
    expect(sEnd.statuses["web"]).toBe("down"); // fully propagated by the end
    // early replay does not yet show downstream effects
    const sEarly = stateAt(rec, 2);
    expect(sEarly.statuses["web"]).toBeUndefined();
    expect(sEarly.statuses["meta-db"]).toBe("down"); // the fault itself is the first event
    // windowed events respect bounds
    expect(windowEvents(rec, 1, 3).length).toBe(3);
  });

  it("incomplete recordings are flagged, never crash the fold", () => {
    const rec = startRecording("exp-4", "t0");
    const withGhost = record(rec, { t: 0, type: "fault", componentId: "ghost-comp", detail: "???" });
    const issues = integrityIssues(withGhost, new Set(["meta-db"]));
    expect(issues.some((i) => i.problem.includes("unknown component ghost-comp"))).toBe(true);
    expect(() => stateAt(withGhost, 10)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Task 29 — architecture drift detection
// ---------------------------------------------------------------------------

describe("T29 architecture drift detector", () => {
  const t0 = "2026-01-01T00:00:00Z";

  it("classifies drift and maps invalidated requirements and SLOs", () => {
    const baseline = docflowModel();
    let ledger = takeSnapshot({ archId: baseline.id, snapshots: [] }, baseline, { label: "approved", createdAt: t0 });
    const current = cloneModel(baseline);
    // behavioral drift: worker no longer isolates queue failures
    current.connections.find((c) => c.id === "cn-queue-worker")!.failureBehavior = "blocks";
    // documentation drift: rename
    current.components.find((c) => c.id === "analytics")!.purpose = "Usage reports (renamed)";
    // security drift: drop encryption on the document store edge
    current.connections.find((c) => c.id === "cn-up-store")!.controls = [];

    const report = detectDrift({ version: 1, model: restore(ledger, 1) }, current);
    const reliability = report.changes.find((i) => i.change.classification === "reliability");
    expect(reliability?.significance).toBe("invalidates");
    expect(reliability?.evidenceNeeded).toContain("blast-radius");
    const security = report.changes.find((i) => i.change.classification === "security");
    expect(security?.significance).toBe("invalidates");
    expect(security?.evidenceNeeded).toContain("adversarial");
    const docs = report.changes.find((i) => i.change.classification === "documentation");
    expect(docs?.significance).toBe("harmless");
    // the queue->worker edge carries NFR-2: invalidated requirement mapping surfaced
    expect(reliability?.invalidatedRequirements).toContain("NFR-2");
    expect(report.findings.some((f) => f.severity === "critical")).toBe(true);
  });

  it("no changes means no drift findings", () => {
    const baseline = docflowModel();
    const report = detectDrift({ version: 1, model: baseline }, cloneModel(baseline));
    expect(report.changes).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it("structural additions require intent re-verification (review, not invalidate)", () => {
    const baseline = docflowModel();
    const current = cloneModel(baseline);
    current.components.push({
      id: "search-svc", kind: "service", name: "Search service",
      purpose: "full-text search", config: {}, requirementIds: ["FR-2"],
    });
    const report = detectDrift({ version: 1, model: baseline }, current);
    const structural = report.changes.find((i) => i.change.classification === "structural");
    expect(structural?.significance).toBe("review");
    expect(structural?.evidenceNeeded).toContain("intent coverage");
  });
});

// ---------------------------------------------------------------------------
// Task 30 — recovery runbooks
// ---------------------------------------------------------------------------

describe("T30 recovery runbook generator", () => {
  it("generates ordered, verifiable steps for a database failure", () => {
    const rb = generateRunbook(docflowModel(), "meta-db");
    expect(rb.steps.length).toBeGreaterThanOrEqual(2);
    expect(rb.steps[0].precondition).toContain("confirmed");
    expect(rb.steps.every((s) => s.risk.length > 10 && s.rollback.length > 10)).toBe(true);
    expect(rb.verification.some((v) => v.includes("Upload document"))).toBe(true);
    expect(rb.escalation[0].condition).toContain("data loss");
    expect(validateRunbook(docflowModel(), rb)).toEqual([]);
  });

  it("payment paths escalate to the payments owner", () => {
    const rb = generateRunbook(docflowModel(), "doc-store");
    expect(rb.escalation.some((e) => e.action.includes("data owner"))).toBe(true);
  });

  it("every step references existing components and claims nothing unsupported", () => {
    ["meta-db", "worker", "work-queue", "gateway", "notify"].forEach((id) => {
      const rb = generateRunbook(docflowModel(), id);
      const problems = validateRunbook(docflowModel(), rb);
      expect(problems).toEqual([]);
      expect(rb.evidence[0]).toBe(`component:${id}`);
    });
    expect(() => generateRunbook(docflowModel(), "ghost")).toThrow(/unknown component/);
  });
});
