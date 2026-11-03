/**
 * Task 08 — Counterfactual Architecture Experiment Engine.
 *
 * "What would have happened if we had made a different design decision?"
 * An experiment compares a baseline and a modified architecture under the SAME
 * scenario, isolates which architectural properties changed, flags undeclared
 * (uncontrolled) changes, and explains which changed property caused each
 * modeled difference. Pure function: identical inputs always produce
 * identical outputs (reproducible by construction).
 */

import type { ArchitectureModel } from "../model";
import { compareGenomes, extractGenome, type Genome, type TraitDelta } from "./genome";
import { blastRadius } from "./blastradius";

export interface Scenario {
  id: string;
  name: string;
  description: string;
  /** optional injected fault applied to BOTH architectures */
  fault?: { componentId: string; fault: "down" | "slow" };
}

export interface CounterfactualExperiment {
  id: string;
  label: string;
  baseline: ArchitectureModel;
  modified: ArchitectureModel;
  scenario: Scenario;
  /** genome trait keys the experimenter declares as the controlled change */
  declaredChanges: string[];
}

export interface ModeledMetrics {
  syncDepth: number;
  criticalPathLatencyMs: number;
  idempotencyGaps: number;
  maxImpactedOpsOnStatefulFailure: number;
  queueCount: number;
}

export interface MetricDelta {
  key: keyof ModeledMetrics;
  label: string;
  baseline: number;
  modified: number;
  /** positive = modified is higher */
  delta: number;
  betterWhenLower: boolean;
  /** modeled improvement given the metric's polarity */
  improved: boolean;
}

export interface ExperimentOutcome {
  experimentId: string;
  metricsBaseline: ModeledMetrics;
  metricsModified: ModeledMetrics;
  deltas: MetricDelta[];
  genomeDeltas: TraitDelta[];
  /** changed traits the experiment did not declare (uncontrolled variables) */
  uncontrolledChanges: string[];
  explanation: string[];
  uncertainties: string[];
  reproducible: true;
}

/** Longest synchronous-chain latency starting at a client component (modeled from connection.latencyMs assumptions). */
function criticalPathLatency(m: ArchitectureModel): number {
  let best = 0;
  const visit = (node: string, acc: number, seen: Set<string>): void => {
    best = Math.max(best, acc);
    if (seen.has(node)) return; // cycle guard
    m.connections
      .filter((cn) => cn.from === node && cn.kind === "sync")
      .forEach((cn) => visit(cn.to, acc + (cn.latencyMs ?? 0), new Set([...seen, node])));
  };
  m.components.filter((c) => c.kind === "client" || c.kind === "gateway").forEach((c) => visit(c.id, 0, new Set()));
  return best;
}

export function modeledMetrics(m: ArchitectureModel): ModeledMetrics {
  const genome: Genome = extractGenome(m);
  const syncDepth = Number(genome.traits.find((t) => t.key === "syncDepth")?.value ?? 0);
  const idempotencyGaps = m.components
    .filter((c) => c.kind === "service" && c.config.idempotent !== true).length;
  const maxImpacted = Math.max(0, ...m.components
    .filter((c) => ["database", "objectstore"].includes(c.kind))
    .map((db) => blastRadius(m, db.id, "down").impactedOperations.length));
  const queueCount = Number(genome.traits.find((t) => t.key === "queues")?.value ?? 0);
  return { syncDepth, criticalPathLatencyMs: criticalPathLatency(m), idempotencyGaps, maxImpactedOpsOnStatefulFailure: maxImpacted, queueCount };
}

const METRIC_LABELS: Record<keyof ModeledMetrics, { label: string; betterWhenLower: boolean }> = {
  syncDepth: { label: "Synchronous dependency depth", betterWhenLower: true },
  criticalPathLatencyMs: { label: "Modeled critical-path latency (ms)", betterWhenLower: true },
  idempotencyGaps: { label: "Services without idempotency", betterWhenLower: true },
  maxImpactedOpsOnStatefulFailure: { label: "Operations impacted by worst stateful failure", betterWhenLower: true },
  queueCount: { label: "Queues (decoupling components)", betterWhenLower: false },
};

export function runExperiment(exp: CounterfactualExperiment): ExperimentOutcome {
  const metricsBaseline = modeledMetrics(exp.baseline);
  const metricsModified = modeledMetrics(exp.modified);
  const keys = Object.keys(metricsBaseline) as (keyof ModeledMetrics)[];
  const deltas: MetricDelta[] = keys
    .filter((k) => metricsBaseline[k] !== metricsModified[k])
    .map((k) => {
      const meta = METRIC_LABELS[k];
      const delta = metricsModified[k] - metricsBaseline[k];
      return {
        key: k, label: meta.label,
        baseline: metricsBaseline[k], modified: metricsModified[k], delta,
        betterWhenLower: meta.betterWhenLower,
        improved: meta.betterWhenLower ? delta < 0 : delta > 0,
      };
    });

  const genomeDeltas = compareGenomes(extractGenome(exp.baseline), extractGenome(exp.modified));
  const uncontrolledChanges = genomeDeltas
    .filter((d) => !exp.declaredChanges.includes(d.key))
    .map((d) => d.key);

  const explanation: string[] = [];
  deltas.forEach((d) => {
    const related = genomeDeltas.find((g) =>
      (d.key === "syncDepth" && g.key === "syncDepth") ||
      (d.key === "queueCount" && g.key === "queues") ||
      (d.key === "idempotencyGaps" && g.key === "idempotencyCoverage") ||
      (d.key === "criticalPathLatencyMs" && (g.key === "caches" || g.key === "queues" || g.key === "syncDepth")));
    explanation.push(
      `${d.label}: ${d.baseline} -> ${d.modified} (${d.improved ? "improvement" : "regression"} in the model)` +
      (related ? `, attributed to changed trait "${related.key}" (${related.before} -> ${related.after})` : ", attribution uncertain — no single genome trait explains it"),
    );
  });
  if (uncontrolledChanges.length > 0) {
    explanation.push(
      `UNCONTROLLED: the modified architecture also changed ${uncontrolledChanges.join(", ")}, which was not declared as part of this experiment — conclusions about the declared change alone are not supported.`,
    );
  }
  if (exp.scenario.fault) {
    explanation.push(
      `Under scenario "${exp.scenario.name}" with injected ${exp.scenario.fault.fault} fault on ${exp.scenario.fault.componentId}, both architectures were evaluated with the same modeled failure.`,
    );
  }

  return {
    experimentId: exp.id,
    metricsBaseline,
    metricsModified,
    deltas,
    genomeDeltas,
    uncontrolledChanges,
    explanation,
    uncertainties: [
      "All metrics are MODELED values derived from the canonical model's declared assumptions (e.g. connection latencyMs), not production measurements.",
      "Critical-path latency ignores queuing delay, network jitter, and warmup effects by design.",
      "Impact counts treat any degraded component on an operation's path as 'impacted' (conservative).",
    ],
    reproducible: true,
  };
}
