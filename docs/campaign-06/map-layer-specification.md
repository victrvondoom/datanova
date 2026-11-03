# Campaign 06 — Map Layer Specification (as implemented)

Engine: `src/atlas/layers.ts` (pure, tested in `c06-atlas.test.ts`).
All eight modes compute per-node/per-edge emphasis + badges + notes + a
legend from **the same canonical VisGraph** plus existing engine outputs.
The renderer (`scene.ts`) only interprets these results.

| Mode | Data source | Highlights | Inert-state honesty |
|---|---|---|---|
| Topology | canonical graph | all-normal, zone regions, legend | — |
| Dependency | graph traversal (up/downstream, criticality) | upstream/downstream of the selection; critical (≥4) edges; focus paths | dims unrelated nodes |
| Traffic | scenario engine result (runScenario) + blast radius | flow strength per edge; SATURATED/DOWN badges; impacted ops | "No scenario result — traffic map is inert until a scenario runs" |
| Trust | graph zones + per-connection controls | externals (EXT badge); cross-boundary edges; missing-controls flagged critical | notes always say "modeled analysis — not confirmed vulnerabilities" |
| Data Lineage | model data entities + connection access | owners (OWNS n badges), read/write access edges, entity traces | dims non-data nodes |
| Failure | causal engine findings + blast-radius engine | FAULT/DOWN/DEGRADED badges, propagation paths, impacted ops | "No failure injected" when dormant |
| Recovery | recovery-timeline engine (folds the real recording) | RECOVERED/stage badges, BOTTLENECK flags, dependency edges | "No recovery timeline" before a recorded run |
| Evidence | critic findings + evidence references | EVID n badges on referenced elements, dimmed gaps | honest zero-state |

## Synchronization guarantees (tested)

- Mode switching cannot corrupt the architecture (layers are read-only
  projections).
- Selection persists across compatible modes (dependency paths recompute
  for the new mode from the same selection).
- Scenario changes update traffic/failure/recovery overlays from real
  engine outputs — no stale results (reset clears the dock and overlays).
- Layout-only node moves never appear as architecture diffs (compare uses
  `diffModels`, not position comparison).

## Nonvisual equivalent

The 2D map (`<svg role="img">` with per-node aria labels and keyboard
selection), the navigator's per-mode badges, and the layer summaries in the
status strip deliver the same information without 3D interaction.
