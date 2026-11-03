# Campaign 03 — Architecture Intelligence Lab: Test Report

**Date:** executed in this session against the working tree at the final campaign commit.
**Scope:** `apps/web/src/lab/` (engines, model, UI), lab view mounting, campaign scripts/docs.

## Commands executed and results

| Command (cwd) | Result |
|---|---|
| `npm test` (apps/web) | **12 files, 253 tests passed** (61 pre-existing trail/dashboard + 192 new lab tests in `src/lab/__tests__/m1..m9.test.ts`) |
| `npx oxlint src/lab src/App.tsx src/components` (apps/web) | **0 warnings, 0 errors** |
| `npm run build` (apps/web, = `tsc -b && vite build`) | **built successfully** (~301 kB gzip; pre-existing chunk-size warning) |
| `npx playwright test e2e/lab.spec.ts` (vs `vite preview --port 4173`) | **6/6 passed** |
| `npx playwright test` (workers pinned to 1) | **15/15 pass under the documented two-phase procedure**: phase A (API stopped): lab 6 + trail 4 + a11y 3 + offline journey = **14/14**; phase B (API on :8002 per `scripts/run_e2e.md`): online score->receipt->verify journey = **1/1** |
| `python -m pytest tests/ -W ignore` | **141 passed** (includes the mandatory release gates: 12 release tests green) |
| `python -m mypy packages apps scripts --ignore-missing-imports` | **Success: no issues in 59 source files** |
| `python -m ruff check .` | **All checks passed** |

## Lab unit coverage (192 tests, one milestone suite per engine batch)

- **m1 (32):** canonical model validation (dangling refs, duplicates, sync→queue,
  self-connections, ADR lineage, versioning/migration, round-trip, aliasing),
  intent coverage analyzer + explanations, semantic/causal graph (closures,
  cycles, sync depth), ledger immutability/classification, constraint
  taxonomy/missing-context/conflicts.
- **m2 (25):** genome extraction/fingerprint stability/comparison; mutation
  preconditions, aliasing safety, regression guard; counterfactual attribution,
  uncontrolled-variable flagging, reproducibility; causal propagation (status,
  latency, queue growth, retry amplification, cycles, isolation); criticality
  factors, blast radius, boundary comparison.
- **m3 (22):** seeded queue sim (stable/overload/burst/determinism/worker
  scaling), latency aggregation/violations/retry worst case, SLO budgets and
  downtime consumption incl. exact window boundary, Little's-law bottleneck +
  scaling experiments, cost/risk/complexity/frontier/sensitivity.
- **m4 (22):** consistency contracts (TTL-cache violation, honest unknowns,
  stale timeline), ownership writers/violations/alternatives, event
  compatibility classes + consumer map + expand/contract path, idempotency
  lifecycle (concurrency, misuse, failure, expiry), saga validation/failure
  paths/execution incl. compensation failure → manual recovery.
- **m5 (19):** trust crossings/rules/documented exceptions, lineage exposure +
  retention gaps, authz decisions/enforcement gaps/empty-policy honesty,
  tenant requirement derivation + explicit injected violations, adversarial
  enabling paths + mitigated-not-flagged + purity.
- **m6 (16):** observability gaps (trace propagation, queue depth, retries,
  critical-edge logging, untraced ops), trace generation + broken-correlation
  diagnosis, recorder append-only/deterministic replay/integrity, drift
  classification + invalidation mapping, runbook generation/validation.
- **m7 (20):** chaos templates + verdicts (supported/contradicted/no-impact/
  invalid), test synthesis (derived properties, priorities, non-executable
  never pass), orchestrator (plan validation, legal transitions, multi-fault,
  abort, pause), recovery verdicts (all four, evidence-based), scorecard
  dimensions/uncertainty/no-aggregate.
- **m8 (19):** explanation grounding checks, challenge determinism/difficulty/
  recommendations/validation, critic rules + finding density + unjustified
  complexity, debate consistency + ADR recording, mission reveal/revision/
  evaluation.
- **m9 (17):** benchmark corpus metrics from executed runs, package
  export/import/reproduce + malformed rejection, extension validation/
  registration/instantiation/capabilities, mode consistency, capstone
  intelligence/improvement/evidence workflows + determinism.

## E2E user flow (e2e/lab.spec.ts, 6 tests, all passing)

Open lab → canvas + intent + grounded explanations → causality: inject
meta-db failure, causal chain + blast radius + genome → experiments: chaos
verdict SUPPORTED, flight recorder skip-to-end, package export/import/
reproduce → review: critic, scorecard, debate decision recorded as ADR,
mission evaluation → capstone: run lifecycle, evidence package, benchmark
report (precision 1 / recall 1 / unsupported-claim rate 0) → persistence
across reload + deep links + reset.

## Known gaps (honest)

1. The two `journey.spec.ts` tests are mutually exclusive by design (one needs
   the live API, the other needs it stopped) and are run as two phases per
   `scripts/run_e2e.md` — both phases pass (14/14 offline, 1/1 online). The
   offline test's locator was made strict (`exact: true`) because the
   mission-control status chip also renders a lowercase "backend offline".
2. The `trail-a11y` visual baselines are now deterministic: the token-bucket
   refill `setInterval` is frozen with Playwright's clock API (the burst is a
   synchronous state update, so the bucket level is exactly capacity-10 at
   screenshot time), and the suite runs with `workers: 1` because concurrent
   browser instances caused rasterization variance in the pixel diff.
   **Root cause found and fixed in Campaign 04:** the global "Backend
   offline" banner arrives asynchronously (~1.5–4.5 s) and shifts the whole
   page; the test now waits for the banner *before* freezing the clock, and
   the committed baseline is stable across three consecutive full-spec runs
   (see `docs/campaign-04/decision-log.md` D06). Baselines depend on the
   documented backend state (the banner is part of the page).
3. ~~The lab has no dedicated screen-reader E2E~~ — **closed in Campaign 04:**
   `e2e/lab-a11y.spec.ts` (6 browser-level a11y tests) + the manual
   screen-reader protocol in `docs/campaign-04/screen-reader-protocol.md`
   (protocol delivered; real-AT execution still outstanding, honestly
   tracked in `docs/campaign-04/known-limitations.md`).
4. ~~The benchmark scores the critic rule set only~~ — **closed in Campaign
   04:** benchmark v2 (`engines/benchmark2.ts`) scores 8 dimensions over 29
   synthetic scenarios with a CI regression gate; it remains a synthetic
   self-consistency instrument, not external validation
   (`docs/campaign-04/known-limitations.md`).
