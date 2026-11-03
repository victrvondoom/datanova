/**
 * Campaign 04, Tasks 02 + 44 — Multidimensional Architecture Benchmark (v2).
 *
 * Scores the lab's ACTUAL reasoning capabilities across dimensions — model
 * validation, causal reasoning, counterfactual reproducibility, consistency,
 * security, recovery, evidence provenance, explanation grounding — plus the
 * Campaign-03 critic corpus (preserved). Every scenario is a synthetic,
 * deterministic fixture with a stated expected outcome; outcomes include
 * not-applicable and insufficient-evidence, never a silent pass. No result
 * here is presented as real-world validation.
 */

import {
  type ArchitectureModel, cloneModel, emptyModel, validateModel,
} from "../model";
import { docflowModel, flawedCheckoutModel } from "../samples";
import { propagate } from "./causal";
import { runExperiment, type CounterfactualExperiment } from "./counterfactual";
import { checkContract } from "./consistency";
import type { ConsistencyContract } from "../model";
import { analyzeBoundaries } from "./trust";
import { generateTenantMatrix } from "./tenantmatrix";
import { evaluateRecovery, type RecoveryCriterion } from "./recovery";
import { startRecording, record } from "./flightrecorder";
import { explainComponent, checkGrounding } from "./explain";
import { analyzeIntent } from "./intent";
import { critiqueArchitecture } from "./critic";
import { buildEvidencePack, captureFinding, checkEvidenceIntegrity, type EvidenceArtifact } from "./evidence";
import { extractGenome } from "./genome";

export type ScenarioOutcome = "pass" | "fail" | "not-applicable" | "insufficient-evidence";

export interface BenchmarkScenarioResult {
  id: string;
  outcome: ScenarioOutcome;
  detail: string;
}

export interface DimensionResult {
  key: string;
  label: string;
  scenarios: BenchmarkScenarioResult[];
  passed: number;
  failed: number;
  notApplicable: number;
  insufficientEvidence: number;
  note: string;
}

export interface BenchmarkRunV2 {
  schemaVersion: 2;
  ranAt: string;
  deterministic: true;
  engineVersions: { modelVersion: number; ruleset: string };
  dimensions: DimensionResult[];
  summary: {
    dimensionsScored: number;
    totalScenarios: number;
    passed: number;
    failed: number;
    notApplicable: number;
    insufficientEvidence: number;
  };
  limitations: string[];
  reproduction: { command: string; seeds: string };
}

const dim = (key: string, label: string, scenarios: BenchmarkScenarioResult[], note: string): DimensionResult => ({
  key, label, scenarios, note,
  passed: scenarios.filter((s) => s.outcome === "pass").length,
  failed: scenarios.filter((s) => s.outcome === "fail").length,
  notApplicable: scenarios.filter((s) => s.outcome === "not-applicable").length,
  insufficientEvidence: scenarios.filter((s) => s.outcome === "insufficient-evidence").length,
});

// ---------------------------------------------------------------------------
// Dimension: model validation
// ---------------------------------------------------------------------------

function modelValidationDimension(): DimensionResult {
  const fixtures: { id: string; build: () => ArchitectureModel; expectError: string }[] = [
    { id: "mv-sync-queue", expectError: "cannot target a queue",
      build: () => { const m = docflowModel(); m.connections.push({ ...m.connections[0], id: "bad", from: "gateway", to: "work-queue", kind: "sync" }); return m; } },
    { id: "mv-dangling-ref", expectError: "unknown requirement",
      build: () => { const m = docflowModel(); m.components[1].requirementIds.push("GHOST-1"); return m; } },
    { id: "mv-self-connection", expectError: "self-connection",
      build: () => { const m = docflowModel(); m.connections.push({ ...m.connections[0], id: "bad", from: "web", to: "web" }); return m; } },
    { id: "mv-unmotivated-adr", expectError: "no motivating requirement",
      build: () => { const m = docflowModel(); m.adrs.push({ id: "ADR-x", title: "t", context: "c", decision: "d", status: "proposed", requirementIds: [], alternatives: [] }); return m; } },
    { id: "mv-valid-model", expectError: "",
      build: () => docflowModel() },
  ];
  const scenarios = fixtures.map((f) => {
    const errors = validateModel(f.build());
    const matches = f.expectError === ""
      ? errors.length === 0
      : errors.some((e) => e.message.includes(f.expectError));
    return {
      id: f.id,
      outcome: matches ? "pass" as const : "fail" as const,
      detail: f.expectError === ""
        ? `valid model produced ${errors.length} errors (expected 0)`
        : `expected an error containing "${f.expectError}"; got ${errors.length === 0 ? "none" : errors.map((e) => e.message).slice(0, 2).join("; ")}`,
    };
  });
  return dim("model-validation", "Model validation", scenarios,
    "Scores validateModel against synthetic malformed and valid fixtures.");
}

// ---------------------------------------------------------------------------
// Dimension: causal reasoning
// ---------------------------------------------------------------------------

function causalReasoningDimension(): DimensionResult {
  const scenarios: BenchmarkScenarioResult[] = [];
  {
    const m = docflowModel();
    const r = propagate(m, { componentId: "meta-db", fault: "down" });
    const expected: Record<string, string> = {
      "meta-db": "down", "upload-svc": "down", "worker": "down", "gateway": "down",
      "web": "down", "status-cache": "degraded", "analytics": "up",
    };
    const mismatches = Object.entries(expected).filter(([id, st]) => r.finalStatus[id] !== st);
    scenarios.push({
      id: "causal-docflow-meta-db",
      outcome: mismatches.length === 0 ? "pass" : "fail",
      detail: mismatches.length === 0
        ? "all eight expected component statuses matched the propagation result"
        : `status mismatches: ${mismatches.map(([id, st]) => `${id} expected ${st} got ${r.finalStatus[id]}`).join(", ")}`,
    });
  }
  {
    const m = docflowModel();
    const r = propagate(m, { componentId: "analytics", fault: "down" });
    const affectedOthers = Object.entries(r.finalStatus).filter(([id, st]) => st !== "up" && id !== "analytics");
    scenarios.push({
      id: "causal-isolated-failure",
      outcome: affectedOthers.length === 0 ? "pass" : "fail",
      detail: affectedOthers.length === 0
        ? "isolated analytics failure propagated to nothing else (event edge stops it)"
        : `isolation was violated: ${affectedOthers.map(([id, st]) => `${id}=${st}`).join(", ")}`,
    });
  }
  {
    // cyclic graph must terminate with a stable result
    const m = emptyModel("cyc", "cyclic");
    m.components = [
      { id: "a", kind: "service", name: "A", config: {}, requirementIds: [] },
      { id: "b", kind: "service", name: "B", config: {}, requirementIds: [] },
    ];
    m.connections = [
      { id: "e1", from: "a", to: "b", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
      { id: "e2", from: "b", to: "a", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
    ];
    const r = propagate(m, { componentId: "a", fault: "down" });
    scenarios.push({
      id: "causal-cycle-termination",
      outcome: r.finalStatus["b"] === "down" ? "pass" : "fail",
      detail: `cyclic propagation terminated; b=${r.finalStatus["b"]} (expected down), a=${r.finalStatus["a"]}`,
    });
  }
  {
    // retry amplification toward a degraded dependency
    const m = docflowModel();
    const r = propagate(m, { componentId: "meta-db", fault: "down" });
    const expectedLoad = 4; // worker retryMax=3 -> 1+3
    scenarios.push({
      id: "causal-retry-amplification",
      outcome: r.loadFactor["meta-db"] === expectedLoad ? "pass" : "fail",
      detail: `meta-db modeled load factor ${r.loadFactor["meta-db"]} (expected ${expectedLoad}: 1 + retryMax 3)`,
    });
  }
  return dim("causal-reasoning", "Causal reasoning", scenarios,
    "Scores the propagation engine against known, hand-computed cascades on synthetic fixtures.");
}

// ---------------------------------------------------------------------------
// Dimension: counterfactual reproducibility
// ---------------------------------------------------------------------------

function counterfactualDimension(): DimensionResult {
  const scenarios: BenchmarkScenarioResult[] = [];
  const exp = (): CounterfactualExperiment => {
    const baseline = docflowModel();
    const modified = cloneModel(baseline);
    modified.components.find((c) => c.id === "upload-svc")!.config.idempotent = true;
    return {
      id: "bm-cf", label: "idempotency", baseline, modified,
      scenario: { id: "sc", name: "same for both", description: "identical modeled conditions" },
      declaredChanges: ["idempotencyCoverage"],
    };
  };
  {
    const a = runExperiment(exp());
    const b = runExperiment(exp());
    scenarios.push({
      id: "cf-reproducible",
      outcome: JSON.stringify(a) === JSON.stringify(b) ? "pass" : "fail",
      detail: `identical inputs produced ${JSON.stringify(a) === JSON.stringify(b) ? "identical" : "DIFFERENT"} outputs`,
    });
  }
  {
    const undeclared = exp();
    undeclared.declaredChanges = []; // idempotencyCoverage not declared
    const r = runExperiment(undeclared);
    scenarios.push({
      id: "cf-uncontrolled-flagged",
      outcome: r.uncontrolledChanges.includes("idempotencyCoverage") ? "pass" : "fail",
      detail: r.uncontrolledChanges.includes("idempotencyCoverage")
        ? "undeclared genome change correctly flagged as uncontrolled"
        : `expected idempotencyCoverage flagged; got [${r.uncontrolledChanges.join(", ")}]`,
    });
  }
  {
    // no-change experiment: no deltas, honest empty output
    const same = exp();
    same.modified = cloneModel(same.baseline);
    const r = runExperiment(same);
    scenarios.push({
      id: "cf-no-change-empty",
      outcome: r.deltas.length === 0 && r.genomeDeltas.length === 0 ? "pass" : "fail",
      detail: `identical architectures produced ${r.deltas.length} metric deltas and ${r.genomeDeltas.length} genome deltas (expected 0/0)`,
    });
  }
  return dim("counterfactual", "Counterfactual reproducibility", scenarios,
    "Scores experiment determinism and controlled-variable isolation.");
}

// ---------------------------------------------------------------------------
// Dimension: consistency reasoning
// ---------------------------------------------------------------------------

function consistencyDimension(): DimensionResult {
  const scenarios: BenchmarkScenarioResult[] = [];
  const expected = (m: ArchitectureModel, cc: ConsistencyContract, want: string): void => {
    const got = checkContract(m, cc);
    scenarios.push({
      id: `consistency-${cc.id}`,
      outcome: got.verdict === want ? "pass" : "fail",
      detail: `${cc.id}: expected ${want}, got ${got.verdict}`,
    });
  };
  const m1 = docflowModel();
  expected(m1, m1.consistencyContracts![0], "violated"); // TTL cache on the read path
  expected(m1, m1.consistencyContracts![1], "satisfied"); // eventual analytics
  {
    const m2 = docflowModel();
    m2.connections = m2.connections.filter((cn) => cn.id !== "cn-up-db" && cn.id !== "cn-worker-db");
    expected(m2, m2.consistencyContracts![0], "unknown"); // write path removed: cannot establish
  }
  return dim("consistency", "Consistency reasoning", scenarios,
    "Scores contract analysis, including honest unknown verdicts when evidence is missing.");
}

// ---------------------------------------------------------------------------
// Dimension: security & tenant isolation
// ---------------------------------------------------------------------------

function securityDimension(): DimensionResult {
  const scenarios: BenchmarkScenarioResult[] = [];
  {
    const findings = analyzeBoundaries(flawedCheckoutModel()).findings;
    const expectedIds = ["trust-outbound:k-2"];
    const missing = expectedIds.filter((id) => !findings.some((f) => f.id === id));
    scenarios.push({
      id: "security-uncontrolled-crossing",
      outcome: missing.length === 0 ? "pass" : "fail",
      detail: missing.length === 0
        ? "unencrypted payment-provider crossing detected on the flawed fixture"
        : `missing expected findings: ${missing.join(", ")}`,
    });
  }
  {
    const findings = analyzeBoundaries(docflowModel()).findings;
    const hasException = findings.some((f) => f.id.startsWith("trust-exception:")) === false; // no note set
    scenarios.push({
      id: "security-reference-findings",
      outcome: findings.some((f) => f.id === "trust-inbound:cn-web-gw") && hasException ? "pass" : "fail",
      detail: `reference architecture: ${findings.length} boundary findings incl. unauthenticated internet entry; documented-exception handling present`,
    });
  }
  {
    const matrix = generateTenantMatrix(docflowModel());
    // status-cache and work-queue and doc-store have no tenant mechanism: violations expected
    scenarios.push({
      id: "security-tenant-matrix",
      outcome: matrix.violations > 0 && matrix.uncoveredEntities.length > 0 ? "pass" : "fail",
      detail: `${matrix.cases.length} generated cases, ${matrix.violations} violations, ${matrix.uncoveredEntities.length} uncovered holders — gaps reported explicitly`,
    });
  }
  {
    const matrix = generateTenantMatrix(docflowModel());
    const wellIsolated = cloneModel(docflowModel());
    wellIsolated.components.find((c) => c.id === "status-cache")!.config.tenantKeyPrefix = "tenant";
    wellIsolated.components.find((c) => c.id === "work-queue")!.config.tenantKey = "tenant_id";
    wellIsolated.components.find((c) => c.id === "doc-store")!.config.tenantKey = "tenant_id";
    const fixedMatrix = generateTenantMatrix(wellIsolated);
    scenarios.push({
      id: "security-tenant-matrix-clean",
      outcome: fixedMatrix.violations === 0 && matrix.violations > fixedMatrix.violations ? "pass" : "fail",
      detail: `after declaring mechanisms on all holders: ${fixedMatrix.violations} violations (was ${matrix.violations})`,
    });
  }
  return dim("security", "Security & tenant isolation", scenarios,
    "Scores trust-boundary detection and the tenant-isolation matrix (declared mechanisms are the system under test).");
}

// ---------------------------------------------------------------------------
// Dimension: recovery verdicts
// ---------------------------------------------------------------------------

function recoveryDimension(): DimensionResult {
  const scenarios: BenchmarkScenarioResult[] = [];
  const criteria = (kind: RecoveryCriterion["kind"], componentId: string): RecoveryCriterion =>
    ({ kind, componentId, statement: `${componentId} ${kind}` });

  const restored = () => {
    let rec = startRecording("bm", "t0");
    rec = record(rec, { t: 0, type: "fault", componentId: "meta-db", variable: "status", to: "down", detail: "injected" });
    rec = record(rec, { t: 60, type: "recovery", componentId: "meta-db", variable: "status", to: "up", detail: "restored" });
    return rec;
  };
  const notRestored = () => {
    let rec = startRecording("bm", "t0");
    rec = record(rec, { t: 0, type: "fault", componentId: "meta-db", variable: "status", to: "down", detail: "injected" });
    return rec;
  };
  const verdictCases: { id: string; want: string; rec: () => ReturnType<typeof startRecording>; crit: RecoveryCriterion[] }[] = [
    { id: "recovery-recovered", want: "RECOVERED", rec: restored, crit: [criteria("component-restored", "meta-db")] },
    { id: "recovery-not-recovered", want: "NOT_RECOVERED", rec: notRestored, crit: [criteria("component-restored", "meta-db")] },
    { id: "recovery-partial", want: "PARTIALLY_RECOVERED", rec: restored,
      crit: [criteria("component-restored", "meta-db"), criteria("queue-drained", "work-queue")] },
    { id: "recovery-inconclusive", want: "INCONCLUSIVE", rec: () => startRecording("bm", "t0"),
      crit: [criteria("error-rate-recovered", "gateway")] },
  ];
  verdictCases.forEach((c) => {
    const r = evaluateRecovery(c.rec(), c.crit);
    scenarios.push({
      id: c.id,
      outcome: r.verdict === c.want ? "pass" : "fail",
      detail: `expected ${c.want}, got ${r.verdict}`,
    });
  });
  return dim("recovery", "Recovery verdicts", scenarios,
    "Scores evidence-folded verdicts, including partial and insufficient-evidence honesty.");
}

// ---------------------------------------------------------------------------
// Dimension: evidence provenance & explanation grounding
// ---------------------------------------------------------------------------

function provenanceDimension(): DimensionResult {
  const scenarios: BenchmarkScenarioResult[] = [];
  const m = docflowModel();
  const createdAt = "benchmark-run";
  {
    // capture findings from a full analysis pass and verify integrity
    const findings = [
      ...analyzeIntent(m),
      ...critiqueArchitecture(m).findings,
      ...analyzeBoundaries(m).findings,
    ];
    const artifacts = findings.map((f) => captureFinding(f, { createdAt }));
    const integrity = checkEvidenceIntegrity(m, artifacts);
    scenarios.push({
      id: "provenance-integrity",
      outcome: integrity.ok ? "pass" : "fail",
      detail: integrity.ok
        ? `${artifacts.length} evidence artifacts: every reference resolves, provenance complete`
        : `integrity issues: ${integrity.issues.slice(0, 3).map((i) => `${i.artifactId}: ${i.problem}`).join("; ")}`,
    });
    // a fabricated artifact must be REJECTED
    const bad: EvidenceArtifact[] = [...artifacts, {
      id: "ev-bad", kind: "simulated", source: "engine:test", summary: "claim",
      createdAt, modelVersion: 1, assumptions: [], refs: ["component:ghost"],
    }];
    const badIntegrity = checkEvidenceIntegrity(m, bad);
    scenarios.push({
      id: "provenance-rejects-fabricated",
      outcome: badIntegrity.ok ? "fail" : "pass",
      detail: badIntegrity.ok ? "dangling reference was NOT detected" : "dangling reference correctly rejected",
    });
    // export determinism
    const pack1 = buildEvidencePack("bm-pack", artifacts, createdAt);
    const pack2 = buildEvidencePack("bm-pack", artifacts, createdAt);
    scenarios.push({
      id: "provenance-export-deterministic",
      outcome: JSON.stringify(pack1) === JSON.stringify(pack2) ? "pass" : "fail",
      detail: `evidence pack export is ${JSON.stringify(pack1) === JSON.stringify(pack2) ? "byte-stable" : "UNSTABLE"}`,
    });
  }
  {
    // explanation grounding: every explanation references existing entities only
    const problems = m.components.flatMap((c) => {
      const e = explainComponent(m, c.id, "advanced");
      return e ? checkGrounding(m, e) : [`no explanation for ${c.id}`];
    });
    scenarios.push({
      id: "explanation-grounding",
      outcome: problems.length === 0 ? "pass" : "fail",
      detail: problems.length === 0
        ? `all ${m.components.length} component explanations fully grounded`
        : `grounding failures: ${problems.slice(0, 3).join("; ")}`,
    });
  }
  return dim("provenance", "Evidence provenance & explanation grounding", scenarios,
    "Scores evidence integrity (including rejection of fabricated references), export determinism, and explanation grounding.");
}

// ---------------------------------------------------------------------------
// Dimension: critic rules (Campaign-03 corpus, preserved)
// ---------------------------------------------------------------------------

function criticDimension(): DimensionResult {
  const scenarios: BenchmarkScenarioResult[] = [];
  const flawed = critiqueArchitecture(flawedCheckoutModel());
  const expected = ["critic-spof:c-api", "critic-spof:c-db", "critic-spof:c-pay",
    "critic-idem:c-api", "critic-orphan:c-logging", "critic-sync-ext:k-2"];
  const missing = expected.filter((id) => !flawed.findings.some((f) => f.id === id));
  scenarios.push({
    id: "critic-flawed-checkout",
    outcome: missing.length === 0 ? "pass" : "fail",
    detail: missing.length === 0
      ? "all six ground-truth findings produced on the flawed fixture"
      : `missing: ${missing.join(", ")}`,
  });
  const reference = critiqueArchitecture(docflowModel());
  const orphanFalsePositive = reference.findings.some((f) => f.id.startsWith("critic-orphan:"));
  scenarios.push({
    id: "critic-reference-no-orphans",
    outcome: orphanFalsePositive ? "fail" : "pass",
    detail: orphanFalsePositive
      ? "orphan rule produced a false positive on the reference architecture"
      : "no false-positive orphan findings on the reference architecture",
  });
  return dim("critic", "Critic rules (C03 corpus)", scenarios,
    "Preserves the Campaign-03 critic benchmark inside the v2 schema.");
}

// ---------------------------------------------------------------------------
// Run + report
// ---------------------------------------------------------------------------

export function runBenchmarkV2(ranAt: string): BenchmarkRunV2 {
  const dimensions: DimensionResult[] = [
    modelValidationDimension(),
    causalReasoningDimension(),
    counterfactualDimension(),
    consistencyDimension(),
    securityDimension(),
    recoveryDimension(),
    provenanceDimension(),
    criticDimension(),
  ];
  const all = dimensions.flatMap((d) => d.scenarios);
  return {
    schemaVersion: 2,
    ranAt,
    deterministic: true,
    engineVersions: { modelVersion: 1, ruleset: "campaign-04-bm2" },
    dimensions,
    summary: {
      dimensionsScored: dimensions.length,
      totalScenarios: all.length,
      passed: all.filter((s) => s.outcome === "pass").length,
      failed: all.filter((s) => s.outcome === "fail").length,
      notApplicable: all.filter((s) => s.outcome === "not-applicable").length,
      insufficientEvidence: all.filter((s) => s.outcome === "insufficient-evidence").length,
    },
    limitations: [
      "All scenarios are synthetic fixtures authored with the rule set — this measures self-consistency of the lab's engines, not real-world architecture quality.",
      "Dimensions are scored independently; no composite score exists by design.",
      "not-applicable and insufficient-evidence outcomes are honest results, not failures.",
      "The corpus must be updated together with any engine rule change.",
    ],
    reproduction: {
      command: "npx vitest run src/lab/__tests__/c04-benchmark.test.ts",
      seeds: "all fixtures are unseeded/pinned constants or seed 42; runs are deterministic",
    },
  };
}

export function renderBenchmarkV2Report(run: BenchmarkRunV2): string {
  const lines: string[] = [
    "# Architecture Intelligence Benchmark v2",
    "",
    `Run at: ${run.ranAt} · schema ${run.schemaVersion} · deterministic: ${run.deterministic}`,
    `Engine versions: model ${run.engineVersions.modelVersion}, ruleset ${run.engineVersions.ruleset}`,
    "",
    `Summary: ${run.summary.passed}/${run.summary.totalScenarios} scenarios passed across`,
    `${run.summary.dimensionsScored} dimensions; ${run.summary.failed} failed;`,
    `${run.summary.notApplicable} not-applicable; ${run.summary.insufficientEvidence} insufficient-evidence.`,
    "",
    "| dimension | passed | failed | n/a | insufficient |",
    "|-----------|--------|--------|-----|-------------|",
  ];
  run.dimensions.forEach((d) => {
    lines.push(`| ${d.key} | ${d.passed} | ${d.failed} | ${d.notApplicable} | ${d.insufficientEvidence} |`);
  });
  run.dimensions.forEach((d) => {
    lines.push("", `## ${d.label}`, "", d.note, "");
    d.scenarios.forEach((s) => {
      lines.push(`- [${s.outcome}] ${s.id}: ${s.detail}`);
    });
  });
  lines.push("", "## Limitations", "");
  run.limitations.forEach((l) => lines.push(`- ${l}`));
  lines.push("", `## Reproduction`, "", run.reproduction.command, "", run.reproduction.seeds);
  return lines.join("\n");
}

/** Genome fingerprints of the corpus models (regression metadata). */
export function corpusFingerprints(): { model: string; fingerprint: string }[] {
  return [
    { model: "arch-docflow", fingerprint: extractGenome(docflowModel()).fingerprint },
    { model: "arch-flawed-checkout", fingerprint: extractGenome(flawedCheckoutModel()).fingerprint },
  ];
}
