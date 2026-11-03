/**
 * Campaign 04, Task 16 — Scenario Engine.
 *
 * Versioned, reusable scenarios binding a workload + a fault plan + expected
 * observations to an architecture snapshot (by genome fingerprint).
 * Deterministic: identical scenario + model → identical results.
 */

import type { ArchitectureModel } from "../model";
import { extractGenome } from "./genome";
import { simulateQueue, type TrafficProfile } from "./traffic";
import { runPlan, validatePlan, type FaultStep } from "./orchestrator";
import { blastRadius } from "./blastradius";

export interface ScenarioExpectation {
  id: string;
  kind: "affected-operations" | "survives-operations" | "queue-saturation" | "no-drops";
  /** operation ids / component id the expectation is about */
  target: string[];
  /** the modeled outcome the scenario author expects */
  expected: string;
}

export interface Scenario {
  id: string;
  name: string;
  version: number;
  /** genome fingerprint of the architecture this scenario was authored against */
  archFingerprint: string;
  workload: TrafficProfile;
  /** fixed or exponential work duration for the queue simulation */
  workMs: number;
  workers: number;
  queueCapacity: number;
  faults: FaultStep[];
  expectations: ScenarioExpectation[];
  provenance: string;
}

export type ExpectationOutcome = "pass" | "fail" | "not-applicable";

export interface ExpectationResult {
  expectationId: string;
  kind: ScenarioExpectation["kind"];
  outcome: ExpectationOutcome;
  detail: string;
}

export interface ScenarioRunResult {
  scenarioId: string;
  deterministic: true;
  workload: ReturnType<typeof simulateQueue>;
  faults: ReturnType<typeof runPlan>;
  expectationResults: ExpectationResult[];
  allPassed: boolean;
  assumptions: string[];
}

export class ScenarioError extends Error {}

/** Task 16.2 — validate a scenario against the architecture it will run on. */
export function validateScenario(m: ArchitectureModel, s: Scenario): { valid: boolean; problems: string[] } {
  const problems: string[] = [];
  if (s.version < 1) problems.push("scenario version must be >= 1");
  if (!s.name) problems.push("scenario has no name");
  const fingerprint = extractGenome(m).fingerprint;
  if (s.archFingerprint !== fingerprint) {
    problems.push(
      `scenario was authored for architecture genome ${s.archFingerprint} but the current architecture is ${fingerprint} — clone and re-validate the scenario against this architecture`,
    );
  }
  const planValidation = validatePlan(m, { id: s.id, steps: s.faults });
  problems.push(...planValidation.errors);
  if (s.workload.durationSec <= 0) problems.push("workload duration must be positive");
  if (s.workers <= 0) problems.push("worker count must be positive");
  s.expectations.forEach((e) => {
    if (e.kind === "affected-operations" || e.kind === "survives-operations") {
      e.target.forEach((op) => {
        if (!m.operations.some((o) => o.id === op)) problems.push(`expectation ${e.id} references unknown operation ${op}`);
      });
    }
    if (!e.expected || e.expected.length < 3) problems.push(`expectation ${e.id} has no stated expected outcome`);
  });
  return { valid: problems.length === 0, problems };
}

/** Execute a scenario: deterministic workload sim + fault plan + expectation review. */
export function runScenario(m: ArchitectureModel, s: Scenario): ScenarioRunResult {
  const validation = validateScenario(m, s);
  if (!validation.valid) {
    throw new ScenarioError(`scenario ${s.id} is not compatible with this architecture: ${validation.problems.join("; ")}`);
  }

  const workload = simulateQueue(s.workload, { kind: "fixed", ms: s.workMs },
    { workers: s.workers, queueCapacity: s.queueCapacity });
  const faults = runPlan(m, { id: s.id, steps: s.faults });

  // evaluate expectations against the modeled outcomes
  const impactedOps = new Set<string>();
  s.faults.forEach((f) => {
    blastRadius(m, f.componentId, f.fault).impactedOperations.forEach((o) => impactedOps.add(o.operationId));
  });

  const expectationResults: ExpectationResult[] = s.expectations.map((e) => {
    switch (e.kind) {
      case "affected-operations": {
        const affected = e.target.filter((op) => impactedOps.has(op));
        const pass = affected.length === e.target.length;
        return {
          expectationId: e.id, kind: e.kind,
          outcome: pass ? "pass" : "fail",
          detail: `expected impacted: ${e.target.join(", ") || "(none)"}; modeled impacted: ${[...impactedOps].join(", ") || "(none)"}`,
        };
      }
      case "survives-operations": {
        const hit = e.target.filter((op) => impactedOps.has(op));
        return {
          expectationId: e.id, kind: e.kind,
          outcome: hit.length === 0 ? "pass" : "fail",
          detail: hit.length === 0
            ? `none of ${e.target.join(", ")} were impacted by the faults — as expected`
            : `expected to survive, but modeled impact on: ${hit.join(", ")}`,
        };
      }
      case "queue-saturation": {
        const saturated = workload.saturated;
        const expectedSaturation = /saturat|backlog grows|overload/i.test(e.expected);
        return {
          expectationId: e.id, kind: e.kind,
          outcome: saturated === expectedSaturation ? "pass" : "fail",
          detail: `modeled saturation=${saturated}; expectation stated "${e.expected}"`,
        };
      }
      case "no-drops": {
        return {
          expectationId: e.id, kind: e.kind,
          outcome: workload.totalDropped === 0 ? "pass" : "fail",
          detail: `modeled drops=${workload.totalDropped} of ${workload.totalArrived} arrivals`,
        };
      }
    }
  });

  return {
    scenarioId: s.id,
    deterministic: true,
    workload,
    faults,
    expectationResults,
    allPassed: expectationResults.every((r) => r.outcome === "pass"),
    assumptions: [
      ...workload.assumptions,
      "Fault effects use the causal propagation model; real infrastructure behavior is not measured.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Task 16.3 — reusable, versioned, provenance-labeled templates
// ---------------------------------------------------------------------------

export type ScenarioTemplateId = "peak-hour-outage" | "burst-overload" | "dependency-brownout";

export function scenarioTemplate(
  template: ScenarioTemplateId, m: ArchitectureModel, peakRps: number,
): Scenario {
  const fingerprint = extractGenome(m).fingerprint;
  const worker = m.components.find((c) => c.kind === "worker");
  const queue = m.components.find((c) => c.kind === "queue");
  const database = m.components.find((c) => c.kind === "database" || c.kind === "objectstore");
  const workMs = Number(worker?.config.processingMs ?? 4000);
  // ops that actually depend on the datastore (expectations derive from the model)
  const opsTouching = (id: string): string[] => m.operations
    .filter((o) => m.connections.some((cn) => cn.operationIds.includes(o.id) && (cn.from === id || cn.to === id)))
    .map((o) => o.id);
  const base: Omit<Scenario, "id" | "name" | "workload" | "faults" | "expectations" | "provenance"> = {
    version: 1,
    archFingerprint: fingerprint,
    workMs,
    workers: Number(worker?.config.concurrency ?? 4),
    queueCapacity: Number(queue?.config.capacity ?? 5000),
  };
  switch (template) {
    case "peak-hour-outage":
      return {
        ...base,
        id: `scenario-${template}-v1`,
        name: "Peak-hour outage",
        workload: { kind: "steady", baseRatePerSec: peakRps, durationSec: 60, seed: 42 },
        faults: database
          ? [{ id: "f1", componentId: database.id, fault: "down", atMin: 1, durationMin: 5 }]
          : [],
        expectations: database
          ? [{ id: "x1", kind: "affected-operations", target: opsTouching(database.id),
              expected: "the outage impacts every operation that depends on the failed store" }]
          : [],
        provenance: "campaign-04 template: steady peak load with a 5-minute datastore outage",
      };
    case "burst-overload":
      return {
        ...base,
        id: `scenario-${template}-v1`,
        name: "Burst overload",
        workload: { kind: "bursty", baseRatePerSec: peakRps / 2, burstMultiplier: 3,
          burstEverySec: 10, burstDurationSec: 5, durationSec: 60, seed: 42 },
        faults: [],
        expectations: [
          { id: "x1", kind: "queue-saturation", target: [],
            expected: "the queue saturates: bursts exceed processing capacity" },
        ],
        provenance: "campaign-04 template: 3x bursts at half the peak rate",
      };
    case "dependency-brownout":
      return {
        ...base,
        id: `scenario-${template}-v1`,
        name: "Dependency brownout",
        workload: { kind: "steady", baseRatePerSec: peakRps, durationSec: 60, seed: 42 },
        faults: database
          ? [{ id: "f1", componentId: database.id, fault: "slow", atMin: 0, durationMin: 10 }]
          : [],
        expectations: database
          ? [
              { id: "x1", kind: "affected-operations", target: opsTouching(database.id),
                expected: "latency faults degrade the callers along synchronous paths" },
              { id: "x2", kind: "queue-saturation", target: [],
                expected: "the queue saturates: sustained peak load exceeds worker capacity" },
            ]
          : [],
        provenance: "campaign-04 template: latency fault on the primary store",
      };
  }
}

/** Task 16.4 — clone a scenario onto a new architecture and bump its version. */
export function cloneScenario(s: Scenario, m: ArchitectureModel, overrides: Partial<Scenario> = {}): Scenario {
  return {
    ...s,
    ...overrides,
    id: `${s.id}-clone`,
    version: s.version + 1,
    archFingerprint: extractGenome(m).fingerprint,
    provenance: `cloned from ${s.id} v${s.version} (${s.provenance})`,
  };
}
