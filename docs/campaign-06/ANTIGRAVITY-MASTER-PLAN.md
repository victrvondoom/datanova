# DataNova Atlas — Antigravity Master Plan

## 1. Executive Directive & High-Priority Outcomes
Transform the Datanova codebase into a genuinely functional, premium, interactive architecture engineering platform:
1. **Application Shell & Nested Navigation:** Refined ergonomics, command palette (Ctrl+K), breadcrumbs, collapsible panels, and zero dead links.
2. **Interactive 3D Architecture Studio:** WebGL scene powered by Three.js with semantic geometry, dynamic lighting, OrbitControls, camera presets, raycast selection, and interactive pointer dragging.
3. **Canonical Graph Integration:** Single source of truth via `ArchitectureModel` and `toVisGraph`, preserving layout overlays without mutating topology.
4. **Functional Architecture Editor:** Add, connect, edit, rename, duplicate, delete, group/ungroup components and connections; edge property editing (criticality, protocol, failure mode); persistent undo/redo.
5. **Synchronized Analytical Map Layers:** 8 distinct modes (Topology, Dependency, Traffic, Trust, Data Lineage, Failure, Recovery, Evidence) powered by genuine engine analysis.
6. **Scenario & Simulation Workspace:** Workload parameter tuning, fault injection, flight recording, peak metrics, and simulation time scrubbing.
7. **Architecture Comparison & Decision Workflows:** Snapshot diffing, version bumping, and Architecture Decision Records (ADRs).
8. **Evidence Provenance & Review Visualization:** Findings mapped to components with source citations and policy-derived review statuses.
9. **Independent Validation Workspace:** Real assessment records, honest validation policies, and tamper-resistant attestation tracking.
10. **Two-User Evidence Exchange:** Export/import of DEP packages, annotation, reviewer response, and reconciliation.
11. **Performance & Stress Testing:** Benchmarked against Small (25/50), Medium (100/300), Large (250/750), and Stress (500/1500) profiles.
12. **Accessibility & Multi-Viewport Responsiveness:** 1440x900 desktop, 1280x800, 1024x768 compact, and 390x844 mobile fallback; high-contrast 2D SVG canvas.

---

## 2. Milestone Execution Roadmap

| Milestone | Scope | Primary Systems | Verification |
|---|---|---|---|
| **M0** | Baseline & Environment Audit | Git, Python .venv, Vitest, Playwright, Vite Preview | Test suites run, preview server active |
| **M1** | Product Interaction Contract | `graph.ts`, `layout.ts`, `model.ts`, `state.ts` | Unit tests for graph conversion & layout isolation |
| **M2** | Application Shell Refinement | `AtlasApp.tsx`, `ui.tsx`, `CommandPalette.tsx`, `router.ts` | Playwright navigation & keyboard tests |
| **M3** | Interactive 3D Studio Upgrade | `scene.ts`, `Studio.tsx` (pointer drag, edge selection, presets) | Visual capture, pointer event tests |
| **M4** | Synchronized Analytical Maps | `layers.ts`, `Studio.tsx`, map legends, filters, layer context | Layer computation tests across all 8 modes |
| **M5** | Architecture Editor Enhancement | Component/edge property editing, grouping, undo/redo | Model mutation, validation & round-trip tests |
| **M6** | Simulation & Scenario Engine Integration | `scenario.ts`, `blastradius.ts`, interval scrubber, traffic flows | Scenario run tests, animated flow tests |
| **M7** | Validation & Evidence Exchange | `validation.ts`, `Exchange.tsx`, `ValidationRoom.tsx`, DEP round-trip | Two-user package exchange E2E test |
| **M8** | Performance Benchmarking & Stress Testing | Synthetic graph generator, frame rate & memory profiler | Performance test matrix (Small to Stress) |
| **M9** | Visual QA & Independent Verification | Playwright screenshots, regression runs, final audit | Full test suite green, final report generated |

