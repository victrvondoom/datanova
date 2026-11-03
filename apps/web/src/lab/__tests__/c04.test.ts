/**
 * Campaign 04 tests — evidence (T05), intent compiler (T06), scenario engine
 * (T16), recovery timeline (T20), sensitivity (T25), tenant matrix (T34),
 * and determinism/serialization proofs (T04).
 */

import { describe, it, expect } from "vitest";
import { cloneModel, serializeModel, parseModel, validateModel } from "../model";
import { docflowModel, flawedCheckoutModel } from "../samples";
import {
  captureFinding, captureRecording, userEvidence, checkEvidenceIntegrity,
  buildEvidencePack, serializeEvidencePack, parseEvidencePack, kindSummary,
  EvidencePackError, type EvidenceArtifact,
} from "../engines/evidence";
import { validateIntent, compileIntent, type IntentSpecInput } from "../engines/intent-compiler";
import {
  scenarioTemplate, validateScenario, runScenario, cloneScenario, ScenarioError,
} from "../engines/scenario";
import { recoveryTimeline, recoveryBottlenecks } from "../engines/recovery-timeline";
import { analyzeSensitivity, fullSensitivity } from "../engines/sensitivity";
import { generateTenantMatrix } from "../engines/tenantmatrix";
import { critiqueArchitecture } from "../engines/critic";
import { startRecording, record } from "../engines/flightrecorder";
import { runPlan } from "../engines/orchestrator";
import { extractGenome } from "../engines/genome";

// ---------------------------------------------------------------------------
// Task 05 — evidence and provenance
// ---------------------------------------------------------------------------

describe("T05 evidence and provenance infrastructure", () => {
  const m = docflowModel();
  const createdAt = "2026-01-01T00:00:00Z";

  it("captures findings with derived evidence kinds and full provenance", () => {
    const findings = [...critiqueArchitecture(m).findings, ...analyzeBoundaryFixtures()];
    const artifacts = findings.map((f) => captureFinding(f, { createdAt, archFingerprint: extractGenome(m).fingerprint }));
    expect(artifacts.length).toBeGreaterThan(3);
    const idem = artifacts.find((a) => a.source.includes("critic-idem"));
    expect(idem?.kind).toBe("inferred");
    expect(idem?.refs).toContain("component:upload-svc");
    expect(idem?.modelVersion).toBe(1);
    expect(idem?.archFingerprint).toBe(extractGenome(m).fingerprint);
    const kinds = kindSummary(artifacts);
    expect(kinds.inferred).toBeGreaterThan(0);
    expect(kinds.observed).toBe(0); // nothing in the lab is production-observed
  });

  it("captures recordings as simulated evidence with reproduction info", () => {
    const rec = startRecording("exp-1", "t0");
    const withEvents = record(rec, { t: 0, type: "fault", componentId: "meta-db", variable: "status", to: "down", detail: "x" });
    const art = captureRecording(withEvents, { createdAt, seed: 42 });
    expect(art.kind).toBe("simulated");
    expect(art.scenarioRef).toBe("exp-1");
    expect(art.reproduction?.seed).toBe(42);
    expect(art.refs).toContain("component:meta-db");
  });

  it("user-authored evidence carries the author in its source", () => {
    const art = userEvidence("Legal review pending for document classification",
      ["dataEntity:de-doc"], { createdAt, author: "legal-team" });
    expect(art.kind).toBe("user-authored");
    expect(art.source).toBe("user:legal-team");
  });

  it("integrity: dangling references, missing provenance, and unknown kinds are rejected", () => {
    const good = captureFinding(critiqueArchitecture(m).findings[0], { createdAt });
    expect(checkEvidenceIntegrity(m, [good]).ok).toBe(true);
    const dangling: EvidenceArtifact = {
      id: "ev-x", kind: "simulated", source: "engine:test", summary: "claim",
      createdAt, modelVersion: 1, assumptions: [], refs: ["component:ghost"],
    };
    const noSource: EvidenceArtifact = {
      id: "ev-y", kind: "simulated", source: "", summary: "claim",
      createdAt, modelVersion: 1, assumptions: [], refs: [],
    };
    const issues = checkEvidenceIntegrity(m, [dangling, noSource]);
    expect(issues.ok).toBe(false);
    expect(issues.issues.some((i) => i.problem.includes("does not resolve"))).toBe(true);
    expect(issues.issues.some((i) => i.problem.includes("missing source"))).toBe(true);
  });

  it("evidence packs export deterministically and reject malformed imports", () => {
    const artifacts = critiqueArchitecture(m).findings.map((f) => captureFinding(f, { createdAt }));
    const p1 = buildEvidencePack("pack-1", artifacts, createdAt);
    const p2 = buildEvidencePack("pack-1", artifacts, createdAt);
    expect(serializeEvidencePack(p1)).toBe(serializeEvidencePack(p2)); // byte-stable
    expect(p1.artifacts.length).toBe(artifacts.length);
    const parsed = parseEvidencePack(serializeEvidencePack(p1));
    expect(parsed.packId).toBe("pack-1");
    expect(() => parseEvidencePack("{bad")).toThrow(EvidencePackError);
    expect(() => parseEvidencePack(JSON.stringify({ schemaVersion: 99, artifacts: [] }))).toThrow(/unsupported/);
    expect(() => parseEvidencePack(JSON.stringify({ schemaVersion: 1, artifacts: [{ id: "x" }] }))).toThrow(/provenance/);
  });
});

function analyzeBoundaryFixtures() {
  // additional critic fixtures for kind-derivation coverage (the security
  // benchmark dimension covers trust analysis directly)
  return critiqueArchitecture(flawedCheckoutModel()).findings;
}

// ---------------------------------------------------------------------------
// Task 06 — intent compiler
// ---------------------------------------------------------------------------

describe("T06 architecture intent compiler", () => {
  const wellFormed: IntentSpecInput = {
    goal: "Let users upload documents and get processed results",
    peakRps: 50, latencyDeadlineMs: 800, availabilityPercent: 99.9,
    strictReadAfterWrite: false, processingSeconds: 4, monthlyCostCapUsd: 250,
    constraints: ["Documents are sensitive business data"],
    assumptions: [{ statement: "peak traffic is bursty", source: "product estimate", confidence: 0.6 }],
  };

  it("compiles a well-formed intent into a valid starter model with mapped requirements", () => {
    const compiled = compileIntent(wellFormed);
    expect(compiled.problems).toEqual([]);
    expect(validateModel(compiled.model)).toEqual([]);
    // processing takes seconds -> queue + worker shape
    expect(compiled.model.components.some((c) => c.kind === "queue")).toBe(true);
    expect(compiled.model.components.some((c) => c.kind === "worker")).toBe(true);
    expect(compiled.model.requirements.length).toBeGreaterThanOrEqual(6); // FR + throughput + latency + availability + consistency + cost
    expect(compiled.createdRequirements.some((r) => r.id === "INT-3")).toBe(true);
    expect(compiled.model.assumptions[0]?.source).toBe("product estimate");
  });

  it("flags incomplete intent without inventing values", () => {
    const problems = validateIntent({ goal: "x", constraints: [], assumptions: [] });
    expect(problems.some((p) => p.kind === "invalid" && p.detail.includes("goal"))).toBe(true);
    expect(problems.some((p) => p.kind === "incomplete" && p.detail.includes("peak workload"))).toBe(true);
    expect(problems.some((p) => p.kind === "incomplete" && p.detail.includes("latency deadline"))).toBe(true);
    const compiled = compileIntent({ goal: "A short but valid goal statement", constraints: [], assumptions: [] });
    expect(compiled.unresolved.some((u) => u.includes("peak workload"))).toBe(true);
    expect(compiled.unresolved.some((u) => u.includes("communication mode"))).toBe(true); // processing time unknown
    // the starter model is still valid and adopts a minimal shape
    expect(validateModel(compiled.model)).toEqual([]);
    expect(compiled.model.components.some((c) => c.kind === "queue")).toBe(false);
  });

  it("flags contradictory intent (result read-after-write inside an impossible deadline)", () => {
    expect(validateIntent(wellFormed)).toEqual([]); // sanity: the well-formed spec has no problems
    const problems = validateIntent({ ...wellFormed, strictReadAfterWrite: true });
    expect(problems.some((p) => p.kind === "contradictory")).toBe(true);
    expect(problems[0].detail).toContain("cannot be both fully processed and immediately consistent");
  });

  it("flags ambiguous and invalid values", () => {
    const ambiguous = validateIntent({ goal: "Process documents somehow", constraints: [], assumptions: [] });
    expect(ambiguous.some((p) => p.kind === "ambiguous" && p.detail.includes("processing time"))).toBe(true);
    const invalid = validateIntent({ ...wellFormed, peakRps: -5, availabilityPercent: 42,
      assumptions: [{ statement: "s", source: "", confidence: 2 }] });
    expect(invalid.filter((p) => p.kind === "invalid").length).toBeGreaterThanOrEqual(3);
  });

  it("compilation is deterministic", () => {
    const a = compileIntent(wellFormed);
    const b = compileIntent(wellFormed);
    expect(a.model.components.map((c) => c.id).join()).toBe(b.model.components.map((c) => c.id).join());
    expect(serializeModel(a.model)).toBe(serializeModel(b.model));
  });
});

// ---------------------------------------------------------------------------
// Task 16 — scenario engine
// ---------------------------------------------------------------------------

describe("T16 scenario engine", () => {
  const m = docflowModel();

  it("templates are valid against their architecture and run deterministically", () => {
    const s = scenarioTemplate("peak-hour-outage", m, 50);
    const v = validateScenario(m, s);
    expect(v.valid).toBe(true);
    const r1 = runScenario(m, s);
    const r2 = runScenario(m, s);
    expect(r1).toEqual(r2);
    expect(r1.deterministic).toBe(true);
    expect(r1.allPassed).toBe(true);
    expect(r1.expectationResults[0].outcome).toBe("pass");
  });

  it("burst overload template demonstrates queue saturation", () => {
    const s = scenarioTemplate("burst-overload", m, 50);
    const r = runScenario(m, s);
    expect(r.workload.saturated).toBe(true);
    expect(r.allPassed).toBe(true); // the expectation EXPECTS saturation
  });

  it("rejects scenarios authored against a different architecture", () => {
    const s = scenarioTemplate("dependency-brownout", m, 50);
    const other = flawedCheckoutModel();
    const v = validateScenario(other, s);
    expect(v.valid).toBe(false);
    expect(v.problems.some((p) => p.includes("genome"))).toBe(true);
    expect(() => runScenario(other, s)).toThrow(ScenarioError);
  });

  it("cloning re-targets a scenario onto a new architecture and bumps the version", () => {
    const s = scenarioTemplate("peak-hour-outage", m, 50);
    const modified = cloneModel(m);
    modified.components.find((c) => c.id === "worker")!.config.concurrency = 16;
    const clone = cloneScenario(s, modified);
    expect(clone.version).toBe(2);
    expect(clone.archFingerprint).toBe(extractGenome(modified).fingerprint);
    expect(clone.provenance).toContain("cloned from");
    expect(validateScenario(modified, clone).valid).toBe(true);
    const run = runScenario(modified, clone);
    expect(run.allPassed).toBe(true);
  });

  it("invalid scenarios are rejected with precise problems", () => {
    const s = scenarioTemplate("peak-hour-outage", m, 50);
    const broken = { ...s, faults: [{ ...s.faults[0], componentId: "ghost" }], expectations: [
      { ...s.expectations[0], target: ["op-ghost"], expected: "" },
    ] };
    const v = validateScenario(m, broken);
    expect(v.problems.some((p) => p.includes("unknown component ghost"))).toBe(true);
    expect(v.problems.some((p) => p.includes("unknown operation op-ghost"))).toBe(true);
    expect(v.problems.some((p) => p.includes("no stated expected outcome"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 20 — recovery timeline
// ---------------------------------------------------------------------------

describe("T20 recovery timeline and state reconstruction", () => {
  const m = docflowModel();

  it("reconstructs per-component phases from a recorded run", () => {
    // fault plan with a bounded outage -> recovery recorded
    const plan = { id: "p", steps: [
      { id: "f1", componentId: "meta-db", fault: "down" as const, atMin: 0, durationMin: 5 },
    ] };
    const run = runPlan(m, plan);
    const tl = recoveryTimeline(m, run.recording);
    const meta = tl.components.find((c) => c.componentId === "meta-db");
    expect(meta?.finalPhase).toBe("recovered");
    expect(meta?.steps.map((s) => s.phase)).toEqual(["faulted", "recovering"]);
    expect(tl.finalSummary.recovered).toBe(1);
    // faulted: meta-db, upload-svc, worker, gateway, web (status-cache is only
    // degraded, which is not a fault); the rest never faulted
    expect(tl.components.length).toBe(5);
    expect(tl.finalSummary.neverFaulted).toBe(m.components.length - tl.components.length);
    expect(tl.anomalies).toEqual([]);
  });

  it("unbounded faults leave stalled components and report bottlenecks", () => {
    const plan = { id: "p", steps: [
      { id: "f1", componentId: "worker", fault: "down" as const, atMin: 0 }, // no duration
    ] };
    const run = runPlan(m, plan);
    const tl = recoveryTimeline(m, run.recording);
    const worker = tl.components.find((c) => c.componentId === "worker");
    expect(worker?.finalPhase).toBe("stalled");
    const bottlenecks = recoveryBottlenecks(tl);
    expect(bottlenecks.some((b) => b.componentId === "worker")).toBe(true);
    expect(bottlenecks[0].unblockingAction).toContain("worker");
  });

  it("partial recovery distinguishes recovered vs still-faulted components", () => {
    let rec = startRecording("exp", "t0");
    rec = record(rec, { t: 0, type: "fault", componentId: "meta-db", variable: "status", to: "down", detail: "injected" });
    rec = record(rec, { t: 0, type: "status-change", componentId: "upload-svc", variable: "status", to: "down", detail: "blocked" });
    rec = record(rec, { t: 60, type: "recovery", componentId: "meta-db", variable: "status", to: "up", detail: "restored" });
    const tl = recoveryTimeline(m, rec);
    expect(tl.components.find((c) => c.componentId === "meta-db")?.finalPhase).toBe("recovered");
    expect(tl.components.find((c) => c.componentId === "upload-svc")?.finalPhase).toBe("stalled");
    expect(tl.finalSummary.recovered).toBe(1);
    expect(tl.finalSummary.stalled).toBe(1);
  });

  it("re-faulted components and invalid sequences are detected", () => {
    let rec = startRecording("exp", "t0");
    rec = record(rec, { t: 0, type: "fault", componentId: "meta-db", variable: "status", to: "down", detail: "first" });
    rec = record(rec, { t: 10, type: "recovery", componentId: "meta-db", variable: "status", to: "up", detail: "restored" });
    rec = record(rec, { t: 20, type: "fault", componentId: "meta-db", variable: "status", to: "down", detail: "again" });
    let tl = recoveryTimeline(m, rec);
    expect(tl.components.find((c) => c.componentId === "meta-db")?.finalPhase).toBe("re-faulted");
    // recovery before any fault is invalid
    let bad = startRecording("bad", "t0");
    bad = record(bad, { t: 0, type: "recovery", componentId: "meta-db", variable: "status", to: "up", detail: "?" });
    tl = recoveryTimeline(m, bad);
    expect(tl.anomalies.some((a) => a.problem.includes("invalid sequence"))).toBe(true);
    // unknown components are kept but flagged
    let ghost = startRecording("g", "t0");
    ghost = record(ghost, { t: 0, type: "fault", componentId: "ghost-comp", variable: "status", to: "down", detail: "?" });
    tl = recoveryTimeline(m, ghost);
    expect(tl.anomalies.some((a) => a.problem.includes("unknown component ghost-comp"))).toBe(true);
    expect(tl.components.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 25 — sensitivity and uncertainty
// ---------------------------------------------------------------------------

describe("T25 sensitivity and uncertainty analysis", () => {
  const m = docflowModel();

  it("sweeps the peak-rate assumption and identifies sensitive outputs", () => {
    const r = analyzeSensitivity(m, "op-upload", { parameter: "peakRps", multipliers: [0.5, 1, 2] });
    expect(r.runs.length).toBe(3);
    expect(r.declaredValue).toBeGreaterThan(0);
    expect(r.sensitiveOutputs).toContain("bottleneckUtilization");
    expect(r.note).toContain("not measurements");
  });

  it("flags the deadline verdict as fragile when the sweep flips it", () => {
    // tighten the budget so a 2x latency sweep flips the deadline verdict
    const tight = cloneModel(m);
    tight.latencyBudget!.deadlineMs = 400;
    const r = analyzeSensitivity(tight, "op-upload", { parameter: "latencyHopMs", multipliers: [0.5, 1, 2] });
    expect(r.fragileConclusions.some((c) => c.includes("FLIPS"))).toBe(true);
    expect(r.sensitiveOutputs).toContain("criticalPathLatencyMs");
  });

  it("processing-time sweeps move the bottleneck; idempotency gaps do not flip", () => {
    const r = analyzeSensitivity(m, "op-upload", { parameter: "processingMs", multipliers: [0.5, 1, 2] });
    expect(r.sensitiveOutputs).toContain("bottleneckUtilization");
    expect(r.sensitiveOutputs).not.toContain("idempotencyGaps");
  });

  it("full sensitivity ranks parameters and is reproducible", () => {
    const a = fullSensitivity(m, "op-upload");
    const b = fullSensitivity(m, "op-upload");
    expect(a.results.length).toBe(4);
    expect(a.mostInfluential.length).toBe(4);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // deterministic
  });
});

// ---------------------------------------------------------------------------
// Task 34 — tenant-isolation test matrix
// ---------------------------------------------------------------------------

describe("T34 tenant-isolation test matrix", () => {
  it("generates an executable matrix with explicit violations for missing mechanisms", () => {
    const matrix = generateTenantMatrix(docflowModel());
    expect(matrix.cases.length).toBeGreaterThan(8);
    // docflow: meta-db is isolated, status-cache/work-queue/doc-store are not
    expect(matrix.violations).toBeGreaterThan(0);
    expect(matrix.uncoveredEntities.some((u) => u.holder === "status-cache")).toBe(true);
    expect(matrix.uncoveredEntities.some((u) => u.holder === "doc-store")).toBe(true);
    // a violation never claims silent success
    const violation = matrix.results.find((r) => r.outcome === "violation")!;
    expect(violation.detail).toContain("explicit violation");
    // same-tenant read of the isolated database passes
    const sameDb = matrix.results.find((r) => r.caseId.includes("meta-db") && r.caseId.includes("same-read"));
    expect(sameDb?.outcome).toBe("pass");
  });

  it("declaring mechanisms on every holder clears all violations", () => {
    const m = cloneModel(docflowModel());
    m.components.find((c) => c.id === "status-cache")!.config.tenantKeyPrefix = "tenant";
    m.components.find((c) => c.id === "work-queue")!.config.tenantKey = "tenant_id";
    m.components.find((c) => c.id === "doc-store")!.config.tenantKey = "tenant_id";
    const matrix = generateTenantMatrix(m);
    expect(matrix.violations).toBe(0);
    expect(matrix.uncoveredEntities).toEqual([]);
    expect(matrix.passed).toBe(matrix.cases.length);
    // deterministic
    expect(JSON.stringify(matrix)).toBe(JSON.stringify(generateTenantMatrix(m)));
  });

  it("cross-tenant cases are generated for every holder, same-tenant writes only for owners", () => {
    const matrix = generateTenantMatrix(docflowModel());
    const crossRead = matrix.cases.filter((c) => c.kind === "cross-tenant-read");
    const crossWrite = matrix.cases.filter((c) => c.kind === "cross-tenant-write");
    const sameWrite = matrix.cases.filter((c) => c.kind === "same-tenant-write");
    expect(crossRead.length).toBeGreaterThan(3); // every holder
    expect(sameWrite.length).toBeGreaterThan(0);
    // writes only from authoritative owners (doc-store owns de-doc/de-pdf, meta-db owns de-meta)
    expect(crossWrite.every((c) => ["doc-store", "meta-db"].includes(c.componentId))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 04 — determinism and serialization proofs
// ---------------------------------------------------------------------------

describe("T04 determinism, serialization, and replay proofs", () => {
  it("model serialization is byte-stable and round-trips", () => {
    const a = serializeModel(docflowModel());
    const b = serializeModel(docflowModel());
    expect(a).toBe(b);
    expect(parseModel(a)).toEqual(docflowModel());
  });

  it("engine outputs are identical for identical inputs (replay proof)", () => {
    const m = docflowModel();
    const plan = { id: "p", steps: [
      { id: "f1", componentId: "meta-db", fault: "down" as const, atMin: 0, durationMin: 5 },
      { id: "f2", componentId: "worker", fault: "slow" as const, atMin: 2, dependsOn: ["f1"] },
    ] };
    const r1 = runPlan(m, plan);
    const r2 = runPlan(m, plan);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    expect(r1.executedSteps).toEqual(r2.executedSteps);
  });

  it("component reordering does not change semantics (genome stability)", () => {
    const m = cloneModel(docflowModel());
    m.components.reverse();
    m.connections.reverse();
    expect(serializeModel(docflowModel()).length > 0).toBe(true);
    expect(extractGenome(m).fingerprint).toBe(extractGenome(docflowModel()).fingerprint);
    expect(validateModel(m)).toEqual([]);
  });
});
