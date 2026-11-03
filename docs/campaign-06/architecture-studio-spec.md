# Campaign 06 — Architecture Studio Specification (as implemented)

## Panes

| Pane | Content | Behavior |
|---|---|---|
| Left navigator | search, type filter, zone-grouped component list with per-mode badges | click selects + focuses in 3D; collapse button; panel prefs persist |
| Central canvas | the WebGL 3D scene (three.js) or the 2D accessible map (toggle) | toolbar above; status strip + minimap overlay; diagnostics (draw calls, triangles) |
| Right inspector | Overview/Properties/Dependencies/Data/Trust/Evidence sections per selection | name + config editing with canonical validation; delete with confirm; locate |
| Bottom dock | Events / Scenario / Findings / Legend tabs | collapsible; results link to the map modes |

## Toolbar (all controls are real)

Map-mode select · focus-selection · fit-to-view · isometric · top-down ·
Connect (source→target picker) · Undo/Redo (disabled when empty) · Run
scenario (real scenario engine) · Snapshot / Compare (semantic diff) ·
3D/2D toggle.

## Canvas toolbar semantics

Every disabled control carries an honest label (e.g. Undo disabled until an
edit exists). No dead buttons anywhere in the studio (e2e-enforced).

## Coordinate semantics (deterministic layout)

- **X**: request/data-flow progression (flow depth 0 leftmost).
- **Z**: trust-zone lanes (zone order, lanes 3 cells apart).
- **Y**: vertical stacking within a (depth, zone) cell, centered.
- Layout metadata is separate from architecture semantics: moving a node
  never changes the canonical model (user layout overrides are an overlay).

## Selection model

- Canvas raycast click / navigator click / 2D map click / minimap click all
  set the same selection state → navigator, inspector, and layer modes
  (dependency) react to it.
- Multi-focus: double-click focuses; shift-click selects + focuses.
- The 2D map supports keyboard selection (Tab + Enter) — the nonvisual
  alternative required for spatial information.

## Rendering diagnostics

The status strip shows WebGL availability, draw calls, and triangle counts
from `renderer.info` (real values, not decoration). If WebGL is unavailable
the strip says so and the 2D mode is the honest fallback.

## Editing workflow

Add (typed palette dialog → canonical validation → navigator + scene
update) → Connect (picker, validated source/target, no duplicates) →
Delete (confirm; cascade removes dangling connections) → Undo/Redo
(snapshot history, max 50) — every edit re-validates the model and bumps
the version on save.
