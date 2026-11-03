# Campaign 06 — Known Limitations

## Not implemented (honest)

- **Camera persistence per workspace (12.4):** camera presets are persisted;
  free-orbit camera position is not restored across sessions.
- **Free-form node dragging in 3D (11.3 partial):** user layout moves exist
  in the engine (`applyUserLayout`, tested) but the canvas does not yet
  wire pointer-drag node repositioning; the 2D map and minimap provide
  focus navigation instead.
- **Traffic time controls (18.3):** traffic overlays reflect the scenario
  result (peak-state), not a scrubber over simulation intervals.
- **Edge editing in the inspector (15 partial):** edges are inspectable and
  deletable; edge property editing (criticality/kind) is not yet exposed.
- **Grouping in the navigator (24.3 partial):** zone grouping exists;
  arbitrary user groups do not.
- **Two-context reviewer-package e2e inside Atlas (29.5):** the full
  two-user DEP round trip is e2e-verified in Campaign 05's
  `lab-c05.spec.ts`; the Atlas Exchange view reuses that same engine/panel,
  but the journey was not re-staged with two contexts in Atlas this run.
- **Performance at 100 nodes / 300 edges (35.4):** measured only on the
  reference architecture (~30 draw calls / ~12k triangles); the
  large-graph benchmark is not yet recorded. No optimization was claimed
  without measurement.
- **Studio visual baselines (§7):** screenshots were captured and
  inspected, but formal pixel-diff baselines were not committed (the
  deterministic layout makes them feasible; deferred).

## Environment-dependent

- WebGL in CI runs via SwiftShader (software GL) — real rendering, slower
  than GPU. On machines without WebGL the honest 2D fallback is the path.
- Review records are browser-local (per campaign scope); no server, no
  verified identity infrastructure — identity trust is declared, and the
  validation states reflect that honestly.

## Carried from earlier campaigns (unchanged)

- NVDA/manual screen-reader execution remains `PROTOCOL READY — NOT
  EXECUTED` (Campaign 05 report); Atlas's a11y posture is the same
  conventions (labels, live regions, keyboard, nonvisual alternatives).
- Benchmark = synthetic self-consistency + grounded trail; zero human
  benchmark reviews; nothing externally validated.
- Simulations remain deterministic educational models — never production
  telemetry.
