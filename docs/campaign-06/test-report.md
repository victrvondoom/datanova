# Campaign 06 — Test Report

All results executed on 2026-11-03 against the committed working tree.

## Frontend

| Check | Command | Result |
|---|---|---|
| Unit tests | `cd apps/web && npm test` | **399/399 passed** (18 files) — C03–C05 suites (371) + new `c06-atlas.test.ts` (28) |
| Lint | `npx oxlint src` | **0 warnings, 0 errors** |
| Types | `npx tsc -b --force` | **0 errors** |
| Build | `npm run build` | **✓ built** |

New unit coverage (`src/lab/__tests__/c06-atlas.test.ts`, 28 cases): graph
adapter (id preservation, round-trip, degrees/isolation, flow depths),
deterministic layout (byte-stable, sane on dense/disconnected/cyclic,
flow-progression on X, user-move overlay), all 8 map layers (per-mode
behavior + inert states + real engine inputs: scenario, blast radius,
recovery timeline, critic findings), validation policy engine (8
invariants incl. never-fabrication and identity-trust exclusion), and
workspace lifecycle (create/select/rename/duplicate/archive + session
isolation + validate-before-save).

## Playwright (preview build; `workers: 1`)

| Suite | Result |
|---|---|
| `e2e/lab.spec.ts` + `e2e/lab-a11y.spec.ts` + `e2e/lab-c05.spec.ts` + `e2e/trail.spec.ts` + `e2e/trail-a11y.spec.ts` + **`e2e/atlas.spec.ts` (new, 9)** | **35 passed** |
| `e2e/journey.spec.ts` offline phase | **1 passed** |
| **`e2e/atlas-visual.spec.ts` (new)** — 19-screen capture | **1 passed** |
| `e2e/journey.spec.ts` online phase (API on :8002, health-checked first) | **1 passed** |

**Total Playwright: 38/38.** The atlas suite covers: full-shell navigation
(no dead links), the real WebGL scene + diagnostics + all map modes,
navigator→inspector selection sync, the 2D accessible map (keyboard
selection), add/connect/undo editing through the canonical model, the
scenario run with traffic overlay, the Ctrl+K command palette, the honest
validation-state transition after a real assessment, and data-backed
benchmark/source dashboards.

Honest note (recurring): the online journey fails if run before the API
finishes loading — the documented procedure requires waiting for
`/api/health`; with the health check the journey passes.

## Python (fraud engine contract)

| Check | Result |
|---|---|
| `python -m pytest tests/ -W ignore` | **141 passed** |
| `python -m pytest tests/release/` | **12 passed** (mandatory gates) |
| `python -m mypy packages apps scripts --ignore-missing-imports` | **clean** |
| `python -m ruff check .` | **clean** |

## Visual review evidence

`docs/campaign-06/evidence/screens/` — 19 screenshots at 1440×900 (+1 at
1024×700), inspected programmatically for content (no blank regions) and by
coarse render inspection; the 3D scene, minimap, panels, and dashboards all
render. Defects found during review and fixed: camera framing (fit-to-view
recentered), missing minimap (added).

## Performance measurement (Task 35.4 — honest, small-scale)

Rendered scene diagnostics on DocFlow (10 nodes / 12 connections) via
`renderer.info`: **~30 draw calls, ~12k triangles per frame** at
1440×900, interactive frame rates in the e2e environment (SwiftShader). The
campaign's 100-node/300-edge target was not built into a stress harness
this run — recorded as a known limitation rather than an unmeasured claim.
