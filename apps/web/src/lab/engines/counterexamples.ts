/**
 * Campaign 05, Task 18 — Counterexample and challenge corpus.
 *
 * A critic rule is only trustworthy if it survives cases where the rule's
 * trigger fires but the recommendation should NOT (false positive) or where
 * the trigger does not fire but the risk exists anyway (false negative).
 * Each challenge records the expected outcome and the reason, so corrected
 * rules keep passing and regressions are caught.
 */

import type { ArchitectureModel } from "../model";
import { critiqueArchitecture } from "./critic";
import { flawedCheckoutModel } from "../samples";

export interface Counterexample {
  id: string;
  /** the rule under challenge */
  ruleId: string;
  title: string;
  /** what the challenge changes about the assumptions */
  modifiedAssumptions: string;
  /** expected critic behavior on the challenge model (for the target component, when given) */
  expected: "no-finding" | "finding";
  /** component the expectation is scoped to; omit for whole-rule scope */
  targetComponentId?: string;
  /** why the expected outcome is correct */
  rationale: string;
  /** the model the critic is run against */
  model: ArchitectureModel;
}

export interface ChallengeResult {
  counterexampleId: string;
  ruleId: string;
  passed: boolean;
  actual: "no-finding" | "finding";
  expected: "no-finding" | "finding";
  rationale: string;
}

export function runCounterexamples(cases: Counterexample[]): ChallengeResult[] {
  return cases.map((cx) => {
    const { findings } = critiqueArchitecture(cx.model);
    const relevant = cx.targetComponentId
      ? findings.filter((f) => f.id === `critic-${cx.ruleId}:${cx.targetComponentId}`)
      : findings.filter((f) => f.id.startsWith(`critic-${cx.ruleId}:`));
    const fired = relevant.length > 0;
    const actual = fired ? "finding" : "no-finding";
    return {
      counterexampleId: cx.id,
      ruleId: cx.ruleId,
      passed: actual === cx.expected,
      actual,
      expected: cx.expected,
      rationale: cx.rationale,
    };
  });
}

/**
 * The challenge corpus. Positive control (the rule fires on the known-flawed
 * fixture) plus one counterexample per rule showing the condition under which
 * the rule must NOT fire — these pin each rule's "does NOT apply when" clause.
 */
export function buildCounterexamples(): Counterexample[] {
  const base = flawedCheckoutModel();
  const idempotent = flawedCheckoutModel();
  idempotent.components.find((c) => c.id === "c-api")!.config.idempotent = true;
  const withTimeout = flawedCheckoutModel();
  withTimeout.components.find((c) => c.id === "c-api")!.config.timeoutMs = 2000;
  const buffered = flawedCheckoutModel();
  const k3 = buffered.connections.find((c) => c.id === "k-3")!;
  k3.kind = "async";
  k3.failureBehavior = "degrades";
  const documented = flawedCheckoutModel();
  const logger = documented.components.find((c) => c.id === "c-logging")!;
  logger.purpose = "Shared platform tooling: audit trail for compliance review";
  logger.requirementIds = ["R-1"];

  return [
    {
      id: "cx-control-spof",
      ruleId: "spof",
      title: "Control: the flawed checkout fires the SPOF rule",
      modifiedAssumptions: "None — the unmodified flawed fixture.",
      expected: "finding",
      rationale: "The order database (replicas=1, only sync callers) takes down the criticality-5 checkout operation; the rule must fire.",
      model: base,
    },
    {
      id: "cx-spof-buffered",
      ruleId: "spof",
      targetComponentId: "c-db",
      title: "False-positive challenge: async buffer in front of the database",
      modifiedAssumptions: "The API's write to the order database becomes an async buffered connection, so a database outage degrades instead of blocking checkout.",
      expected: "no-finding",
      rationale: "The rule's documented exception: an async buffer in front means the critical operation survives the outage (work is queued), so no single point of failure is reported for the database.",
      model: buffered,
    },
    {
      id: "cx-idempotent-service",
      ruleId: "unidempotent-mutations",
      title: "False-positive challenge: the mutating service declares idempotency",
      modifiedAssumptions: "The checkout API declares config.idempotent = true (an idempotency-key lifecycle exists).",
      expected: "no-finding",
      rationale: "The rule exists to catch unhandled duplicate side effects; a declared idempotent mutation is the rule's own documented remedy, so it must not fire.",
      model: idempotent,
    },
    {
      id: "cx-external-timeout",
      ruleId: "sync-external",
      title: "False-positive challenge: the external call has an explicit timeout",
      modifiedAssumptions: "The checkout API declares timeoutMs = 2000 for its payment-provider call.",
      expected: "no-finding",
      rationale: "The rule targets unbounded hangs; with an explicit timeout the hang converts into a bounded failure the caller can handle, so the rule must not fire.",
      model: withTimeout,
    },
    {
      id: "cx-orphan-documented",
      ruleId: "complexity-without-requirement",
      title: "False-positive challenge: the orphan is mapped and documented",
      modifiedAssumptions: "The audit logger gains a purpose and maps to requirement R-1 (its audit trail supports the payment requirement).",
      expected: "no-finding",
      rationale: "Complexity is justified by a requirement mapping plus a documented purpose — exactly the rule's recommended remedy — so the orphan finding must disappear.",
      model: documented,
    },
  ];
}
