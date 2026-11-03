/**
 * Task 31 — Chaos Experiment Designer.
 *
 * A chaos experiment needs a hypothesis, controlled conditions, measurable
 * observations, and a stop condition. Templates instantiate common
 * experiments; execution runs against the LOCAL MODEL only and records state
 * transitions in a flight-recorder recording; review classifies the outcome
 * as supported / contradicted / inconclusive / invalid.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";
import { propagate } from "./causal";
import { blastRadius } from "./blastradius";
import { startRecording, recordFromPropagation, record, type Recording } from "./flightrecorder";

export interface ChaosExperiment {
  id: string;
  template: string;
  hypothesis: string;
  targetComponentId: string;
  faultType: "down" | "slow";
  durationMin: number;
  /** operation ids the experimenter EXPECTS to be impacted */
  expectedImpactedOperations: string[];
  safeguards: string[];
  stopConditions: string[];
}

export const TEMPLATES: Record<string, {
  name: string;
  faultType: "down" | "slow";
  defaultDurationMin: number;
  expectedImpactHint: string;
  safeguards: string[];
  stopConditions: string[];
}> = {
  "latency-injection": {
    name: "Latency injection", faultType: "slow", defaultDurationMin: 10,
    expectedImpactHint: "upstream latency grows but no operation should fully fail (degradation, not outage)",
    safeguards: ["local model only — no real traffic is generated"],
    stopConditions: ["modeled error budget consumption exceeds the declared threshold"],
  },
  "component-failure": {
    name: "Component failure", faultType: "down", defaultDurationMin: 5,
    expectedImpactHint: "impacted operations are those reachable through blocking edges",
    safeguards: ["run against the modeled architecture", "duration is bounded by the experiment"],
    stopConditions: ["all critical operations modeled as down"],
  },
  "queue-slowdown": {
    name: "Queue slowdown", faultType: "slow", defaultDurationMin: 15,
    expectedImpactHint: "queue depth grows; upstream should stay responsive (isolated)",
    safeguards: ["local model only"],
    stopConditions: ["modeled queue depth exceeds capacity"],
  },
  "dependency-outage": {
    name: "Dependency outage", faultType: "down", defaultDurationMin: 10,
    expectedImpactHint: "direct callers block or degrade per failure behavior",
    safeguards: ["local model only"],
    stopConditions: ["propagation reaches components outside the experiment scope"],
  },
  "resource-saturation": {
    name: "Resource saturation", faultType: "slow", defaultDurationMin: 20,
    expectedImpactHint: "latency grows multiplicatively along the saturated resource's callers",
    safeguards: ["local model only"],
    stopConditions: ["modeled utilization exceeds 100% on the target"],
  },
};

/** Task 31.2 — instantiate a template for a target component. */
export function fromTemplate(
  id: string, template: string, targetComponentId: string,
  expectedImpactedOperations: string[],
): ChaosExperiment {
  const t = TEMPLATES[template];
  if (!t) throw new Error(`unknown template ${template}`);
  return {
    id, template,
    hypothesis: `Injecting ${t.faultType === "down" ? "a failure of" : "latency into"} ${targetComponentId} will impact: ${expectedImpactedOperations.join(", ") || "(none)"}. ${t.expectedImpactHint}.`,
    targetComponentId,
    faultType: t.faultType,
    durationMin: t.defaultDurationMin,
    expectedImpactedOperations,
    safeguards: t.safeguards,
    stopConditions: t.stopConditions,
  };
}

export interface ChaosOutcome {
  experiment: ChaosExperiment;
  recording: Recording;
  observedImpactedOperations: string[];
  observedAffectedComponents: string[];
  verdict: "supported" | "contradicted" | "inconclusive" | "invalid";
  reviewNotes: string[];
  findings: Finding[];
}

/** Task 31.4/31.5 — execute against the model and review the hypothesis. */
export function runChaos(m: ArchitectureModel, exp: ChaosExperiment): ChaosOutcome {
  const reviewNotes: string[] = [];
  if (!m.components.some((c) => c.id === exp.targetComponentId)) {
    return {
      experiment: exp,
      recording: startRecording(exp.id, "t0"),
      observedImpactedOperations: [],
      observedAffectedComponents: [],
      verdict: "invalid",
      reviewNotes: [`target component ${exp.targetComponentId} does not exist in the model`],
      findings: [finding("chaos", `chaos-invalid:${exp.id}`, "critical", "Invalid experiment",
        `Target ${exp.targetComponentId} does not exist; nothing was executed.`,
        [{ ref: `experiment:${exp.id}`, detail: "unknown target" }])],
    };
  }

  const prop = propagate(m, { componentId: exp.targetComponentId, fault: exp.faultType });
  let recording = recordFromPropagation(startRecording(exp.id, "t0"), prop, exp.id);
  const br = blastRadius(m, exp.targetComponentId, exp.faultType);
  const observed = br.impactedOperations.map((o) => o.operationId);
  const affected = br.affectedComponents.map((a) => a.id);

  // scheduled recovery at the end of the duration
  recording = record(recording, {
    t: exp.durationMin * 60_000, type: "recovery", componentId: exp.targetComponentId,
    variable: "status", to: "up", experimentId: exp.id,
    detail: `fault window ended after ${exp.durationMin} min: component restored`,
  });

  // hypothesis review: compare observed vs expected operation impact
  const expected = new Set(exp.expectedImpactedOperations);
  const observedSet = new Set(observed);
  const overlap = [...expected].filter((o) => observedSet.has(o));
  const ownOps = (id: string): string[] => m.connections
    .filter((cn) => cn.from === id || cn.to === id)
    .flatMap((cn) => cn.operationIds);
  let verdict: ChaosOutcome["verdict"];
  if (expected.size === 0) {
    // no-impact hypothesis: only the target's own operations may be affected
    const outsideOwnScope = observed.filter((o) => !ownOps(exp.targetComponentId).includes(o));
    if (outsideOwnScope.length === 0) {
      verdict = "supported";
      reviewNotes.push(`hypothesis of no impact is confirmed: only the target's own operations (${observed.join(", ") || "none"}) were affected`);
    } else {
      verdict = "contradicted";
      reviewNotes.push(`hypothesis of no impact is contradicted: ${outsideOwnScope.join(", ")} were impacted beyond the target's own operations`);
    }
  } else if (overlap.length === expected.size && observed.length === expected.size) {
    verdict = "supported";
    reviewNotes.push(`observed impact exactly matches the hypothesis: ${observed.join(", ")}`);
  } else if (overlap.length === expected.size && observed.length > expected.size) {
    verdict = "contradicted";
    reviewNotes.push(`the blast radius is LARGER than hypothesized: expected ${[...expected].join(", ")} but observed ${observed.join(", ")}`);
  } else if (overlap.length === 0 && observed.length === 0) {
    verdict = "contradicted";
    reviewNotes.push(`hypothesis expected impact on ${[...expected].join(", ")} but nothing was affected — the isolation is stronger than assumed`);
  } else if (overlap.length === 0 && observed.length > 0) {
    verdict = "contradicted";
    reviewNotes.push(`hypothesis expected impact on ${[...expected].join(", ")} but the model shows impact on ${observed.join(", ")} — the stated dependency assumption is wrong`);
  } else {
    verdict = "inconclusive";
    reviewNotes.push(`partial overlap: expected ${[...expected].join(", ")}; observed ${observed.join(", ")} — refine the hypothesis`);
  }
  reviewNotes.push("Scope: this ran entirely against the local educational model; no infrastructure was touched.");

  const findings: Finding[] = [finding(
    "chaos", `chaos:${exp.id}`, verdict === "contradicted" ? "critical" : verdict === "invalid" ? "critical" : "info",
    `Experiment ${exp.id}: hypothesis ${verdict}`,
    reviewNotes.join(" "),
    [
      { ref: `component:${exp.targetComponentId}`, detail: `injected ${exp.faultType} for ${exp.durationMin} min` },
      ...observed.map((o) => ({ ref: `operation:${o}`, detail: "observed impact" })),
    ],
  )];

  return { experiment: exp, recording, observedImpactedOperations: observed, observedAffectedComponents: affected, verdict, reviewNotes, findings };
}
