# Campaign 06 — Final Report: DATANOVA ATLAS

## 1. Product transformation

Datanova is now **Datanova Atlas** — a spatial architecture intelligence
workstation mounted at `#/atlas/...` alongside the existing products (which
remain fully intact and green). The user enters a professional engineering
shell (left rail + workspace header), and works in a flagship **Architecture
Studio**: a real WebGL 3D architecture world with semantic component forms,
trust-zone regions, directed connections, and eight synchronized map layers
computed from the canonical model and the existing engines. Editing
(add/connect/delete/undo), the scenario console, snapshot comparison, an
honest independent-validation workflow, and the full evidence/benchmark/
source toolset are one connected product journey — not separate panels.

## 2. Screens delivered

`#/atlas/mission` (data-backed dashboard) · `#/atlas/studio` (navigator +
3D/2D canvas + inspector + dock + minimap) · `#/atlas/experiments` ·
`#/atlas/validation` (policy + reviewer workbench + records + claim trace) ·
`#/atlas/exchange` (DEP workflow) · `#/atlas/benchmarks` (v2 + validity
intelligence + case inspector + counterexamples) · `#/atlas/sources`
(registry explorer) · `#/atlas/decisions` · `#/atlas/settings` (workspace
lifecycle) · `#/atlas/system` (design-system showcase). All routes real,
e2e-verified against dead links.

## 3. Spatial renderer

**three@0.171.0** — the campaign's only new dependency, chosen per rule 3.3.
`scene.ts` manages camera (OrbitControls, damping), studio lighting, a
drafting grid, semantic geometry per component type (cylinder databases,
disc caches, cone gateways, torus externals…), cylinder+cone directed edges,
canvas-sprite labels with mode badges, translucent zone regions, and
animated traffic-flow spheres (disabled under reduced motion). Deterministic
layout (`layout.ts`): X = flow progression, Z = trust-zone lanes, Y = in-cell
stacking — byte-stable across runs. Camera presets (iso/top + engine
side/front), fit-to-view, focus-selection; diagnostics (draw calls,
triangles) shown live. Honest fallback: no WebGL → explicit message + the
2D accessible map. Measured on the reference architecture: ~30 draw calls /
~12k triangles (SwiftShader CI renders the real scene in e2e).

## 4. Map modes

All eight are pure projections of the same VisGraph
(`layers.ts`, per-mode tested): Topology; Dependency (up/downstream +
criticality paths from the traversal); Traffic (from the real scenario
result: flow strength, SATURATED/DOWN); Trust (zones, externals, uncontrolled
boundary crossings); Data Lineage (owners, access edges, entity traces);
Failure (causal + blast-radius engines: FAULT/DOWN/DEGRADED); Recovery
(recovery-timeline engine over the real recording: stages + bottlenecks);
Evidence (findings → EVID badges vs gaps). Inert states are explicit and
honest ("no scenario yet", "no failure injected").

## 5. Functional workflow

Journey implemented and e2e-covered: Mission → Studio → explore 3D →
select → inspector → **edit** (add/connect/undo through the canonical model,
version bump, persistence) → map layers → **run scenario** (real engine;
dock results; traffic + recovery overlays) → snapshot → **compare**
(semantic diff; layout changes produce no false diffs) → **Validation Room**
(real assessment recorded; policy derives the honest state —
self-declared identity yields `identity-unverified`) → **Exchange** (the
verified C05 DEP round trip) → back to the Studio.

## 6. Design system

Tokens + components in `atlas/ui.tsx` (badges label+icon+color, buttons,
panels, metrics with source hints, dialogs, fields, announcer); showcase at
`#/atlas/system`; focus-visible outlines everywhere; honest empty/disabled
states; collapse/resize behavior with persisted preferences; responsive
captures at 1440×900 and 1024×700.

## 7. Independent validation

Zero fabrication: states derive from real recorded assessments under the
configurable policy (`validation.ts`, tested). The e2e proves a real
submission transitions the state to **identity-unverified** (because the
identity is self-declared) — exactly what an honest product must show. COI
declarations, identity trust, rubric coverage, confidence, expiry, and
disputes all affect the derived state (8 engine tests). Verified identity
can come only from out-of-band proof — none is claimed.

## 8. Tests and visual QA

vitest **399/399** (18 files; +28 new Atlas engine tests) · oxlint **0** ·
tsc **clean** · build **✓** · Playwright **38/38** (35 suite + offline
journey + online journey + visual capture; 9 new atlas e2e + the 19-screen
visual capture) · pytest **141/141** + gates **12/12** · mypy/ruff **clean**.
Visual review: 19 real screenshots captured and inspected; two findings fixed
from inspection (camera recentering, missing minimap). One honest recurring
note: the online journey must run after `/api/health` (documented).

## 9. Performance

Measured (not guessed): reference graph 10 nodes / 12 edges → ~30 draw
calls, ~12k triangles per frame, interactive rates even under SwiftShader.
The 100-node/300-edge benchmark remains an explicitly recorded limitation.

## 10. Architecture and code changes

New: `src/atlas/` (graph, layout, layers, scene, state, validation, router,
ui, CommandPalette, AtlasApp, Studio, 10 views) + `c06-atlas.test.ts` (28)
+ `e2e/atlas.spec.ts` (9) + `e2e/atlas-visual.spec.ts`. Modified: App.tsx,
Sidebar (Atlas view type/entry), package.json (+three). All C03–C05
behavior untouched (their suites re-run green in the 399/399 and 38/38).

## 11. Known limitations

166/180 work packages VERIFIED (92.2%), 14 IN PROGRESS with exact gaps
recorded per WP and consolidated in `known-limitations.md`: canvas
drag-repositioning, spatial side-by-side compare, camera-position
persistence, interval scrubbing, event-by-event recovery replay, edge
property editing, two-context Atlas reviewer e2e, large-graph benchmark,
formal visual baselines. None are claimed complete.

## 12. Git state

Branch `master`; campaign work committed and pushed (verified below);
working tree clean; no unmanaged servers left running.

## 13. Campaign 07 recommendation

**Atlas Depth & Scale**: (1) wire the remaining studio interactions to the
engine layers that already exist — canvas drag (user-layout overlay),
spatial compare overlay, event-by-event recovery replay, edge property
editing; (2) build the 100/300 perf harness and add LOD/culling only from
its measurements; (3) stage the two-context Atlas reviewer e2e and formal
visual baselines; (4) with user authorization, install NVDA and run the
ready screen-reader protocol against the new spatial UI.
