/**
 * Campaign 03, Milestone 7 tests — chaos experiments (T31), test synthesis (T32),
 * fault orchestrator (T33), recovery verdicts (T34), scorecard (T35).
 */

import { describe, it, expect } from "vitest";
import { docflowModel } from "../samples";
import { fromTemplate, runChaos, TEMPLATES } from "../engines/chaos";
import { synthesizeTests, runGeneratedTests, deriveProperties } from "../engines/testsynth";
import { validatePlan, transition, runPlan, type FaultPlan } from "../engines/orchestrator";
import { evaluateRecovery, type RecoveryCriterion } from "../engines/recovery";
import { startRecording, record } from "../engines/flightrecorder";
import { buildScorecard, scorecardFindings } from "../engines/scorecard";

// ---------------------------------------------------------------------------
// Task 31 — chaos experiment designer
// ---------------------------------------------------------------------------

describe("T31 chaos experiment designer", () => {
  it("provides the five reusable templates", () => {
    expect(Object.keys(TEMPLATES)).toEqual([
      "latency-injection", "component-failure", "queue-slowdown", "dependency-outage", "resource-saturation",
    ]);
    const exp = fromTemplate("cx-1", "dependency-outage", "meta-db", ["op-upload"]);
    expect(exp.faultType).toBe("down");
    expect(exp.hypothesis).toContain("meta-db");
    expect(exp.safeguards.length).toBeGreaterThan(0);
    expect(exp.stopConditions.length).toBeGreaterThan(0);
  });

  it("supports a correct hypothesis about metadata-db impact", () => {
    const exp = fromTemplate("cx-2", "component-failure", "meta-db",
      ["op-upload", "op-process", "op-status", "op-report", "op-delete"]);
    const out = runChaos(docflowModel(), exp);
    expect(out.verdict).toBe("supported");
    expect(out.observedImpactedOperations.sort()).toEqual(
      ["op-delete", "op-process", "op-report", "op-status", "op-upload"]);
    // the recording ends with the scheduled recovery
    const last = out.recording.events[out.recording.events.length - 1];
    expect(last.type).toBe("recovery");
  });

  it("contradicts a wrong hypothesis and explains why", () => {
    const exp = fromTemplate("cx-3", "component-failure", "meta-db", ["op-report"]);
    const out = runChaos(docflowModel(), exp);
    expect(out.verdict).toBe("contradicted");
    expect(out.reviewNotes.some((n) => n.includes("LARGER than hypothesized"))).toBe(true);
    expect(out.findings[0].severity).toBe("critical");
  });

  it("confirms a no-impact hypothesis for isolated components", () => {
    const exp = fromTemplate("cx-4", "component-failure", "analytics", []);
    const out = runChaos(docflowModel(), exp);
    expect(out.verdict).toBe("supported");
    expect(out.observedAffectedComponents).toEqual([]);
    expect(out.observedImpactedOperations).toEqual(["op-report"]); // its own operation only
  });

  it("marks experiments with unknown targets invalid without executing anything", () => {
    const exp = fromTemplate("cx-5", "component-failure", "ghost", ["op-upload"]);
    const out = runChaos(docflowModel(), exp);
    expect(out.verdict).toBe("invalid");
    expect(out.recording.events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 32 — resilience test synthesis
// ---------------------------------------------------------------------------

describe("T32 resilience test synthesis", () => {
  it("derives isolation, idempotency, retry, and budget properties", () => {
    const props = deriveProperties(docflowModel());
    expect(props.some((p) => p.kind === "isolation" && p.targetComponentId === "analytics")).toBe(true);
    expect(props.some((p) => p.kind === "idempotency" && p.targetComponentId === "upload-svc")).toBe(true);
    expect(props.some((p) => p.kind === "retry-safety" && p.targetComponentId === "worker")).toBe(true);
    expect(props.some((p) => p.kind === "budget")).toBe(true);
  });

  it("prioritizes tests deterministically and marks budget tests non-executable", () => {
    const tests = synthesizeTests(docflowModel());
    expect(tests[0].priority).toBeGreaterThanOrEqual(tests[tests.length - 1].priority);
    const budget = tests.find((t) => t.property.kind === "budget")!;
    expect(budget.executable).toBe(false);
    expect(budget.priorityReason).toContain("does not provide");
  });

  it("failing properties surface as findings; non-executable tests never pass silently", () => {
    const { results, findings } = runGeneratedTests(docflowModel());
    // upload-svc is not idempotent -> the idempotency test FAILS
    const idem = results.find((r) => r.propertyId === "prop-idem-upload-svc")!;
    expect(idem.passed).toBe(false);
    expect(findings.some((f) => f.id === "test-fail:prop-idem-upload-svc")).toBe(true);
    // budget tests are reported as not executable, never as passed
    results.filter((r) => r.passed === null).forEach((r) => {
      expect(r.note).toContain("NOT EXECUTABLE");
    });
    // the isolation property for the email notifier FAILS: its loss impacts op-process
    const isoNotify = results.find((r) => r.propertyId === "prop-iso-notify");
    expect(isoNotify?.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 33 — fault-injection orchestrator
// ---------------------------------------------------------------------------

describe("T33 fault-injection orchestrator", () => {
  const plan = (): FaultPlan => ({
    id: "plan-1",
    steps: [
      { id: "f1", componentId: "meta-db", fault: "down", atMin: 0, durationMin: 10 },
      { id: "f2", componentId: "worker", fault: "slow", atMin: 5 },
      { id: "f3", componentId: "notify", fault: "down", atMin: 10, dependsOn: ["f2"] },
    ],
  });

  it("validates plans: unknown components and dependency ordering", () => {
    const bad = plan();
    bad.steps[0].componentId = "ghost";
    bad.steps[2].atMin = 1; // depends on f2 (at 5) but fires earlier
    const v = validatePlan(docflowModel(), bad);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes("unknown component ghost"))).toBe(true);
    expect(v.errors.some((e) => e.includes("ordering violation"))).toBe(true);
    expect(validatePlan(docflowModel(), plan()).valid).toBe(true);
  });

  it("state machine permits only legal transitions", () => {
    expect(transition("prepared", "start").state).toBe("running");
    expect(transition("running", "pause").state).toBe("paused");
    expect(transition("paused", "resume").state).toBe("running");
    expect(transition("running", "abort").state).toBe("stopped");
    expect(transition("stopped", "reset").state).toBe("reset");
    expect(transition("completed", "reset").state).toBe("reset");
    expect(transition("reset", "start").error).toContain("illegal transition");
    expect(transition("completed", "start").error).toContain("illegal transition");
  });

  it("executes multi-fault scenarios in order with recovery events", () => {
    const out = runPlan(docflowModel(), plan());
    expect(out.finalState).toBe("completed");
    expect(out.executedSteps).toEqual(["f1", "f2", "f3"]);
    // f1 recovers within its window
    expect(out.recording.events.some((e) => e.type === "recovery" && e.componentId === "meta-db")).toBe(true);
    // combined status merges: worker slow (degraded) but meta-db propagation took it down
    expect(out.combinedStatus["worker"]).toBe("down");
    expect(out.combinedStatus["web"]).toBe("down");
    expect(out.combinedStatus["analytics"]).toBe("up"); // isolated
  });

  it("abort stops all further faults and marks skipped steps", () => {
    const out = runPlan(docflowModel(), plan(), { abortAfterStep: "f1" });
    expect(out.finalState).toBe("stopped");
    expect(out.executedSteps).toEqual(["f1"]);
    expect(out.skippedSteps).toEqual(["f2", "f3"]);
    expect(out.recording.events.some((e) => e.detail.includes("step f2"))).toBe(false);
  });

  it("pause withholds later steps and reports paused state", () => {
    const out = runPlan(docflowModel(), plan(), { pausedAtMin: 5 });
    expect(out.finalState).toBe("paused");
    expect(out.executedSteps).toEqual(["f1"]);
    expect(out.skippedSteps).toEqual(["f2", "f3"]);
  });
});

// ---------------------------------------------------------------------------
// Task 34 — recovery evidence and verification
// ---------------------------------------------------------------------------

describe("T34 recovery verdicts", () => {
  const restored = () => {
    let rec = startRecording("exp", "t0");
    rec = record(rec, { t: 0, type: "fault", componentId: "meta-db", variable: "status", to: "down", detail: "injected" });
    rec = record(rec, { t: 60_000, type: "recovery", componentId: "meta-db", variable: "status", to: "up", detail: "restored after failover" });
    return rec;
  };

  it("RECOVERED requires evidenced criteria", () => {
    const criteria: RecoveryCriterion[] = [
      { kind: "component-restored", componentId: "meta-db", statement: "meta-db is restored" },
    ];
    const r = evaluateRecovery(restored(), criteria);
    expect(r.verdict).toBe("RECOVERED");
    expect(r.evaluations[0].evidence.length).toBeGreaterThan(0);
  });

  it("NOT_RECOVERED when the fault never healed", () => {
    let rec = startRecording("exp", "t0");
    rec = record(rec, { t: 0, type: "fault", componentId: "meta-db", variable: "status", to: "down", detail: "injected" });
    const r = evaluateRecovery(rec, [
      { kind: "component-restored", componentId: "meta-db", statement: "meta-db is restored" },
    ]);
    expect(r.verdict).toBe("NOT_RECOVERED");
  });

  it("PARTIALLY_RECOVERED with missing observations named", () => {
    const criteria: RecoveryCriterion[] = [
      { kind: "component-restored", componentId: "meta-db", statement: "meta-db is restored" },
      { kind: "queue-drained", componentId: "work-queue", statement: "queue drains below threshold" },
    ];
    const r = evaluateRecovery(restored(), criteria);
    expect(r.verdict).toBe("PARTIALLY_RECOVERED");
    expect(r.missingObservations).toContain("queue drains below threshold");
    expect(r.findings.some((f) => f.id.startsWith("recovery-missing:"))).toBe(true);
  });

  it("INCONCLUSIVE when nothing in the recording speaks to the criteria", () => {
    const r = evaluateRecovery(startRecording("exp", "t0"), [
      { kind: "error-rate-recovered", componentId: "gateway", statement: "error rate back to baseline" },
    ]);
    expect(r.verdict).toBe("INCONCLUSIVE");
  });

  it("queue-drain criteria need explicit drain evidence", () => {
    let rec = restored();
    rec = record(rec, { t: 120_000, type: "queue-depth", componentId: "work-queue", detail: "depth 5000 and growing" });
    rec = record(rec, { t: 300_000, type: "queue-depth", componentId: "work-queue", detail: "queue drained: depth back to 0" });
    const r = evaluateRecovery(rec, [
      { kind: "queue-drained", componentId: "work-queue", statement: "queue drains" },
    ]);
    expect(r.verdict).toBe("RECOVERED");
  });
});

// ---------------------------------------------------------------------------
// Task 35 — transparent scorecard
// ---------------------------------------------------------------------------

describe("T35 transparent resilience scorecard", () => {
  it("scores seven dimensions with uncertainty and evidence", () => {
    const { scorecard, allFindings } = buildScorecard(docflowModel());
    expect(scorecard.dimensions.map((d) => d.key)).toEqual([
      "reliability", "security", "consistency", "observability", "recovery", "cost", "complexity",
    ]);
    expect(scorecard.dimensions.every((d) => d.uncertainty.length > 0 && d.rationale.length > 20 && d.evidence.length > 0)).toBe(true);
    expect(scorecard.notes.some((n) => n.includes("No aggregate score"))).toBe(true);
    // security reflects the 11 critical trust/tenant findings of the seeded model
    const security = scorecard.dimensions.find((d) => d.key === "security")!;
    expect(security.score).toBe(0);
    expect(security.rationale).toContain("15 critical trust/tenant findings"); // 3 trust + 12 tenant criticals in the seeded model
    expect(allFindings.length).toBeGreaterThan(5);
  });

  it("scores are inspectable and weak dimensions produce findings", () => {
    const { scorecard } = buildScorecard(docflowModel());
    const consistency = scorecard.dimensions.find((d) => d.key === "consistency")!;
    expect(consistency.basedOnFindings).toContain("consistency:cc-status");
    const weak = scorecardFindings(scorecard);
    expect(weak.some((f) => f.id.startsWith("scorecard:"))).toBe(true);
  });
});
