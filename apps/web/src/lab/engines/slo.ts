/**
 * Task 13 — Reliability Budget and SLO Explorer.
 *
 * Transparent error-budget math from explicit SLO targets, windows, and
 * denominators, plus failure-budget simulation: injected modeled downtime
 * consumes the budget, and every number states where it came from.
 */

import type { ArchitectureModel, SloTarget } from "../model";

export interface ErrorBudget {
  sloId: string;
  kind: SloTarget["kind"];
  target: number;
  windowDays: number;
  /** total requests covered by the window (the denominator) */
  windowRequests: number;
  /** allowed bad outcomes over the window (the budget) */
  allowedBad: number;
  /** for latency SLOs: no request-level distribution is modeled -> not applicable */
  applicable: boolean;
  note: string;
}

export function errorBudget(slo: SloTarget): ErrorBudget {
  const windowRequests = slo.windowDays * slo.expectedRequestsPerDay;
  if (slo.kind === "availability" || slo.kind === "completion") {
    const badFraction = Math.max(0, 1 - slo.target / 100);
    return {
      sloId: slo.id, kind: slo.kind, target: slo.target,
      windowDays: slo.windowDays, windowRequests,
      allowedBad: Math.round(windowRequests * badFraction),
      applicable: true,
      note: `allowed bad ${slo.kind === "availability" ? "requests (unavailable)" : "operations (incomplete)"} = (1 - ${slo.target}/100) * ${windowRequests}`,
    };
  }
  return {
    sloId: slo.id, kind: slo.kind, target: slo.target,
    windowDays: slo.windowDays, windowRequests,
    allowedBad: 0, applicable: false,
    note: "latency SLO budgets need a request latency distribution, which this model does not measure — only the availability/completion budget math applies; latency compliance is analyzed by the latency budget composer",
  };
}

export interface BudgetConsumption {
  sloId: string;
  injectedDowntimeMinutes: number;
  /** modeled requests lost during downtime (assumption: uniform traffic) */
  modeledLostRequests: number;
  allowedBad: number;
  consumedFraction: number;
  remaining: number;
  verdict: "within-budget" | "budget-exhausted" | "not-applicable";
  evidence: string[];
}

/**
 * Simulate how injected component downtime consumes the error budget of every
 * SLO that maps to that component. Missing measurements are surfaced, never
 * invented: an SLO without expected volume cannot produce a budget.
 */
export function consumeBudget(
  m: ArchitectureModel, componentId: string, downtimeMinutes: number,
): BudgetConsumption[] {
  const perMinute = (slo: SloTarget): number => slo.expectedRequestsPerDay / (24 * 60);
  return m.slos.map((slo) => {
    const budget = errorBudget(slo);
    const evidence = [`slo:${slo.id}`, `component:${componentId}`];
    if (!slo.componentIds.includes(componentId)) {
      return {
        sloId: slo.id, injectedDowntimeMinutes: downtimeMinutes,
        modeledLostRequests: 0, allowedBad: budget.allowedBad,
        consumedFraction: 0, remaining: budget.allowedBad,
        verdict: "not-applicable" as const,
        evidence: [...evidence, "component not mapped to this SLO"],
      };
    }
    if (!budget.applicable) {
      return {
        sloId: slo.id, injectedDowntimeMinutes: downtimeMinutes,
        modeledLostRequests: 0, allowedBad: 0,
        consumedFraction: 0, remaining: 0,
        verdict: "not-applicable" as const,
        evidence: [...evidence, budget.note],
      };
    }
    const modeledLostRequests = Math.floor(downtimeMinutes * perMinute(slo));
    const consumedFraction = budget.allowedBad === 0 ? 1 : modeledLostRequests / budget.allowedBad;
    return {
      sloId: slo.id,
      injectedDowntimeMinutes: downtimeMinutes,
      modeledLostRequests,
      allowedBad: budget.allowedBad,
      consumedFraction: Math.round(consumedFraction * 10000) / 10000,
      remaining: Math.max(0, budget.allowedBad - modeledLostRequests),
      verdict: modeledLostRequests >= budget.allowedBad ? "budget-exhausted" : "within-budget",
      evidence: [
        ...evidence,
        `${downtimeMinutes} min downtime x ${Math.round(perMinute(slo))} modeled req/min = ${modeledLostRequests} lost requests (uniform-traffic assumption)`,
        `budget: ${budget.note}`,
      ],
    };
  });
}
