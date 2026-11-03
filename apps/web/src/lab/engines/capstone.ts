/**
 * Task 45 — Architecture Intelligence Capstone: the System Design Flight Lab.
 *
 * Combines every engine into one coherent lifecycle on a single architecture
 * version: intent + causal + blast radius + consistency + security + capacity
 * + critique (intelligence), then controlled failures + flight recorder +
 * alternatives + counterfactuals (experimentation), and finally an
 * evidence-backed report with limitations and open questions.
 */

import {
  type ArchitectureModel, type Finding, cloneModel, validateModel,
} from "../model";
import { docflowModel } from "../samples";
import { analyzeIntent, coverageMap, isCovered } from "./intent";
import { causalFindings, propagate } from "./causal";
import { blastRadiusFindings } from "./blastradius";
import { analyzeConsistency } from "./consistency";
import { analyzeBoundaries } from "./trust";
import { analyzeLineage } from "./lineage";
import { enforcementGaps } from "./authz";
import { injectTenantFailures } from "./tenant";
import { reviewAdversarially } from "./adversarial";
import { saturate } from "./resource";
import { analyzeLatency } from "./latency";
import { critiqueArchitecture } from "./critic";
import { buildScorecard } from "./scorecard";
import { addIdempotency } from "./mutations";
import { runExperiment, type CounterfactualExperiment } from "./counterfactual";
import { startRecording, recordFromPropagation } from "./flightrecorder";
import { docflowMission, evaluateMission, type RevisionRecord } from "./mission";

export interface IntelligenceWorkflowResult {
  archId: string;
  intentFindings: Finding[];
  causalFindings: Finding[];
  blastRadiusFindings: Finding[];
  consistencyChecks: ReturnType<typeof analyzeConsistency>["checks"];
  securityFindings: Finding[];
  capacity: ReturnType<typeof saturate>;
  latency: ReturnType<typeof analyzeLatency>;
  criticFindings: Finding[];
  scorecard: ReturnType<typeof buildScorecard>["scorecard"];
  totalFindings: number;
}

/** Task 45.3 — run the intelligence layer against ONE architecture version. */
export function runIntelligenceWorkflow(m: ArchitectureModel, options: { operationId: string; rps: number }): IntelligenceWorkflowResult {
  const intentFindings = analyzeIntent(m);
  const causal = causalFindings(m, { componentId: "meta-db", fault: "down" });
  const blast = blastRadiusFindings(m, "meta-db", "down");
  const consistency = analyzeConsistency(m);
  const securityFindings = [
    ...analyzeBoundaries(m).findings,
    ...analyzeLineage(m).findings,
    ...enforcementGaps(m).findings,
    ...injectTenantFailures(m).findings,
    ...reviewAdversarially(m).findings,
  ];
  const capacity = saturate(m, options.rps);
  const latency = analyzeLatency(m, options.operationId);
  const critic = critiqueArchitecture(m);
  const { scorecard } = buildScorecard(m);
  return {
    archId: m.id,
    intentFindings,
    causalFindings: causal,
    blastRadiusFindings: blast,
    consistencyChecks: consistency.checks,
    securityFindings,
    capacity,
    latency,
    criticFindings: critic.findings,
    scorecard,
    totalFindings:
      intentFindings.length + causal.length + blast.length + consistency.findings.length +
      securityFindings.length + critic.findings.length,
  };
}

// ---------------------------------------------------------------------------
// Task 45.4 — experiment and improvement workflow
// ---------------------------------------------------------------------------

export interface ImprovementStep {
  description: string;
  rationale: string;
}

export interface ImprovementWorkflowResult {
  baselineFingerprint: string;
  revisedModel: ArchitectureModel;
  improvements: ImprovementStep[];
  counterfactual: ReturnType<typeof runExperiment>;
  recordingEvents: number;
  counterfactualIsReproducible: boolean;
}

export function runImprovementWorkflow(
  baseline: ArchitectureModel, options: { operationId: string; rps: number; declaredChanges: string[] },
): ImprovementWorkflowResult {
  // 1) controlled failure on the metadata store, recorded
  const prop = propagate(baseline, { componentId: "meta-db", fault: "down" });
  let recording = recordFromPropagation(startRecording("capstone-improve", "t0"), prop, "capstone-improve");

  // 2) an evidence-driven improvement: the critic flags upload-svc idempotency
  const improvements: ImprovementStep[] = [];
  let revised = cloneModel(baseline);
  const idemGap = baseline.components.find((c) =>
    c.kind === "service" && c.config.idempotent !== true &&
    baseline.connections.some((cn) => cn.from === c.id && (cn.access === "write" || cn.access === "readwrite")));
  if (idemGap) {
    const mutation = addIdempotency(revised, idemGap.id);
    revised = mutation.model;
    improvements.push({
      description: `Made ${idemGap.name} idempotent`,
      rationale: `Critic finding critic-idem:${idemGap.id}: retries can duplicate side effects. Trade-offs accepted: ${mutation.explanation.tradeoffs[0]}`,
    });
  }

  // 3) counterfactual: baseline vs revised under the same scenario
  const experiment: CounterfactualExperiment = {
    id: "capstone-cf",
    label: "idempotency improvement",
    baseline,
    modified: revised,
    scenario: { id: "sc", name: "peak load with retries", description: "callers retry failures at peak" },
    declaredChanges: options.declaredChanges,
  };
  const counterfactual = runExperiment(experiment);
  const counterfactual2 = runExperiment(experiment);

  recording = recordFromPropagation(recording, propagate(revised, { componentId: "meta-db", fault: "down" }), "capstone-improve");

  return {
    baselineFingerprint: "",
    revisedModel: revised,
    improvements,
    counterfactual,
    recordingEvents: recording.events.length,
    counterfactualIsReproducible: JSON.stringify(counterfactual) === JSON.stringify(counterfactual2),
  };
}

// ---------------------------------------------------------------------------
// Task 45.5 — final evidence package
// ---------------------------------------------------------------------------

export interface FinalEvidencePackage {
  archId: string;
  title: string;
  generatedAt: string;
  architectureSummary: {
    name: string;
    components: number;
    connections: number;
    operations: string[];
    validationErrors: string[];
  };
  requirementCoverage: { covered: string[]; uncovered: string[] };
  adrs: { id: string; title: string; decision: string }[];
  assumptions: { id: string; statement: string; status: string }[];
  risks: Finding[];
  experimentResults: {
    intelligenceFindings: number;
    counterfactualExplanation: string[];
    recordedEvents: number;
    reproducible: boolean;
  };
  recoveryEvidence: { dimension: string; score: number; uncertainty: string }[];
  benchmarkLimitations: string[];
  openQuestions: string[];
}

export function buildFinalEvidencePackage(
  m: ArchitectureModel,
  intelligence: IntelligenceWorkflowResult,
  improvement: ImprovementWorkflowResult,
  options: { generatedAt: string; benchmarkLimitations: string[] },
): FinalEvidencePackage {
  const cov = coverageMap(m);
  const covered: string[] = [];
  const uncovered: string[] = [];
  m.requirements.forEach((r) => {
    const c = cov[r.id];
    if (c && isCovered(c)) covered.push(r.id); else uncovered.push(r.id);
  });
  return {
    archId: m.id,
    title: `Evidence package: ${m.name}`,
    generatedAt: options.generatedAt,
    architectureSummary: {
      name: m.name,
      components: m.components.length,
      connections: m.connections.length,
      operations: m.operations.map((o) => o.name),
      validationErrors: validateModel(m).map((e) => `${e.path}: ${e.message}`),
    },
    requirementCoverage: { covered, uncovered },
    adrs: m.adrs.map((a) => ({ id: a.id, title: a.title, decision: a.decision })),
    assumptions: m.assumptions.map((a) => ({ id: a.id, statement: a.statement, status: a.status })),
    risks: [...intelligence.criticFindings, ...intelligence.securityFindings].slice(0, 10),
    experimentResults: {
      intelligenceFindings: intelligence.totalFindings,
      counterfactualExplanation: improvement.counterfactual.explanation,
      recordedEvents: improvement.recordingEvents,
      reproducible: improvement.counterfactualIsReproducible,
    },
    recoveryEvidence: intelligence.scorecard.dimensions.map((d) => ({
      dimension: d.label, score: d.score, uncertainty: d.uncertainty,
    })),
    benchmarkLimitations: options.benchmarkLimitations,
    openQuestions: [
      ...m.assumptions.filter((a) => a.status === "unverified").map((a) => `Assumption ${a.id} is unverified: "${a.statement}"`),
      ...uncovered.map((r) => `Requirement ${r} has no architecture support yet`),
      "Capacity numbers are Little's-law models at the declared peak, not load-test results.",
    ],
  };
}

/** The complete capstone run over the DocFlow scenario. */
export function runCapstone(options: { generatedAt: string; benchmarkLimitations: string[]; rps?: number; revisions?: RevisionRecord[] }) {
  const model = docflowModel();
  const intelligence = runIntelligenceWorkflow(model, { operationId: "op-upload", rps: options.rps ?? 50 });
  const improvement = runImprovementWorkflow(model, {
    operationId: "op-upload", rps: options.rps ?? 50,
    declaredChanges: ["idempotencyCoverage"],
  });
  const evidence = buildFinalEvidencePackage(improvement.revisedModel, intelligence, improvement, {
    generatedAt: options.generatedAt,
    benchmarkLimitations: options.benchmarkLimitations,
  });
  const missionEvaluation = evaluateMission(docflowMission(), improvement.revisedModel, options.revisions ?? []);
  return { model, intelligence, improvement, evidence, missionEvaluation };
}
