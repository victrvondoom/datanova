/**
 * Task 35 — Transparent Resilience Scorecard.
 *
 * Multi-dimensional, evidence-linked, uncertainty-aware. Every dimension
 * score names the findings it derives from and is labeled measured / modeled /
 * inferred / unknown. There is deliberately NO aggregate score (rule 9):
 * the scorecard shows strengths, weaknesses, and uncertainty per dimension.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";
import { analyzeBoundaries } from "./trust";
import { analyzeConsistency } from "./consistency";
import { observabilityGaps } from "./observability";
import { injectTenantFailures } from "./tenant";
import { monthlyCost, complexity, DEFAULT_COST_ASSUMPTIONS } from "./tradeoff";
import { extractGenome } from "./genome";

export type Uncertainty = "measured" | "modeled" | "inferred" | "unknown";

export interface DimensionScore {
  key: string;
  label: string;
  /** 0..100 — higher is better; derived transparently below */
  score: number;
  uncertainty: Uncertainty;
  rationale: string;
  evidence: string[];
  /** findings feeding this score (ids), so any score can be inspected */
  basedOnFindings: string[];
}

export interface Scorecard {
  archId: string;
  dimensions: DimensionScore[];
  notes: string[];
}

export function buildScorecard(m: ArchitectureModel): { scorecard: Scorecard; allFindings: Finding[] } {
  const allFindings: Finding[] = [];
  const dims: DimensionScore[] = [];
  const trait = (k: string): number => Number(extractGenome(m).traits.find((t) => t.key === k)?.value ?? 0);

  // --- reliability (modeled from genome traits) ---
  const isolation = trait("isolationScore");
  const redundancy = m.components.length === 0 ? 0 : m.components.filter((c) => Number(c.config.replicas ?? 1) >= 2).length / m.components.length;
  const reliability = Math.round(100 * (0.5 * Math.min(1, isolation * 3) + 0.3 * Math.min(1, redundancy * 5) + 0.2 * Math.min(1, trait("retryCoverage"))));
  dims.push({
    key: "reliability", label: "Reliability (modeled)",
    score: reliability, uncertainty: "modeled",
    rationale: `isolation ${Math.round(isolation * 100)}% of edges, redundancy ${Math.round(redundancy * 100)}% of components, retry coverage ${Math.round(trait("retryCoverage") * 100)}% — all derived from the canonical model, none measured.`,
    evidence: ["genome:isolationScore", "genome:retryCoverage", "config.replicas"],
    basedOnFindings: [],
  });

  // --- security (from trust + tenant findings) ---
  const trust = analyzeBoundaries(m);
  const tenant = injectTenantFailures(m);
  const securityFindings = [...trust.findings.filter((f) => f.severity !== "info"), ...tenant.findings];
  allFindings.push(...securityFindings);
  const criticalSecurity = securityFindings.filter((f) => f.severity === "critical").length;
  dims.push({
    key: "security", label: "Security & tenant isolation",
    score: Math.max(0, 100 - criticalSecurity * 20),
    uncertainty: "inferred",
    rationale: `${criticalSecurity} critical trust/tenant findings. Score = 100 - 20 per critical finding; this is an explicit heuristic, not a measurement.`,
    evidence: securityFindings.map((f) => f.id),
    basedOnFindings: securityFindings.map((f) => f.id),
  });

  // --- consistency (from contract checks) ---
  const consistency = analyzeConsistency(m);
  allFindings.push(...consistency.findings);
  const violated = consistency.checks.filter((c) => c.verdict === "violated").length;
  const unknown = consistency.checks.filter((c) => c.verdict === "unknown").length;
  const total = Math.max(1, consistency.checks.length);
  dims.push({
    key: "consistency", label: "Consistency contracts",
    score: Math.round(100 * (1 - (violated + 0.5 * unknown) / total)),
    uncertainty: unknown > 0 ? "unknown" : "modeled",
    rationale: `${violated} violated and ${unknown} unknown of ${total} declared contracts (unknown counts half).`,
    evidence: consistency.checks.map((c) => `consistencyContract:${c.contractId}`),
    basedOnFindings: consistency.findings.map((f) => f.id),
  });

  // --- observability (from gap count) ---
  const obs = observabilityGaps(m);
  allFindings.push(...obs.findings);
  dims.push({
    key: "observability", label: "Observability coverage",
    score: Math.max(0, 100 - obs.gaps.length * 10),
    uncertainty: "modeled",
    rationale: `${obs.gaps.length} observability gaps (trace propagation, queue depth, retries, logging, operation tracing). Score = 100 - 10 per gap.`,
    evidence: obs.gaps.map((g) => `${g.kind}:${g.componentId ?? g.connectionId ?? g.operationId}`),
    basedOnFindings: obs.findings.map((f) => f.id),
  });

  // --- recovery readiness (can recovery even be verified?) ---
  const recoveryRelevant = m.components.filter((c) =>
    ["database", "objectstore", "queue"].includes(c.kind) ||
    m.operations.some((o) => o.criticality >= 4 && m.connections.some((cn) =>
      cn.operationIds.includes(o.id) && (cn.from === c.id || cn.to === c.id))));
  const observableForRecovery = recoveryRelevant.filter((c) =>
    (c.telemetry?.metrics ?? []).length > 0 || c.telemetry?.logs === true || c.telemetry?.traces === true);
  dims.push({
    key: "recovery", label: "Recovery readiness (verifiability)",
    score: recoveryRelevant.length === 0 ? 100 : Math.round(100 * observableForRecovery.length / recoveryRelevant.length),
    uncertainty: "modeled",
    rationale: `${observableForRecovery.length}/${recoveryRelevant.length} critical/stateful components declare telemetry that could verify a recovery; without telemetry, recovery claims cannot be checked.`,
    evidence: recoveryRelevant.map((c) => `component:${c.id}`),
    basedOnFindings: [],
  });

  // --- cost (modeled against declared assumptions) ---
  const cost = monthlyCost(m);
  dims.push({
    key: "cost", label: "Modeled monthly cost",
    score: cost.total, // cost is reported AS the modeled number, not inverted
    uncertainty: "modeled",
    rationale: `$${cost.total} modeled from declared assumptions (${Object.entries(DEFAULT_COST_ASSUMPTIONS).map(([k, v]) => `${k}=${v}`).join(", ")}). NOT cloud pricing.`,
    evidence: cost.breakdown.map((b) => `component:${b.componentId}=$${b.total}`),
    basedOnFindings: [],
  });

  // --- complexity (lower is better; reported raw) ---
  const cx = complexity(m);
  dims.push({
    key: "complexity", label: "Operational complexity (lower is better)",
    score: cx.score,
    uncertainty: "modeled",
    rationale: `${cx.deployables} deployables, ${cx.stateful} stateful, ${cx.integrationPoints} integration points, ${cx.externalDependencies} external dependencies. Score = deployables + 2*stateful + 0.1*edges + external.`,
    evidence: ["complexity:deployables", "complexity:stateful", "complexity:integrationPoints"],
    basedOnFindings: [],
  });

  const scorecard: Scorecard = {
    archId: m.id,
    dimensions: dims,
    notes: [
      "No aggregate score exists by design: a single number would hide exactly the trade-offs this scorecard exists to expose.",
      "Every dimension is derived from the canonical model + engine outputs; 'measured' would require production telemetry this educational product does not have.",
      "Cost and complexity are reported raw (not inverted) because lower/higher depends on constraints the model does not judge.",
    ],
  };
  return { scorecard, allFindings };
}

/** Convenience: findings view of a scorecard's weakest dimensions. */
export function scorecardFindings(sc: Scorecard): Finding[] {
  return sc.dimensions
    .filter((d) => d.uncertainty === "unknown" || (d.basedOnFindings.length > 0 && d.key !== "cost" && d.key !== "complexity" && d.score < 50))
    .map((d) => finding(
      "scorecard", `scorecard:${d.key}`, "warning",
      `Weak dimension: ${d.label}`,
      d.rationale,
      d.evidence.map((e) => ({ ref: e, detail: d.key })),
    ));
}
