/**
 * Campaign 03, Milestone 9 tests — benchmark suite (T41), experiment packages (T42),
 * extension SDK (T43), learning modes (T44), capstone (T45).
 */

import { describe, it, expect } from "vitest";
import { docflowModel } from "../samples";
import { runBenchmark, renderBenchmarkReport, BENCHMARK_CORPUS } from "../engines/benchmark";
import {
  exportPackage, parsePackage, reproducePackage, packageTemplateExperiment, PackageError,
} from "../engines/package";
import {
  emptyRegistry, registerExtension, instantiateExtension, analysisSupport,
  validateExtension, serializeExtension, parseExtension, ExtensionError,
  type ComponentExtension,
} from "../engines/extension";
import { MODE_CONFIGS, modeConfig, presentFindings, analyzeIndependentOfMode, type LearningMode } from "../engines/modes";
import {
  runIntelligenceWorkflow, runImprovementWorkflow, buildFinalEvidencePackage, runCapstone,
} from "../engines/capstone";
import { recordRevision } from "../engines/mission";

// ---------------------------------------------------------------------------
// Task 41 — intelligence benchmark
// ---------------------------------------------------------------------------

describe("T41 architecture intelligence benchmark", () => {
  it("runs the corpus and computes metrics from actual runs", () => {
    const run = runBenchmark(null, "2026-01-01");
    expect(run.items.length).toBe(4);
    const flawed = run.items.find((i) => i.corpusId === "flawed-checkout")!;
    expect(flawed.truePositives.length).toBe(6);
    expect(flawed.falseNegatives).toEqual([]);
    expect(flawed.precision).toBe(1);
    expect(run.summary.recall).toBe(1);
    expect(run.summary.unsupportedClaimRate).toBe(0); // every finding is grounded
  });

  it("does not flag critical-path SPOFs on an operation-free minimal model", () => {
    const run = runBenchmark(null, "t");
    const minimal = run.items.find((i) => i.corpusId === "minimal")!;
    expect(minimal.falsePositives).toEqual([]);
  });

  it("renders an honest report with limitations and regression deltas", () => {
    const first = runBenchmark(null, "2026-01-01");
    const report = renderBenchmarkReport(first);
    expect(report).toContain("# Architecture Intelligence Benchmark Report");
    expect(report).toContain("| flawed-checkout |");
    expect(report).toContain("## Limitations");
    expect(report).toContain("not scored here");
    const second = runBenchmark(first, "2026-01-02");
    expect(second.deltaVsPrevious).toEqual({ precision: 0, recall: 0 }); // unchanged ruleset
    expect(BENCHMARK_CORPUS.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Task 42 — reproducible experiment packages
// ---------------------------------------------------------------------------

describe("T42 reproducible experiment packages", () => {
  const pkg = () => packageTemplateExperiment(docflowModel(), "component-failure", "meta-db",
    { packageId: "pkg-1", label: "meta-db down", createdAt: "2026-01-01T00:00:00Z", seed: 42 },
    ["op-upload", "op-process", "op-status", "op-report", "op-delete"]);

  it("exports a complete, versioned package", () => {
    const p = pkg();
    expect(p.schemaVersion).toBe(1);
    expect(p.rulesetVersion).toBeTruthy();
    expect(p.modelVersion).toBe(1);
    expect(p.seed).toBe(42);
    expect(p.assumptionIds).toContain("ASM-1");
  });

  it("round-trips through JSON and reproduces deterministically", () => {
    const p = pkg();
    const parsed = parsePackage(JSON.stringify(p));
    const r1 = reproducePackage(parsed);
    const r2 = reproducePackage(parsed);
    expect(r1).toEqual(r2);
    expect(r1.verdict).toBe("supported");
    expect(r1.matchesOriginal).toBeNull();
    const compared = reproducePackage(parsed, r1);
    expect(compared.matchesOriginal).toBe(true);
  });

  it("rejects malformed, incomplete, and future-version packages safely", () => {
    expect(() => parsePackage("{bad json")).toThrow(PackageError);
    expect(() => parsePackage(JSON.stringify({ ...pkg(), seed: undefined }))).toThrow(/seed/);
    expect(() => parsePackage(JSON.stringify({ ...pkg(), schemaVersion: 99 }))).toThrow(/unsupported package schema/);
    expect(() => parsePackage(JSON.stringify({ ...pkg(), experiment: { incomplete: true } }))).toThrow(/incomplete/);
    // embedded architecture must be valid too
    const tampered = { ...pkg(), architecture: "{invalid" };
    expect(() => parsePackage(JSON.stringify(tampered))).toThrow(PackageError);
  });
});

// ---------------------------------------------------------------------------
// Task 43 — component extension SDK
// ---------------------------------------------------------------------------

describe("T43 architecture component extension SDK", () => {
  const ext = (): ComponentExtension => ({
    id: "ext-vector-search", name: "Vector search", version: "1.0.0", kind: "service",
    description: "Embedding-based document similarity search",
    configSchema: [{ key: "dimensions", type: "number", required: true, description: "embedding dimensions" }],
    semantics: { failureBehavior: "degrades", stateful: false, behavior: "answers similarity queries; falls back to keyword search on failure" },
    supportedAnalyses: ["causal", "blast-radius", "genome"],
    unsupportedAnalyses: ["consistency", "tenant"],
    docs: "Custom component for similarity search. Models query latency; does NOT model consistency or tenant isolation — those analyses are explicitly unknown.",
  });

  it("validates definitions: semantics, docs, and version are mandatory", () => {
    expect(validateExtension(ext())).toEqual([]);
    expect(validateExtension({ ...ext(), semantics: undefined }).some((p) => p.includes("semantics"))).toBe(true);
    expect(validateExtension({ ...ext(), docs: "short" }).some((p) => p.includes("docs"))).toBe(true);
    expect(validateExtension({ ...ext(), version: "1" }).some((p) => p.includes("semver"))).toBe(true);
  });

  it("registers safely, rejects duplicates and instantiates with required config", () => {
    let reg = emptyRegistry();
    reg = registerExtension(reg, ext());
    const comp = instantiateExtension(reg, "ext-vector-search", "Doc search", { dimensions: 768 }, { requirementIds: ["FR-2"] });
    expect(comp.kind).toBe("service");
    expect(comp.config.extensionId).toBe("ext-vector-search");
    expect(comp.requirementIds).toEqual(["FR-2"]);
    expect(() => registerExtension(reg, ext())).toThrow(/already registered/);
    expect(() => instantiateExtension(reg, "ext-vector-search", "X", {})).toThrow(/missing required config/);
    expect(() => instantiateExtension(reg, "ext-ghost", "X", {})).toThrow(/unknown extension/);
  });

  it("analysis capabilities are explicit: supported/unsupported/unknown", () => {
    let reg = emptyRegistry();
    reg = registerExtension(reg, ext());
    expect(analysisSupport(reg, "ext-vector-search", "causal")).toBe("supported");
    expect(analysisSupport(reg, "ext-vector-search", "tenant")).toBe("unsupported");
    expect(analysisSupport(reg, "ext-vector-search", "latency")).toBe("unknown"); // not declared
    expect(analysisSupport(reg, "ext-ghost", "causal")).toBe("unknown");
  });

  it("extensions round-trip as data and never execute", () => {
    const parsed = parseExtension(serializeExtension(ext()));
    expect(parsed.id).toBe("ext-vector-search");
    expect(() => parseExtension(JSON.stringify({ ...ext(), semantics: undefined }))).toThrow(ExtensionError);
    // an extension is plain data: no function properties survive serialization
    expect(JSON.stringify(ext())).not.toContain("function");
  });
});

// ---------------------------------------------------------------------------
// Task 44 — learning modes
// ---------------------------------------------------------------------------

describe("T44 expert/beginner modes", () => {
  it("three modes share one engine set with different presentation", () => {
    expect(Object.keys(MODE_CONFIGS)).toEqual(["beginner", "intermediate", "expert"]);
    expect(modeConfig("beginner").explanationLevel).toBe("concise");
    expect(modeConfig("expert").showRawEngineOutput).toBe(true);
    expect(modeConfig("beginner").guidance).toContain("nothing is hidden");
  });

  it("beginners see critical findings first; experts see everything flat", () => {
    const findings = [
      { id: "a", severity: "info" as const, title: "t", detail: "d", evidence: [], source: "x" },
      { id: "b", severity: "critical" as const, title: "t", detail: "d", evidence: [], source: "x" },
    ];
    const beginner = presentFindings("beginner", findings);
    expect(beginner.headline.map((f) => f.id)).toEqual(["b"]);
    const expert = presentFindings("expert", findings);
    expect(expert.headline.length).toBe(2);
  });

  it("mode changes NEVER change analysis semantics or saved data", () => {
    const m = docflowModel();
    const results = (["beginner", "intermediate", "expert"] as LearningMode[])
      .map(() => analyzeIndependentOfMode(m));
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    // and the model was never touched
    expect(m.components.length).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Task 45 — capstone
// ---------------------------------------------------------------------------

describe("T45 architecture intelligence capstone", () => {
  it("runs the full intelligence workflow on one architecture version", () => {
    const m = docflowModel();
    const intel = runIntelligenceWorkflow(m, { operationId: "op-upload", rps: 50 });
    expect(intel.archId).toBe("arch-docflow");
    expect(intel.intentFindings.length).toBeGreaterThan(0);
    expect(intel.causalFindings.length).toBeGreaterThan(0);
    expect(intel.consistencyChecks.length).toBe(2);
    expect(intel.securityFindings.length).toBeGreaterThan(3);
    expect(intel.capacity.bottleneck?.componentId).toBe("worker");
    expect(intel.latency.modeledMs).toBe(350);
    expect(intel.criticFindings.length).toBeGreaterThan(0);
    expect(intel.scorecard.dimensions.length).toBe(7);
    expect(intel.totalFindings).toBeGreaterThan(10);
  });

  it("runs the improvement workflow with a recorded, reproducible counterfactual", () => {
    const m = docflowModel();
    const imp = runImprovementWorkflow(m, { operationId: "op-upload", rps: 50, declaredChanges: ["idempotencyCoverage"] });
    expect(imp.improvements[0].description).toContain("Upload service");
    expect(imp.revisedModel.components.find((c) => c.id === "upload-svc")?.config.idempotent).toBe(true);
    expect(m.components.find((c) => c.id === "upload-svc")?.config.idempotent).toBe(false); // baseline untouched
    expect(imp.counterfactual.uncontrolledChanges).toEqual([]);
    expect(imp.counterfactualIsReproducible).toBe(true);
    expect(imp.recordingEvents).toBeGreaterThan(5);
  });

  it("builds the final evidence package with coverage, risks, limitations, and open questions", () => {
    const m = docflowModel();
    const intel = runIntelligenceWorkflow(m, { operationId: "op-upload", rps: 50 });
    const imp = runImprovementWorkflow(m, { operationId: "op-upload", rps: 50, declaredChanges: ["idempotencyCoverage"] });
    const pkg = buildFinalEvidencePackage(imp.revisedModel, intel, imp, {
      generatedAt: "2026-01-01T00:00:00Z",
      benchmarkLimitations: ["critic-only corpus"],
    });
    expect(pkg.architectureSummary.components).toBe(10);
    expect(pkg.architectureSummary.validationErrors).toEqual([]);
    // CON-1 (cost cap) has no architectural mapping in the seeded model: honestly reported
    expect(pkg.requirementCoverage.uncovered).toEqual(["CON-1"]);
    expect(pkg.adrs.length).toBe(2);
    expect(pkg.openQuestions.some((q) => q.includes("ASM-1"))).toBe(true);
    expect(pkg.openQuestions.some((q) => q.includes("not load-test"))).toBe(true);
    expect(pkg.recoveryEvidence.length).toBe(7);
    expect(pkg.experimentResults.reproducible).toBe(true);
  });

  it("the complete capstone run integrates intelligence, improvement, evidence, and mission", () => {
    const cap = runCapstone({
      generatedAt: "2026-01-01T00:00:00Z",
      benchmarkLimitations: ["critic-only corpus"],
      revisions: [recordRevision([], "after-first-analysis", "scaled workers", "MC-5 doubled peak traffic")],
    });
    expect(cap.evidence.title).toContain("DocFlow");
    expect(cap.missionEvaluation.revisionsTracked).toBe(true);
    expect(cap.intelligence.scorecard.dimensions.length).toBe(7);
    // determinism: a second run produces the identical evidence package
    const cap2 = runCapstone({
      generatedAt: "2026-01-01T00:00:00Z",
      benchmarkLimitations: ["critic-only corpus"],
      revisions: [recordRevision([], "after-first-analysis", "scaled workers", "MC-5 doubled peak traffic")],
    });
    expect(cap2.evidence).toEqual(cap.evidence);
  });
});
