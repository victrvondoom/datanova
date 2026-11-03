# Campaign 04 — Architecture & Dependency Inventory (code-grounded)

Verified against the working tree at `d656038` (re-verified at campaign start:
vitest 253/253, oxlint 0, build OK, pytest 141/141, mypy/ruff clean).

## Runtime topology

- **Frontend app:** React 19 + Vite + TypeScript + Tailwind in `apps/web`.
  Single-page dashboard; state-based view switching in `src/App.tsx`; two
  embedded learning products: the Foundations trail (`src/trail/`) and the
  Architecture Intelligence Lab (`src/lab/`, Campaign 03).
- **Backend (unrelated to the lab):** FastAPI fraud engine in `apps/api`
  (score/receipt/verify endpoints; the two-phase e2e procedure uses it).
- **Python packages:** `packages/` (data schemas, models, calibration) —
  protected by repo AGENTS.md release gates (`tests/release/`).
- **Persistence:** browsers only for both learning products — localStorage
  behind injectable storage interfaces (`trail/progress.ts`, `lab/store.ts`).
  No backend is used or required by the lab.

## The lab (Campaign 03 foundation C04 builds on)

- `lab/model.ts` — canonical, versioned Architecture IR (components,
  connections with failure behavior/controls/access, requirements, assumptions,
  ADRs, operations, data entities, events, trust zones, SLOs, latency budgets,
  consistency contracts, policies) + validation + migration + classified diffs
  + the shared evidence-linked `Finding` type. Single source of truth for all
  engines (enforced by AGENTS.md lab rules).
- `lab/engines/` — 44 pure, deterministic, unit-tested modules (see
  `docs/canonical-architecture-model.md` and the per-model docs). Notable
  boundaries: causal propagation ↔ flight recorder ↔ orchestrator
  (recording/replay/fault plans); chaos experiments produce recordings;
  recovery verdicts fold recordings; counterfactuals compare models via
  genome diffs; benchmark scores engine outputs against ground truth.
- `lab/panels/` + `lab/LabApp.tsx` + `lab/router.ts` (hash routes `#/lab/...`)
  + `lab/ui.tsx` (badges follow the trail's label+icon+color rule).
- Tests: `lab/__tests__/m1..m9.test.ts` (192 cases), `e2e/lab.spec.ts` (6),
  `e2e/trail*.spec.ts`, `e2e/journey.spec.ts` (two-phase, per
  `scripts/run_e2e.md`).

## Campaign 04 integration points (where the new code plugs in)

| New module | Integrates with |
|---|---|
| `engines/evidence.ts` (T05) | consumes `Finding` + `Recording` + benchmark runs; produces `EvidenceArtifact`s with kind (observed/simulated/inferred/user-authored), provenance, and an exportable evidence pack; consumed by the Capstone panel and the FindingsList UI badges |
| `engines/intent-compiler.ts` (T06) | produces a canonical `ArchitectureModel` starter + unresolved-field list; the new **Intent tab** (`panels/Intent.tsx`) is the first step of the user journey and adopts the compiled model into the lab store |
| `engines/scenario.ts` (T16) | composes `traffic.ts` (workload) + `orchestrator.ts` (fault plan) + expectations; bound to an architecture fingerprint; run from the Experiments panel |
| `engines/recovery-timeline.ts` (T20) | folds recordings (flight recorder) into recovery state timelines; consumes `runbook.ts` strategies and `recovery.ts` verdicts |
| `engines/sensitivity.ts` (T25) | sweeps declared model assumptions (latency, processing time, traffic, capacity) through `counterfactual.ts`/`resource.ts`/`latency.ts` and reports which conclusions are fragile |
| `engines/tenantmatrix.ts` (T34) | generates an executable same-tenant/cross-tenant matrix from tenant-scoped entities (`tenant.ts` semantics) |
| `engines/benchmark2.ts` (T02/44) | versioned multidimensional benchmark; scores model validation, causal reasoning, counterfactual reproducibility, consistency, security, recovery, evidence provenance, and explanation grounding; CI regression gate in `__tests__/c04-benchmark.test.ts` |

## Constraints & risks (verified)

- **No new runtime dependencies** (repo rule). All new code is pure TS.
- **Engine purity**: no DOM/network/time in `engines/`; callers supply
  timestamps and seeds. Preserved everywhere.
- **Determinism**: seeds everywhere; visual tests freeze time
  (`page.clock`); Playwright `workers: 1` (see C03 fix commit `d656038`).
- **Migration risk**: the canonical model is additive-optional only;
  `MODEL_VERSION` rejection is loud. C04 adds no schema-breaking change.
- **Benchmark honesty**: all scenario fixtures are synthetic and labeled;
  reports carry limitations and run metadata; no external validation claimed.

## Phased plan (as executed)

1. Phase 0: baseline re-verification, docs, evidence infra, determinism audit.
2. Benchmark v2 + regression gates.
3. New engines (intent compiler, scenario, recovery timeline, sensitivity,
   tenant matrix).
4. UI integration (Intent tab, evidence badges, scenario runner, evidence
   export) + a11y coverage.
5. Full verification, ledger finalization, release report.
