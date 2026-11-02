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

## TRACEN Architecture Studio (Campaign 02 — `#/studio`)

The Studio (`apps/web/src/studio/`) is a sibling area of the trail inside the same dashboard. It applies Foundations
Topics 01–20 to design, simulate, review and improve real architectures. Read `docs/architecture-studio-design.md` first.
Do **not** invent Topics 21–40; every "which topic teaches this" link must point at one of the existing 20.

1. **Logic is pure and tested.** Behaviour lives in DOM-free modules (`model`, `graph`, `validation`, `requirements`,
   `capacity`, `failures`, `compare`, `review`, `adr`, `challenge`, `store`, `exporters`, `blueprints`). `*View.tsx`,
   `Canvas.tsx`, `Inspector.tsx` only render state and dispatch operations. A feature without a logic test is not done.
2. **Scenarios are data** (`scenarios.ts`): requirements carry structural `needs`; never hard-code a single correct
   architecture. Worked examples (`blueprints.ts`) are one valid design among many, never shown inside the guided challenge.
3. **Never hard-code a simulation outcome.** Failure results must follow from the learner's configuration; a missing
   mechanism must show the failure unprotected; recovery only where a mechanism exists; "not applicable" must never
   read as "handled".
4. **Completion is earned.** Challenge gates (`challenge.ts`) are computed from real work; do not weaken them, add a score,
   or reward component count. Structural evidence is not proof, and learner marks never replace evidence.
5. **Honest numbers.** Capacity figures are labelled assumptions (not load tests); cost figures are relative units, not
   prices; payment behaviour is always simulated. Any new formula goes into `capacity.ts::FORMULAS`.
6. **Imports are untrusted.** Every import path goes through `store.ts::parseWorkspaceImport` /
   `validateArchitectureShape`; never trust challenge progress or review results from a file. Exports pass through redaction.
7. **No new runtime dependencies**; hash routes (`trail/router.ts::STUDIO_TABS`); `localStorage` only behind `StudioStorage`.
8. **State = label + icon + colour**, never colour alone; every control has an accessible name; honour
   `prefers-reduced-motion`; no page-level horizontal overflow at 375px.
9. **Docs must match code.** `src/studio/__tests__/docs.test.ts` fails when a rule, failure, formula, scenario, component or
   challenge step is not documented in `docs/`.
10. Add a regression test for every corrected Studio bug.

Verification before claiming done (in `apps/web`):

```bash
npm run test && npm run build && npx oxlint
PW_CHROMIUM_PATH=<chromium> npx playwright test e2e/studio.spec.ts   # against `vite preview --port 4173`
STUDIO_EVIDENCE=1 npx playwright test e2e/studio-evidence.spec.ts    # regenerates docs/studio-evidence/*.png
```

### Campaign checkpoints

- **Campaign 01 (trail)** — verified complete at the start of Campaign 02 (61 unit tests, build, lint clean). Tag
  `checkpoint/pre-campaign-02` marks the state before Campaign 02.
- **Campaign 02 (Studio)** — all ten phases implemented; see `docs/architecture-studio-plan.md` for the milestone log, the
  scenario matrix and the **known limitations / remaining work** table. Resume from that table, not from scratch.
