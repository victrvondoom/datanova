/**
 * Campaign 04, Task 25 — Sensitivity and Uncertainty Analysis.
 *
 * Sweeps declared model assumptions through the supported estimators
 * (latency budget, resource saturation, counterfactual metrics) and reports
 * which conclusions are fragile: how much each parameter moves the outputs,
 * whether any conclusion FLIPS, and which assumptions deserve validation.
 * Pure and deterministic; every number is labeled as a modeled value.
 */

import {
  type ArchitectureModel, cloneModel,
} from "../model";
import { analyzeLatency } from "./latency";
import { saturate } from "./resource";
import { modeledMetrics } from "./counterfactual";

export type SensitivityParameter =
  | "peakRps"        // workload assumption (ASM-style)
  | "latencyHopMs"  // connection latency assumption
  | "processingMs"  // worker service time
  | "deadlineMs";   // budget target

export interface ParameterVariation {
  parameter: SensitivityParameter;
  /** multipliers applied to the declared value */
  multipliers: number[];
}

export const DEFAULT_VARIATION: ParameterVariation = {
  parameter: "peakRps",
  multipliers: [0.5, 1, 2],
};

export interface OutputSnapshot {
  criticalPathLatencyMs: number;
  bottleneck: string;
  bottleneckUtilization: number;
  idempotencyGaps: number;
}

export interface SensitivityResult {
  parameter: SensitivityParameter;
  declaredValue: number;
  runs: { multiplier: number; value: number; outputs: OutputSnapshot; missesDeadline: boolean | null }[];
  /** outputs that changed across the sweep */
  sensitiveOutputs: string[];
  /** conclusions that flip across the sweep (e.g. deadline status) */
  fragileConclusions: string[];
  note: string;
}

function snapshot(m: ArchitectureModel, operationId: string, rps: number, deadlineMs: number | null): {
  outputs: OutputSnapshot; missesDeadline: boolean | null;
} {
  const la = analyzeLatency(m, operationId);
  const sat = saturate(m, rps);
  const cf = modeledMetrics(m);
  const effectiveDeadline = deadlineMs ?? la.deadlineMs;
  return {
    outputs: {
      criticalPathLatencyMs: la.modeledMs,
      bottleneck: sat.bottleneck ? `${sat.bottleneck.componentId}.${sat.bottleneck.resource}` : "none",
      bottleneckUtilization: Math.round((sat.bottleneck?.utilization ?? 0) * 100),
      idempotencyGaps: cf.idempotencyGaps,
    },
    missesDeadline: effectiveDeadline === null ? null : la.modeledMs > effectiveDeadline,
  };
}

function applyParameter(m0: ArchitectureModel, p: SensitivityParameter, value: number): ArchitectureModel {
  const m = cloneModel(m0);
  if (p === "latencyHopMs") {
    m.connections = m.connections.map((cn) => ({ ...cn, latencyMs: Math.round((cn.latencyMs ?? 0) * value) }));
  } else if (p === "processingMs") {
    m.components = m.components.map((c) =>
      c.kind === "worker" ? { ...c, config: { ...c.config, processingMs: value } } : c);
  } else if (p === "deadlineMs") {
    m.latencyBudget = m.latencyBudget
      ? { ...m.latencyBudget, deadlineMs: Math.round(value) }
      : { deadlineMs: Math.round(value), allocations: {} };
  }
  return m;
}

export function declaredValue(m: ArchitectureModel, p: SensitivityParameter): number {
  switch (p) {
    case "peakRps":
      // the SLO-mapped expected volume per day, expressed as rps (modeled)
      return m.slos.length > 0
        ? Math.round((m.slos[0].expectedRequestsPerDay / 86_400) * 10) / 10
        : 50;
    case "latencyHopMs":
      return Math.round((m.connections.reduce((s, cn) => s + (cn.latencyMs ?? 0), 0) / Math.max(1, m.connections.length)) * 10) / 10;
    case "processingMs":
      return Number(m.components.find((c) => c.kind === "worker")?.config.processingMs ?? 4000);
    case "deadlineMs":
      return m.latencyBudget?.deadlineMs ?? 800;
  }
}

/**
 * Run a one-parameter sweep. For discrete knobs (deadline, processing) the
 * multipliers scale the declared value; for rps the sweep runs the resource
 * estimator directly at each rate.
 */
export function analyzeSensitivity(
  m: ArchitectureModel, operationId: string, variation: ParameterVariation,
): SensitivityResult {
  const base = declaredValue(m, variation.parameter);
  const runs = variation.multipliers
    .slice()
    .sort((a, b) => a - b)
    .map((multiplier) => {
      const value = Math.round(base * multiplier * 10) / 10;
      const rps = variation.parameter === "peakRps" ? value : declaredValue(m, "peakRps");
      const deadline = variation.parameter === "deadlineMs" ? value : null;
      // latency hops scale RELATIVE to the declared value; processing time and
      // deadline are set to the ABSOLUTE swept value
      const sweptModel = variation.parameter === "latencyHopMs"
        ? applyParameter(m, variation.parameter, multiplier)
        : variation.parameter === "processingMs"
          ? applyParameter(m, variation.parameter, value)
          : m;
      const { outputs, missesDeadline } = snapshot(sweptModel, operationId, rps, deadline);
      return { multiplier, value, outputs, missesDeadline };
    });

  const sensitiveOutputs: string[] = [];
  const outputKeys = ["criticalPathLatencyMs", "bottleneck", "bottleneckUtilization", "idempotencyGaps"] as const;
  outputKeys.forEach((k) => {
    const values = runs.map((r) => String(r.outputs[k]));
    if (new Set(values).size > 1) sensitiveOutputs.push(k);
  });

  const deadlineStates = runs.map((r) => r.missesDeadline);
  const fragileConclusions: string[] = [];
  if (deadlineStates.some((d) => d === null)) {
    fragileConclusions.push("no deadline is declared: deadline conclusions cannot be evaluated");
  } else if (new Set(deadlineStates).size > 1) {
    fragileConclusions.push(
      `the deadline verdict FLIPS across the sweep (${runs.map((r) => `${r.multiplier}x -> ${r.missesDeadline ? "miss" : "meet"}`).join(", ")}) — the latency assumption is decision-critical`,
    );
  }
  if (sensitiveOutputs.includes("bottleneck")) {
    fragileConclusions.push(
      `the bottleneck MOVES across the sweep (${runs.map((r) => `${r.multiplier}x -> ${r.outputs.bottleneck}`).join(", ")}) — capacity conclusions depend on this parameter`,
    );
  }

  return {
    parameter: variation.parameter,
    declaredValue: base,
    runs,
    sensitiveOutputs,
    fragileConclusions,
    note: `All outputs are modeled values derived from declared assumptions (parameter: ${variation.parameter}, declared ${base}). They are not measurements; validate the fragile conclusions before relying on them.`,
  };
}

/** Sweep the four supported parameters and rank which ones matter most. */
export function fullSensitivity(m: ArchitectureModel, operationId: string): {
  results: SensitivityResult[];
  mostInfluential: string[];
} {
  const variations: ParameterVariation[] = [
    { parameter: "peakRps", multipliers: [0.5, 1, 2] },
    { parameter: "latencyHopMs", multipliers: [0.5, 1, 2] },
    { parameter: "processingMs", multipliers: [0.5, 1, 2] },
    { parameter: "deadlineMs", multipliers: [0.5, 1, 2] },
  ];
  const results = variations.map((v) => analyzeSensitivity(m, operationId, v));
  const mostInfluential = [...results]
    .sort((a, b) => b.sensitiveOutputs.length - a.sensitiveOutputs.length)
    .map((r) => r.parameter);
  return { results, mostInfluential };
}
