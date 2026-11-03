# Campaign 06 — Product Specification (as implemented)

## Information architecture

Top-level product: **Datanova Atlas**, mounted at `#/atlas/...` (a full-bleed
view in the app shell, sibling to the fraud dashboard, the trail, and the
lab). Sections (left rail, all real routes):

| Route | View | Purpose |
|---|---|---|
| `#/atlas/mission` | Mission Control | data-backed project overview, health, validation status, navigation to underlying objects |
| `#/atlas/studio` | Architecture Studio | the flagship spatial workstation (see architecture-studio-spec.md) |
| `#/atlas/experiments` | Experiments | scenario configuration, execution, results, propagation, recovery |
| `#/atlas/validation` | Validation Room | review queue, policy, reviewer workbench, records, claim trace |
| `#/atlas/exchange` | Evidence Exchange | DEP v1 packages (reuses the verified C05 exchange panel inside the Atlas chrome) |
| `#/atlas/benchmarks` | Benchmarks | benchmark v2 + validity intelligence, case inspector, counterexamples |
| `#/atlas/sources` | Sources | source/claim/case registry explorer |
| `#/atlas/decisions` | Decisions | ADRs, trade-offs, findings needing decisions |
| `#/atlas/settings` | Settings | workspace lifecycle, panel preferences, local-data facts |
| `#/atlas/system` | Design System | live component showcase |

## Workspace header

Active-project selector · version counter · saved/unsaved state · derived
validation-status badge (from real records + policy) · search/command
palette (Ctrl+K) · breadcrumb (project → section).

## State model

- `AtlasState` (localStorage `datanova-atlas-v1`): projects (each with its
  serialized canonical model), active project, unsaved map, panel prefs.
- Session state (selection, last scenario) is deliberately NOT persisted —
  switching projects resets it (isolation tested).
- Review records: localStorage `datanova-atlas-reviews-v1` (real records
  only, per project).

## The primary journey (implemented + e2e-verified)

Mission Control → Studio (3D explore, inspector) → edit (add/connect/undo,
canonical model persists, version bumps) → map layers (dependency/trust/
lineage/failure/recovery/evidence) → run scenario (real engine; traffic +
recovery overlays) → snapshot → compare (semantic diff; layout changes
produce no false diffs) → Validation Room (real assessment recorded;
honest state derived) → Evidence Exchange (DEP export/import/review round
trip from Campaign 05, mounted in Atlas) → back to the Studio.
