import { describe, it, expect } from "vitest";
import { generateSyntheticModel, runSpatialBenchmarks, PROFILES } from "../../atlas/benchmark";
import { layoutIsSane, layeredLayout } from "../../atlas/layout";
import { toVisGraph } from "../../atlas/graph";

describe("Atlas Spatial Architecture Benchmarks & Stress Suite (Campaign 06)", () => {
  it("generates deterministic synthetic models matching target profiles", () => {
    for (const p of PROFILES) {
      const m1 = generateSyntheticModel(p.nodes, p.edges, 100);
      const m2 = generateSyntheticModel(p.nodes, p.edges, 100);
      expect(m1.components.length).toBe(p.nodes);
      expect(m1.connections.length).toBe(p.edges);
      expect(m1.components[0].id).toBe(m2.components[0].id);
      expect(m1.connections[0].id).toBe(m2.connections[0].id);
    }
  });

  it("verifies layout sanity on synthetic architectures up to 500 nodes / 1500 edges", () => {
    const stressModel = generateSyntheticModel(500, 1500, 42);
    const visGraph = toVisGraph(stressModel);
    const layout = layeredLayout(visGraph);
    const problems = layoutIsSane(visGraph, layout);
    expect(problems).toEqual([]);
    expect(Object.keys(layout.positions).length).toBe(500);
  });

  it("executes the full spatial benchmark matrix and measures execution times", () => {
    const results = runSpatialBenchmarks();
    expect(results.length).toBe(4);

    for (const res of results) {
      expect(res.layoutSane).toBe(true);
      expect(res.bounds.maxX).toBeGreaterThan(res.bounds.minX);
      expect(res.bounds.maxZ).toBeGreaterThan(res.bounds.minZ);
      expect(res.totalMs).toBeGreaterThan(0);
    }

    const [small, medium, large, stress] = results;
    // Sensible execution budgets for Node/V8 environment
    expect(small.totalMs).toBeLessThan(100);
    expect(medium.totalMs).toBeLessThan(250);
    expect(large.totalMs).toBeLessThan(600);
    expect(stress.totalMs).toBeLessThan(1500);
  });
});

