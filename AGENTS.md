# AEGIS-Fraud X — Engineering Instructions for AI Agents

1. Read `PROJECT_CONTEXT`-level docs (`README.md`, `AUDIT_FINDINGS.md`, `EVIDENCE.md`,
   `LIMITATIONS.md`) before changing code.
2. Never fabricate results. A claim without a reproduction command is not a result.
3. Never remove or weaken tests to make a build pass.
4. Never select models, tune thresholds, or fit any preprocessing on the held-out TEST
   partition. Selection and fitting belong on TRAIN/VALIDATION; TEST is evaluated once.
5. Never change public interfaces (`packages/data/schemas.py`, API routes) without
   assessing all callers (API, frontend `apps/web/src/api.ts`, tests).
6. Add a regression test for every corrected bug; reference its issue ID from
   `AUDIT_FINDINGS.md`.
7. Every benchmark must be reproducible: seeded inputs, versioned artifacts under
   `benchmarks/runs/`, regenerable via `python scripts/run_benchmarks.py`.
8. Every metric displayed in the frontend must originate from the API or be clearly
   marked `degraded: true` as an offline fallback. The presentation layer must not
   invent data.
9. Never claim completion without evidence: run `pytest`, `mypy`, `ruff` and (for UI
   changes) `npm run build` before reporting done.
10. Preserve the product's core purpose: cost-aware, explainable, real-time payment
    fraud prevention (DN-FN-01). Do not import unrelated product assumptions.

## Release gates (mandatory, see RELEASE_GATES.md)

```bash
python -m pytest tests/release/ -v   # gate 1: leakage invariance; gate 2: calibrator provenance
```

Both gates were falsified against intentionally reintroduced leakage before
being trusted. They must never be skipped, weakened, or marked continue-on-error.

## Standard verification commands

```bash
python -m pytest tests/ -q -W ignore          # full suite
python -m pytest tests/release/ -v            # mandatory release gates
python -m mypy packages apps scripts --ignore-missing-imports
python -m ruff check .
python scripts/run_benchmarks.py              # regenerates benchmarks/runs + reports
python scripts/run_ulb_evaluation.py           # external ULB evaluation (needs datasets/external/creditcard.csv)
python scripts/run_policy_sensitivity.py      # policy sensitivity analysis
cd apps/web && npm run build                  # frontend type-check + build
```

E2E (score -> receipt -> verify): see `scripts/run_e2e.md`.
External datasets: provenance in `DATA_PROVENANCE.md`; never fabricate or
commit raw external data.

## TRACEN Vibe Coding Trail (frontend learning product)

The trail (`apps/web/src/trail/`) is a learning product embedded as a view
in the existing dashboard. Conventions for any change to it:

1. Content is DATA, not markup: all topic/glossary/quiz text lives in
   `src/trail/content.ts`. Never inline topic prose into components.
2. Simulation logic must stay PURE: behavior goes in
   `src/trail/sims/logic.ts` (deterministic, DOM-free, unit-tested);
   components in `Sims*.tsx` only render state and dispatch actions.
   A simulation without a logic test is not done.
3. Completion is earned, never granted: a topic completes only with BOTH
   simulation interaction and a correct knowledge-check answer
   (`progress.ts::completeTopic`). Do not weaken this gate.
4. Handbook text is rendered verbatim; production corrections go into
   visually separate "Production nuance"/warning callouts, and any new
   simplification-vs-reality issue must be recorded in
   `docs/content-accuracy-review.md`.
5. No new runtime dependencies for the trail; hash routing
   (`src/trail/router.ts`) instead of react-router; localStorage (behind
   the storage interface in `progress.ts`) instead of any backend.
6. Visual states must carry label + icon + color (see `ui.tsx::StateBadge`)
   — meaning must never be communicated by color alone.
7. Verification before claiming done:
   `npm run test && npm run build && npx oxlint src/trail` in `apps/web`,
   plus `npx playwright test e2e/trail.spec.ts` against
   `vite preview --port 4173` for user-flow changes.

## Architecture Intelligence Lab (campaign 03 learning product)

The lab (`apps/web/src/lab/`) extends the trail's conventions — any change to it
follows the same rules:

1. ALL architecture intelligence consumes the canonical model in
   `src/lab/model.ts` (see `docs/canonical-architecture-model.md`). Never add a
   second architecture representation in an engine, panel, or test fixture.
2. Engine logic is PURE and DETERMINISTIC: behavior lives in
   `src/lab/engines/*.ts` (DOM-free, dependency-free, unit-tested); panels in
   `src/lab/panels/` only render engine output and dispatch actions. An engine
   without a test is not done.
3. Every analysis result is a `Finding` with evidence references
   (`component:…`, `requirement:…`, `connection:…`, `rule:…`) — no claim
   without provenance, no aggregate "architecture score".
4. Simulation honesty is mandatory: results carry their assumptions and are
   labeled as modeled/illustrative; never present them as production
   benchmarks or cloud pricing. Unsupported analyses must return
   unknown/NOT-APPLICABLE, never a silent pass.
5. Seed architectures are data in `src/lab/samples.ts`; the flawed checkout
   fixture is intentionally imperfect — do not "fix" it without updating the
   benchmark ground truth in `engines/benchmark.ts` (both must change together).
6. Work-package statuses live in `docs/campaign-03-status.json` and are
   rendered by `python scripts/gen_campaign03_checklist.py`; never hand-edit
   the checklist. A work package is DONE only after verification is recorded.
7. Verification before claiming done on lab changes:
   `npm run test && npm run build && npx oxlint src/lab` in `apps/web`, plus
   `npx playwright test e2e/lab.spec.ts` against `vite preview --port 4173`.
