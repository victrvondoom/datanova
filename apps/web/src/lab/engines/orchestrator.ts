/**
 * Task 33 — Controlled Fault-Injection Orchestrator.
 *
 * Ordered/concurrent fault plans with a safe execution state machine
 * (prepared/running/paused/stopped/completed/failed/reset), multi-fault
 * scenarios, and abort semantics: once aborted, NO further fault executes.
 */

import type { ArchitectureModel } from "../model";
import { propagate } from "./causal";
import { startRecording, recordFromPropagation, record, type Recording } from "./flightrecorder";

export type OrchestratorState =
  "prepared" | "running" | "paused" | "stopped" | "completed" | "failed" | "reset";

export interface FaultStep {
  id: string;
  componentId: string;
  fault: "down" | "slow";
  /** logical minute at which the fault fires */
  atMin: number;
  /** faults without duration persist to the end of the run */
  durationMin?: number;
  dependsOn?: string[];
}

export interface FaultPlan {
  id: string;
  steps: FaultStep[];
}

export interface PlanValidation {
  valid: boolean;
  errors: string[];
}

export function validatePlan(m: ArchitectureModel, plan: FaultPlan): PlanValidation {
  const errors: string[] = [];
  const ids = new Set(plan.steps.map((s) => s.id));
  plan.steps.forEach((s) => {
    if (!m.components.some((c) => c.id === s.componentId)) errors.push(`step ${s.id}: unknown component ${s.componentId}`);
    (s.dependsOn ?? []).forEach((d) => {
      if (!ids.has(d)) errors.push(`step ${s.id}: depends on unknown step ${d}`);
      const dep = plan.steps.find((x) => x.id === d);
      if (dep && dep.atMin > s.atMin) errors.push(`step ${s.id}: depends on ${d} which fires later (ordering violation)`);
    });
  });
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Execution state machine
// ---------------------------------------------------------------------------

const LEGAL: Record<OrchestratorState, Record<string, OrchestratorState>> = {
  prepared: { start: "running", reset: "reset" },
  running: { pause: "paused", abort: "stopped", complete: "completed", fail: "failed" },
  paused: { resume: "running", abort: "stopped", fail: "failed" },
  stopped: { reset: "reset" },
  completed: { reset: "reset" },
  failed: { reset: "reset" },
  reset: {},
};

export function transition(state: OrchestratorState, action: string):
  { state: OrchestratorState; error?: string } {
  const next = LEGAL[state][action];
  if (!next) return { state, error: `illegal transition: ${action} from ${state}` };
  return { state: next };
}

// ---------------------------------------------------------------------------
// Multi-fault execution
// ---------------------------------------------------------------------------

export interface PlanExecution {
  planId: string;
  finalState: OrchestratorState;
  recording: Recording;
  executedSteps: string[];
  skippedSteps: string[];
  /** merged modeled status across all faults (down > degraded > up) */
  combinedStatus: Record<string, "up" | "degraded" | "down">;
  abortAtMin?: number;
}

const rankOf = (s: string): number => (s === "down" ? 2 : s === "degraded" ? 1 : 0);

export function runPlan(
  m: ArchitectureModel, plan: FaultPlan, opts: { abortAfterStep?: string; pausedAtMin?: number } = {},
): PlanExecution {
  const ordered = [...plan.steps].sort((a, b) => a.atMin - b.atMin);
  let recording = startRecording(plan.id, "t0");
  const executed: string[] = [];
  const skipped: string[] = [];
  const combined: Record<string, "up" | "degraded" | "down"> = {};
  let aborted = false;
  let paused = false;

  for (const step of ordered) {
    if (aborted) { skipped.push(step.id); continue; }
    // dependency readiness
    const deps = step.dependsOn ?? [];
    if (deps.some((d) => !executed.includes(d))) {
      skipped.push(step.id);
      recording = record(recording, {
        t: step.atMin * 60_000, type: "decision", experimentId: plan.id,
        detail: `step ${step.id} skipped: dependency not executed (${deps.join(", ")})`,
      });
      continue;
    }
    // pause support: steps at or after the pause minute are not executed yet
    if (opts.pausedAtMin !== undefined && step.atMin >= opts.pausedAtMin) {
      paused = true;
      skipped.push(step.id);
      continue;
    }

    const prop = propagate(m, { componentId: step.componentId, fault: step.fault });
    recording = recordFromPropagation(recording, prop, plan.id);
    Object.entries(prop.finalStatus).forEach(([id, st]) => {
      combined[id] ??= "up";
      if (rankOf(st) > rankOf(combined[id])) combined[id] = st;
    });
    executed.push(step.id);
    recording = record(recording, {
      t: step.atMin * 60_000, type: "fault", componentId: step.componentId,
      variable: "status", to: step.fault === "down" ? "down" : "degraded",
      experimentId: plan.id, detail: `step ${step.id}: injected ${step.fault} on ${step.componentId}`,
    });
    if (step.durationMin) {
      recording = record(recording, {
        t: (step.atMin + step.durationMin) * 60_000, type: "recovery",
        componentId: step.componentId, variable: "status", to: "up",
        experimentId: plan.id, detail: `step ${step.id}: fault window ended, component restored`,
      });
      if (combined[step.componentId] === (step.fault === "down" ? "down" : "degraded")) {
        combined[step.componentId] = "up";
      }
    }
    if (opts.abortAfterStep === step.id) aborted = true;
  }

  return {
    planId: plan.id,
    finalState: aborted ? "stopped" : paused ? "paused" : executed.length === plan.steps.length ? "completed" : "failed",
    recording,
    executedSteps: executed,
    skippedSteps: skipped,
    combinedStatus: combined,
    abortAtMin: opts.abortAfterStep ? ordered.find((s) => s.id === opts.abortAfterStep)?.atMin : undefined,
  };
}
