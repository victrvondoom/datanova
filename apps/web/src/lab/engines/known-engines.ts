/**
 * Campaign 05 — inventory of engine module paths that actually exist in
 * `src/lab/engines/`. Used by the grounded-case evaluator so a case cannot
 * claim it is "modeled by" an engine that does not exist.
 */

export const KNOWN_ENGINE_PATHS: ReadonlySet<string> = new Set([
  "engines/adversarial.ts", "engines/authz.ts", "engines/benchmark.ts", "engines/benchmark2.ts",
  "engines/blastradius.ts", "engines/capstone.ts", "engines/causal.ts", "engines/challenges.ts",
  "engines/chaos.ts", "engines/consistency.ts", "engines/constraints.ts", "engines/counterexamples.ts",
  "engines/counterfactual.ts", "engines/critic.ts", "engines/debate.ts", "engines/drift.ts",
  "engines/eventschema.ts", "engines/evidence.ts", "engines/explain.ts", "engines/extension.ts",
  "engines/flightrecorder.ts", "engines/genome.ts", "engines/graph.ts", "engines/idempotency.ts",
  "engines/intent-compiler.ts", "engines/intent.ts", "engines/latency.ts", "engines/ledger.ts",
  "engines/lineage.ts", "engines/mission.ts", "engines/modes.ts", "engines/mutations.ts",
  "engines/nonvisual.ts", "engines/observability.ts", "engines/orchestrator.ts", "engines/ownership.ts",
  "engines/package.ts", "engines/recovery-timeline.ts", "engines/recovery.ts", "engines/runbook.ts",
  "engines/saga.ts", "engines/scenario.ts", "engines/scorecard.ts", "engines/sensitivity.ts",
  "engines/slo.ts", "engines/tenant.ts", "engines/tenantmatrix.ts", "engines/testsynth.ts",
  "engines/trace.ts", "engines/tradeoff.ts", "engines/traffic.ts", "engines/trust.ts",
  "engines/sources.ts", "engines/claims.ts", "engines/cases.ts", "engines/grounding.ts",
  "engines/benchvalid.ts", "engines/review.ts", "engines/dep.ts", "engines/exchange.ts",
]);
