# DataNova Atlas — Operational Governance and Engineering Rules

These rules govern all autonomous engineering, refactoring, and verification within the DataNova Atlas spatial architecture platform.

## 1. Engine Preservation & Single Source of Truth
- **Preserve existing engines:** Never replace or bypass verified analytical engines (`critic`, `scenario`, `blastradius`, `recovery-timeline`, `flightrecorder`, `grounding`, `benchmark`, `exchange`).
- **Canonical Graph as Sovereign Truth:** All visualizations (3D WebGL, 2D accessible fallback, minimap, dependency tables) MUST strictly consume the canonical architecture Intermediate Representation (`ArchitectureModel` in `src/lab/model.ts` converted via `src/atlas/graph.ts`).
- **Layout Separation:** Spatial coordinates and visual layouts (`src/atlas/layout.ts`) must remain separate overlays and must never mutate canonical topology or architectural semantics.

## 2. Interaction & Telemetry Honesty
- **No Fake Interactions:** Every button, menu item, tab, and toolbar control must connect to real deterministic behavior or an honest disabled state with explanatory tooltips.
- **No Fake Telemetry or Invented Metrics:** Workloads, traffic rates, failure propagations, and recovery timings must originate from actual deterministic scenario simulations (`runScenario`, `flightrecorder`). If telemetry is unavailable or unmodeled, display `NOT_AVAILABLE` or honest degraded markers.
- **No Invented Validation:** Validation states (`independently-validated`, `partially-reviewed`, `findings-disputed`, `not-reviewed`) must derive strictly from qualifying human assessment records (`ReviewRecord`) evaluated against configured validation policies (`evaluateValidation`). Never fabricate reviewers, attestations, or signatures.

## 3. Map Mode Integrity
- **Synchronized Analytical Maps:** All 8 map modes (`topology`, `dependency`, `traffic`, `trust`, `lineage`, `failure`, `recovery`, `evidence`) must derive from the identical canonical model and scenario context via `computeLayer` (`src/atlas/layers.ts`).
- **Consistent Selection State:** Selecting a component or connection in any view, 3D scene, or 2D map must seamlessly synchronize the inspector, object navigator, and cross-layer highlights without state leakage across projects.

## 4. Verification and Browser Quality Gates
- **Mandatory Browser Execution:** Visual quality assurance cannot be certified solely by source inspection or compiler checks. Tests must execute via Playwright against live builds (`vite preview`).
- **Zero Test Weakening:** Never remove, bypass, or weaken tests to achieve green runs. Every bug fix requires regression coverage.
- **Release Gate Invariance:** Mandatory release gates (`tests/release/`) must pass with strict zero-leakage protocols.

## 5. Persistent Checkpointing
- All milestones, architectural decisions, and agent handoffs must be committed and documented in `docs/campaign-06/` (`ANTIGRAVITY-MASTER-PLAN.md`, `ANTIGRAVITY-STATE.md`, `ANTIGRAVITY-AGENT-HANDOFFS.md`, `ANTIGRAVITY-VERIFICATION.md`).

