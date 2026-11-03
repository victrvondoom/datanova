/**
 * Campaign 04, Tasks 02 + 44 — multidimensional benchmark v2 regression gate.
 *
 * Runs the full v2 benchmark and enforces that every stable scenario passes:
 * this is the CI gate that must fail whenever an engine regresses against the
 * corpus. The gate asserts FAIL counts, never hides them.
 */

import { describe, it, expect } from "vitest";
import { runBenchmarkV2, renderBenchmarkV2Report, corpusFingerprints } from "../engines/benchmark2";

describe("T02/T44 multidimensional benchmark v2", () => {
  const run = runBenchmarkV2("campaign-04-regression-gate");

  it("scores eight dimensions with versioned, deterministic metadata", () => {
    expect(run.schemaVersion).toBe(2);
    expect(run.deterministic).toBe(true);
    expect(run.dimensions.length).toBe(8);
    expect(run.dimensions.map((d) => d.key)).toEqual([
      "model-validation", "causal-reasoning", "counterfactual", "consistency",
      "security", "recovery", "provenance", "critic",
    ]);
    expect(run.summary.totalScenarios).toBe(run.dimensions.reduce((s, d) => s + d.scenarios.length, 0));
    expect(run.limitations.length).toBeGreaterThanOrEqual(4);
    expect(run.reproduction.command).toContain("c04-benchmark.test.ts");
  });

  it("REGRESSION GATE: every scenario passes (no engine regressed against the corpus)", () => {
    const failures = run.dimensions.flatMap((d) =>
      d.scenarios.filter((s) => s.outcome === "fail").map((s) => `${d.key}/${s.id}: ${s.detail}`));
    expect(failures).toEqual([]);
    expect(run.summary.failed).toBe(0);
    expect(run.summary.passed).toBe(run.summary.totalScenarios);
  });

  it("the run is reproducible: identical inputs give identical reports", () => {
    const again = runBenchmarkV2("campaign-04-regression-gate");
    expect(JSON.stringify(again)).toBe(JSON.stringify(run));
    expect(renderBenchmarkV2Report(run)).toBe(renderBenchmarkV2Report(again));
  });

  it("the report renders per-dimension results with limitations and reproduction metadata", () => {
    const report = renderBenchmarkV2Report(run);
    expect(report).toContain("# Architecture Intelligence Benchmark v2");
    expect(report).toContain("| model-validation |");
    expect(report).toContain("## Limitations");
    expect(report).toContain("not real-world architecture quality");
    expect(report).toContain("## Reproduction");
    // corpus fingerprints are stable regression metadata
    const fp = corpusFingerprints();
    expect(fp.length).toBe(2);
    expect(fp.every((x) => x.fingerprint.startsWith("gn-"))).toBe(true);
  });
});
