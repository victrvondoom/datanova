# DataNova Atlas — Agent Handoffs & Boundary Contracts

## 1. Agent Ownership & File Boundaries

| Agent | Role | Scope & Allowed Paths | Out-of-Scope | Deliverable |
|---|---|---|---|---|
| **Agent 1: repo-architect** | Repository Archaeologist | `packages/`, `apps/web/src/lab/model.ts`, `docs/campaign-06/` | Destructive refactors, UI styling | `docs/campaign-06/agent-reports/repository-audit.md` |
| **Agent 2: atlas-ux-director** | Product UX Director | `apps/web/src/atlas/ui.tsx`, `apps/web/src/atlas/router.ts`, CSS | Modifying analytical engines | `docs/campaign-06/agent-reports/product-ux-audit.md` |
| **Agent 3: spatial-renderer-engineer** | Spatial Renderer Engineer | `apps/web/src/atlas/scene.ts`, `layout.ts` | Data schema modification | `docs/campaign-06/agent-reports/spatial-renderer-report.md` |
| **Agent 4: architecture-map-engineer** | Architecture Graph Engineer | `apps/web/src/atlas/graph.ts`, `layers.ts` | Rendering shaders, UI layout | `docs/campaign-06/agent-reports/mapping-engine-report.md` |
| **Agent 5: workflow-validation-engineer** | Workflow & Validation | `apps/web/src/atlas/Studio.tsx`, `views/`, `validation.ts` | Low-level Three.js render loop | `docs/campaign-06/agent-reports/workflow-validation-report.md` |
| **Agent 6: adversarial-qa** | Adversarial QA Engineer | `apps/web/e2e/`, `apps/web/src/lab/__tests__/` | Feature implementation | `docs/campaign-06/agent-reports/adversarial-qa-report.md` |

---

## 2. Completed Handoff Records

### Handoff 1: Agent 1 (Archaeologist) → Agent 2 (UX) & Agent 3 (Renderer)
- **Delivered:** Full repository audit mapping Campaign 03–05 capabilities, schemas (`ArchitectureModel`), and engine paths.
- **Contract:** Preservation of existing engines (`critic`, `scenario`, `blastradius`, `recovery-timeline`, `flightrecorder`, `benchmark2`, `benchvalid`, `dep`).

### Handoff 2: Agent 2 (UX Director) → Agent 3 & Agent 5
- **Delivered:** Design direction, command palette shortcut patterns, nested navigation routes (`#/atlas/*`), and spatial studio interaction specification.
- **Contract:** Technical dark palette (`#020617`, `#0b1120`), accessible SVG fallback for screen readers and keyboard navigation, dual-panel layout.

### Handoff 3: Agent 3 (Spatial Renderer) → Agent 4 (Graph Engineer)
- **Delivered:** Three.js scene engine in `apps/web/src/atlas/scene.ts` supporting direct pointer dragging on ground plane, raycast picking, and dynamic edge cylinder matrix updates.
- **Contract:** Separation of coordinate state (`UserLayout`) from semantic architecture data (`ArchitectureModel`).

### Handoff 4: Agent 4 (Graph Engineer) → Agent 5 (Workflow Engineer)
- **Delivered:** Canonical graph adapter (`toVisGraph`) in `graph.ts` and 8 synchronized analytical layers in `layers.ts` (Topology, Dependency, Traffic, Trust, Data Lineage, Failure, Recovery, Evidence).
- **Contract:** Model consumed directly from `src/lab/model.ts` without intermediary duplication.

### Handoff 5: Agent 5 (Workflow Engineer) → Agent 6 (Adversarial QA)
- **Delivered:** Interactive Studio editing (connection properties, trust zone assignment, domain group tagging), temporal simulation scrubber dock, and DEP v1 evidence package adoption.
- **Contract:** Pure evaluation of validation states via `evaluateValidation` without phantom or mocked sign-offs.

### Handoff 6: Agent 6 (Adversarial QA) → Orchestrator
- **Delivered:** Exhaustive test execution: 14 Playwright E2E tests, 19 visual screen captures, 457 Vitest unit tests, synthetic performance benchmarks (Small, Medium, Large, Stress), and 12 Python release gate verifications.
- **Contract:** 100% test pass rate, 0 lint errors, 0 compilation defects.
