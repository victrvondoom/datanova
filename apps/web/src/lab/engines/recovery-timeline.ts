/**
 * Campaign 04, Task 20 — Recovery Timeline and State Reconstruction.
 *
 * Recovery is a sequence of state transitions. This engine folds a recorded
 * experiment (flight recorder) into a per-component recovery timeline:
 * fault → (optional recovery actions) → restored | stalled, with blocked
 * recoveries identified (a component cannot recover while a blocking sync
 * dependency is down) and invalid sequences flagged (recovery before fault).
 */

import type { ArchitectureModel } from "../model";
import { stateAt, type Recording } from "./flightrecorder";

export type RecoveryPhase = "healthy" | "faulted" | "recovering" | "recovered" | "stalled" | "re-faulted";

export interface RecoveryStep {
  seq: number;
  t: number;
  componentId: string;
  phase: RecoveryPhase;
  detail: string;
}

export interface ComponentRecoveryState {
  componentId: string;
  finalPhase: RecoveryPhase;
  /** seq of the fault that (last) hit this component */
  faultedAtSeq?: number;
  /** seq of the recovery that restored it, if any */
  recoveredAtSeq?: number;
  /** true when recovery actions exist but a blocking dependency is still down */
  blockedBy?: string[];
  steps: RecoveryStep[];
}

export interface RecoveryTimeline {
  experimentId: string;
  components: ComponentRecoveryState[];
  /** events that referenced unknown components or invalid sequences */
  anomalies: { seq: number; problem: string }[];
  finalSummary: {
    recovered: number;
    stalled: number;
    reFaulted: number;
    neverFaulted: number;
  };
  assumptions: string[];
}

export function recoveryTimeline(m: ArchitectureModel, rec: Recording): RecoveryTimeline {
  const known = new Set(m.components.map((c) => c.id));
  const states = new Map<string, ComponentRecoveryState>();
  const anomalies: { seq: number; problem: string }[] = [];
  const ensure = (id: string): ComponentRecoveryState => {
    let s = states.get(id);
    if (!s) {
      s = { componentId: id, finalPhase: "healthy", steps: [] };
      states.set(id, s);
    }
    return s;
  };

  rec.events.forEach((e) => {
    if (e.componentId !== undefined && !known.has(e.componentId)) {
      anomalies.push({ seq: e.seq, problem: `event references unknown component ${e.componentId} (kept, not applied)` });
      return;
    }
    if (e.type === "fault" || (e.type === "status-change" && e.to === "down")) {
      const s = ensure(e.componentId as string);
      // the flight recorder emits BOTH the injected fault event and the
      // propagated status-change for the same component: count it once
      if (s.finalPhase === "faulted") {
        return; // duplicate observation of the same fault
      }
      // a re-fault is a NEW fault after a recovery was attempted
      const reFault = s.steps.some((st) => st.phase === "recovering");
      s.steps.push({ seq: e.seq, t: e.t, componentId: s.componentId,
        phase: reFault ? "re-faulted" : "faulted", detail: e.detail });
      s.finalPhase = reFault ? "re-faulted" : "faulted";
      s.faultedAtSeq = e.seq;
    } else if (e.type === "recovery" || (e.type === "status-change" && e.to === "up")) {
      const s = ensure(e.componentId as string);
      if (s.steps.length === 0) {
        anomalies.push({ seq: e.seq, problem: `recovery event for ${e.componentId} before any recorded fault — invalid sequence` });
        return;
      }
      s.steps.push({ seq: e.seq, t: e.t, componentId: s.componentId, phase: "recovering", detail: e.detail });
      s.finalPhase = "recovering";
    }
  });

  // finalize: fold to the end state; determine recovered vs stalled
  const final = stateAt(rec, Number.MAX_SAFE_INTEGER);
  const components = [...states.values()].map((s) => {
    const finalStatus = final.statuses[s.componentId];
    // "re-faulted" is terminal as-is: it documents a fault after an attempted
    // recovery; its unresolved state is implied
    if (s.finalPhase === "recovering" || s.finalPhase === "faulted") {
      if (finalStatus === "up") {
        s.finalPhase = "recovered";
        s.recoveredAtSeq = s.steps[s.steps.length - 1]?.seq;
      } else {
        // stalled unless a blocking sync dependency is also down
        const blockers = m.connections
          .filter((cn) => cn.kind === "sync" && cn.failureBehavior === "blocks" && cn.to === s.componentId)
          .map((cn) => cn.from)
          .filter((caller) => caller !== s.componentId && final.statuses[caller] === "down");
        s.finalPhase = "stalled";
        s.blockedBy = blockers.length > 0 ? blockers : undefined;
      }
    }
    return s;
  });

  const summary = {
    recovered: components.filter((c) => c.finalPhase === "recovered").length,
    stalled: components.filter((c) => c.finalPhase === "stalled").length,
    reFaulted: components.filter((c) => c.finalPhase === "re-faulted").length,
    neverFaulted: m.components.filter((c) => !states.has(c.id)).length,
  };

  return {
    experimentId: rec.experimentId,
    components,
    anomalies,
    finalSummary: summary,
    assumptions: [
      "Recovery phases are derived from the recorded event log (a pure fold), not from wall-clock observation.",
      "'stalled' means the fault window never ended in the recording; blockedBy lists blocking sync callers that are still down.",
    ],
  };
}

/**
 * Task 20.4 — bottleneck view: which recoveries are blocked, and by what.
 * A recovery bottleneck is a component whose own fault ended but whose
 * blocking dependency is still down (or vice versa).
 */
export interface RecoveryBottleneck {
  componentId: string;
  reason: string;
  unblockingAction: string;
}

export function recoveryBottlenecks(tl: RecoveryTimeline): RecoveryBottleneck[] {
  return tl.components
    .filter((c) => c.finalPhase === "stalled")
    .map((c) => ({
      componentId: c.componentId,
      reason: c.blockedBy && c.blockedBy.length > 0
        ? `its blocking sync caller(s) ${c.blockedBy.join(", ")} are still down`
        : "its fault window never ended within the recording",
      unblockingAction: c.blockedBy && c.blockedBy.length > 0
        ? `restore ${c.blockedBy.join(", ")} first, then re-run the recovery for ${c.componentId}`
        : `complete or cancel the recovery action for ${c.componentId} and record the outcome`,
    }));
}
