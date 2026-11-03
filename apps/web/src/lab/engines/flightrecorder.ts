/**
 * Task 28 — Architecture Flight Recorder.
 *
 * A deterministic, append-only event log of modeled behavior: faults, state
 * changes, queue transitions, retries, decisions, and recovery actions. Every
 * event carries its causal provenance (rule, component, experiment). Replay
 * is a pure fold over the log: state at tick k is always reproducible.
 */

export type RecordedEventType =
  | "fault" | "status-change" | "queue-depth" | "retry" | "decision" | "recovery" | "alert";

export interface RecordedEvent {
  /** monotonic sequence number assigned by the recorder */
  seq: number;
  /** logical time in ms since recording start */
  t: number;
  type: RecordedEventType;
  componentId?: string;
  variable?: string;
  from?: string;
  to?: string;
  ruleId?: string;
  cause?: string;
  experimentId?: string;
  detail: string;
}

export interface Recording {
  experimentId: string;
  startedAt: string;
  events: RecordedEvent[];
}

export function startRecording(experimentId: string, startedAt: string): Recording {
  return { experimentId, startedAt, events: [] };
}

/** Pure append: returns a NEW recording; the original is never mutated. */
export function record(rec: Recording, ev: Omit<RecordedEvent, "seq">): Recording {
  const seq = rec.events.length === 0 ? 1 : rec.events[rec.events.length - 1].seq + 1;
  return { ...rec, events: [...rec.events, { ...ev, seq }] };
}

/** Task 28.1/28.3 — import a causal propagation result as recorded events. */
export function recordFromPropagation(
  rec: Recording, propagation: {
    origin: { componentId: string; fault: string };
    events: { step: number; componentId: string; variable: string; change: string; ruleId: string; cause: string; path: string[] }[];
  }, experimentId: string,
): Recording {
  let out = record(rec, {
    t: 0, type: "fault", componentId: propagation.origin.componentId,
    variable: "status", to: propagation.origin.fault === "down" ? "down" : "degraded",
    ruleId: "R-INIT", experimentId,
    detail: `injected ${propagation.origin.fault} fault on ${propagation.origin.componentId}`,
  });
  propagation.events.forEach((e) => {
    out = record(out, {
      t: e.step, type: e.variable === "status" ? "status-change" : e.variable === "queueDepth" ? "queue-depth" : "decision",
      componentId: e.componentId, variable: e.variable,
      // "up -> down" folds to the FINAL state so replay is a proper state machine
      to: e.change.split(" -> ").pop() ?? e.change,
      ruleId: e.ruleId, cause: e.cause, experimentId,
      detail: `${e.componentId}.${e.variable}: ${e.change} (rule ${e.ruleId}, cause ${e.cause})`,
    });
  });
  return out;
}

/** Snapshot of modeled state derived by folding events up to a sequence number. */
export interface ReplayState {
  statuses: Record<string, string>;
  queueDepth: Record<string, number>;
  retries: Record<string, number>;
  lastSeq: number;
}

/** Task 28.2 — deterministic replay: fold the log up to seq (inclusive). */
export function stateAt(rec: Recording, upToSeq: number): ReplayState {
  const statuses: Record<string, string> = {};
  const queueDepth: Record<string, number> = {};
  const retries: Record<string, number> = {};
  let lastSeq = 0;
  rec.events
    .filter((e) => e.seq <= upToSeq)
    .forEach((e) => {
      lastSeq = e.seq;
      if (e.componentId === undefined) return;
      if (e.type === "status-change" || e.type === "fault") {
        statuses[e.componentId] = e.to ?? "unknown";
      } else if (e.type === "queue-depth") {
        queueDepth[e.componentId] = (queueDepth[e.componentId] ?? 0) + 1;
      } else if (e.type === "retry") {
        retries[e.componentId] = (retries[e.componentId] ?? 0) + 1;
      }
    });
  return { statuses, queueDepth, retries, lastSeq };
}

/** Replay window for the timeline UI: events in [fromSeq, toSeq]. */
export function windowEvents(rec: Recording, fromSeq: number, toSeq: number): RecordedEvent[] {
  return rec.events.filter((e) => e.seq >= fromSeq && e.seq <= toSeq);
}

/**
 * Integrity: recordings referencing components that do not exist in the model
 * are kept but flagged, so incomplete/hostile recordings never crash replay.
 */
export function integrityIssues(rec: Recording, knownComponents: Set<string>): { seq: number; problem: string }[] {
  const issues: { seq: number; problem: string }[] = [];
  rec.events.forEach((e) => {
    if (e.componentId && !knownComponents.has(e.componentId)) {
      issues.push({ seq: e.seq, problem: `event references unknown component ${e.componentId}` });
    }
  });
  // sequence numbers must be strictly increasing
  rec.events.forEach((e, i) => {
    if (i > 0 && e.seq <= rec.events[i - 1].seq) {
      issues.push({ seq: e.seq, problem: "sequence number not increasing" });
    }
  });
  return issues;
}
