/**
 * Task 34 — Recovery Evidence and Verification Ledger.
 *
 * "The system recovered" is a claim that must be earned: recovery criteria are
 * declared, evidence is collected from the flight recorder, and the verdict
 * (RECOVERED / PARTIALLY_RECOVERED / NOT_RECOVERED / INCONCLUSIVE) follows
 * from the evidence — with missing observations named explicitly.
 */

import type { Finding } from "../model";
import { finding } from "../model";
import { stateAt, type Recording } from "./flightrecorder";

export interface RecoveryCriterion {
  /** e.g. "component-restored", "queue-drained", "read-after-write-ok" */
  kind: "component-restored" | "queue-drained" | "error-rate-recovered" | "read-after-write-ok";
  componentId: string;
  statement: string;
}

export type RecoveryVerdict = "RECOVERED" | "PARTIALLY_RECOVERED" | "NOT_RECOVERED" | "INCONCLUSIVE";

export interface CriterionEvaluation {
  criterion: RecoveryCriterion;
  observed: boolean | null; // null = no evidence in the recording
  evidence: string[];
}

export interface RecoveryReport {
  verdict: RecoveryVerdict;
  evaluations: CriterionEvaluation[];
  missingObservations: string[];
  findings: Finding[];
}

/** Evaluate declared criteria against a recording's evidence. */
export function evaluateRecovery(recording: Recording, criteria: RecoveryCriterion[]): RecoveryReport {
  const final = stateAt(recording, Number.MAX_SAFE_INTEGER);

  const evaluations: CriterionEvaluation[] = criteria.map((c) => {
    const relevant = recording.events.filter((e) => e.componentId === c.componentId);
    switch (c.kind) {
      case "component-restored": {
        // any recorded event about this component is evidence; the FOLD decides
        const hasEvidence = relevant.length > 0;
        const restored = final.statuses[c.componentId] === "up";
        return {
          criterion: c,
          observed: hasEvidence ? restored : null,
          evidence: relevant.map((e) => `seq ${e.seq}: ${e.detail}`),
        };
      }
      case "queue-drained": {
        const depthEvents = recording.events.filter((e) => e.type === "queue-depth" && e.componentId === c.componentId);
        const drainEvent = depthEvents.find((e) => /drain|depth.*0|back to/i.test(e.detail));
        if (depthEvents.length === 0) {
          return { criterion: c, observed: null, evidence: [] };
        }
        return {
          criterion: c,
          observed: drainEvent !== undefined,
          evidence: depthEvents.slice(-3).map((e) => `seq ${e.seq}: ${e.detail}`),
        };
      }
      case "error-rate-recovered": {
        // requires an explicit recovery/verification event; the model cannot
        // observe rates on its own
        const evt = recording.events.find((e) =>
          e.type === "recovery" && e.componentId === c.componentId && /error rate|baseline/i.test(e.detail));
        return {
          criterion: c,
          observed: evt ? true : null,
          evidence: evt ? [`seq ${evt.seq}: ${evt.detail}`] : [],
        };
      }
      case "read-after-write-ok": {
        const evt = recording.events.find((e) =>
          e.type === "decision" && /read-after-write/i.test(e.detail));
        return {
          criterion: c,
          observed: evt ? /ok|passes/i.test(evt.detail) : null,
          evidence: evt ? [`seq ${evt.seq}: ${evt.detail}`] : [],
        };
      }
    }
  });

  const evidenced = evaluations.filter((e) => e.observed !== null);
  const satisfied = evidenced.filter((e) => e.observed === true);
  const failed = evidenced.filter((e) => e.observed === false);
  const missing = evaluations.filter((e) => e.observed === null);

  let verdict: RecoveryVerdict;
  if (evidenced.length === 0) {
    verdict = "INCONCLUSIVE";
  } else if (failed.length === 0 && satisfied.length === evaluations.length) {
    verdict = "RECOVERED";
  } else if (failed.length === 0 && satisfied.length > 0) {
    verdict = "PARTIALLY_RECOVERED";
  } else if (failed.length === evidenced.length) {
    verdict = "NOT_RECOVERED";
  } else {
    verdict = "PARTIALLY_RECOVERED";
  }

  const findings: Finding[] = [
    finding(
      "recovery", `recovery-verdict:${verdict}`,
      verdict === "RECOVERED" ? "info" : verdict === "INCONCLUSIVE" ? "warning" : "critical",
      `Recovery verdict: ${verdict}`,
      `${satisfied.length}/${criteria.length} criteria satisfied with evidence; ${failed.length} evidenced as failing; ${missing.length} without observations.`,
      evaluations.flatMap((e) => e.evidence.map((ev) => ({ ref: `recording:${e.criterion.componentId}`, detail: ev }))),
    ),
    ...missing.map((m) => finding(
      "recovery", `recovery-missing:${m.criterion.componentId}:${m.criterion.kind}`, "warning",
      `Missing observation: ${m.criterion.statement}`,
      "No recorded evidence speaks to this criterion — the verdict cannot rely on it.",
      [{ ref: `recording:${m.criterion.componentId}`, detail: `criterion ${m.criterion.kind} unobserved` }],
    )),
  ];

  return {
    verdict,
    evaluations,
    missingObservations: missing.map((m) => m.criterion.statement),
    findings,
  };
}
