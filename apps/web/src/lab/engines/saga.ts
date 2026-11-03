/**
 * Task 20 — Saga State-Machine Verifier.
 *
 * Sagas are validated as state machines (unreachable states, missing
 * compensations, ambiguous terminals), failure paths are enumerated, and a
 * deterministic timeline debugger executes the saga with injected failures —
 * including compensation failure and manual recovery.
 */

import type { ArchitectureModel } from "../model";

export interface SagaStep {
  id: string;
  name: string;
  actionComponentId: string;
  /** true if the step mutates state that a compensation must undo */
  mutates: boolean;
  compensation?: { actionComponentId: string; name: string };
  retryMax?: number;
}

export interface SagaDefinition {
  id: string;
  name: string;
  steps: SagaStep[];
  terminalStates: string[];
}

export interface SagaIssue {
  kind: "missing-compensation" | "unreachable-step" | "ambiguous-terminal" | "unknown-component";
  detail: string;
}

/** Task 20.2 — state-machine validation. */
export function validateSaga(m: ArchitectureModel, saga: SagaDefinition): SagaIssue[] {
  const issues: SagaIssue[] = [];
  saga.steps.forEach((s) => {
    if (s.mutates && !s.compensation) {
      issues.push({
        kind: "missing-compensation",
        detail: `step "${s.name}" mutates state but declares no compensation — a failure after it leaves the workflow unrecoverable automatically`,
      });
    }
    if (!m.components.some((c) => c.id === s.actionComponentId)) {
      issues.push({ kind: "unknown-component", detail: `step "${s.name}" references unknown component ${s.actionComponentId}` });
    }
    if (s.compensation && !m.components.some((c) => c.id === s.compensation.actionComponentId)) {
      issues.push({ kind: "unknown-component", detail: `compensation for "${s.name}" references unknown component ${s.compensation.actionComponentId}` });
    }
    // unreachable: a step whose action component has no inbound connection from
    // the previous step's component is not necessarily broken, but a step that
    // is not reachable from any start via the component graph is flagged
    if (saga.steps.indexOf(s) > 0) {
      const prev = saga.steps[saga.steps.indexOf(s) - 1];
      const connected = m.connections.some((cn) =>
        (cn.from === prev.actionComponentId && cn.to === s.actionComponentId) ||
        (cn.from === s.actionComponentId && cn.to === prev.actionComponentId));
      if (!connected) {
        issues.push({
          kind: "unreachable-step",
          detail: `step "${s.name}" cannot follow "${prev.name}": no connection between ${prev.actionComponentId} and ${s.actionComponentId} in the model`,
        });
      }
    }
  });
  if (!saga.terminalStates.includes("completed") || !saga.terminalStates.includes("compensated")) {
    issues.push({
      kind: "ambiguous-terminal",
      detail: `terminal states must distinguish success and compensation (${saga.terminalStates.join(", ")} given)`,
    });
  }
  return issues;
}

/** Task 20.3 — enumerate failure paths: failure at step i compensates i-1..0. */
export interface FailurePath {
  failAtStep: string;
  compensations: string[];
  outcome: "completed" | "compensated" | "manual-recovery";
  note: string;
}

export function failurePaths(saga: SagaDefinition): FailurePath[] {
  const paths: FailurePath[] = [{
    failAtStep: "(none)", compensations: [], outcome: "completed", note: "all steps succeed",
  }];
  saga.steps.forEach((step, i) => {
    const toCompensate = saga.steps.slice(0, i).filter((s) => s.mutates);
    const missing = toCompensate.some((s) => !s.compensation);
    paths.push({
      failAtStep: step.name,
      compensations: toCompensate.reverse().map((s) => s.compensation?.name ?? `${s.name} (NO COMPENSATION)`),
      outcome: missing ? "manual-recovery" : "compensated",
      note: missing
        ? "at least one completed step has no compensation: manual recovery required"
        : `compensations run in reverse order after "${step.name}" fails`,
    });
  });
  return paths;
}

// ---------------------------------------------------------------------------
// Task 20.4 — deterministic timeline execution with injected failure
// ---------------------------------------------------------------------------

export interface SagaEvent {
  t: number;
  step: string;
  action: "forward" | "retry" | "compensate" | "fail";
  detail: string;
  committed: boolean;
}

export interface SagaExecution {
  sagaId: string;
  events: SagaEvent[];
  finalState: "completed" | "compensated" | "manual-recovery";
  /** steps left uncommitted/unresolved when the run ended */
  unresolved: string[];
  assumptions: string[];
}

export function executeSaga(
  saga: SagaDefinition, opts: { failAtStep?: string; retryBehavior?: "succeeds-after-retries" | "always-fails"; compensateFailsAt?: string } = {},
): SagaExecution {
  const events: SagaEvent[] = [];
  let t = 0;
  const completed: SagaStep[] = [];

  for (const step of saga.steps) {
    if (opts.failAtStep === step.id) {
      const retries = step.retryMax ?? 0;
      for (let r = 1; r <= retries; r++) {
        t += 1;
        events.push({ t, step: step.id, action: "retry", detail: `retry ${r}/${retries} of "${step.name}" (transient failure)`, committed: false });
      }
      t += 1;
      const recovered = (opts.retryBehavior ?? "always-fails") === "succeeds-after-retries" && retries > 0;
      events.push({
        t, step: step.id, action: recovered ? "forward" : "fail",
        detail: recovered ? `"${step.name}" succeeded after retries` : `"${step.name}" failed permanently after ${retries} retry(s)`,
        committed: recovered,
      });
      if (recovered) {
        completed.push(step);
        continue; // eslint-disable-line no-continue
      }
      // compensate completed mutating steps in reverse order
      const toCompensate = [...completed].reverse().filter((s) => s.mutates);
      let compensationFailed = false;
      for (const s of toCompensate) {
        t += 1;
        const fails = opts.compensateFailsAt === s.id;
        events.push({
          t, step: s.id, action: "compensate",
          detail: fails
            ? `compensation "${s.compensation?.name}" FAILED — manual recovery required`
            : `compensation "${s.compensation?.name}" undid "${s.name}"`,
          committed: !fails,
        });
        if (fails) compensationFailed = true;
      }
      const missingComp = completed.some((s) => s.mutates && !s.compensation);
      return {
        sagaId: saga.id,
        events,
        finalState: compensationFailed || missingComp ? "manual-recovery" : "compensated",
        unresolved: compensationFailed ? toCompensate.filter((s) => opts.compensateFailsAt === s.id).map((s) => s.name) : [],
        assumptions: [
          "Deterministic educational model: steps are discrete, retries are counted, no timing jitter.",
          "A permanently failed step never commits; compensations only run for committed mutating steps.",
        ],
      };
    }
    t += 1;
    events.push({ t, step: step.id, action: "forward", detail: `"${step.name}" committed locally`, committed: true });
    completed.push(step);
  }
  return {
    sagaId: saga.id,
    events,
    finalState: "completed",
    unresolved: [],
    assumptions: ["Deterministic educational model: all steps succeeded."],
  };
}

/** Reference saga for the DocFlow delete-document workflow. */
export function docflowDeleteSaga(): SagaDefinition {
  return {
    id: "saga-delete", name: "Delete document (all derived data)",
    terminalStates: ["completed", "compensated"],
    steps: [
      { id: "s1", name: "Mark document deleted in metadata", actionComponentId: "upload-svc", mutates: true,
        compensation: { actionComponentId: "upload-svc", name: "Restore metadata record" }, retryMax: 2 },
      { id: "s2", name: "Delete original from document store", actionComponentId: "doc-store", mutates: true,
        compensation: { actionComponentId: "doc-store", name: "Restore document from backup" } },
      { id: "s3", name: "Emit deletion event for analytics", actionComponentId: "worker", mutates: false, retryMax: 3 },
      { id: "s4", name: "Send deletion confirmation email", actionComponentId: "notify", mutates: false },
    ],
  };
}
