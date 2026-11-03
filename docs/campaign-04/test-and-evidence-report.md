# Campaign 04 — Test & Evidence Report

All results below were **executed in this campaign's final verification run**
(working tree = the code committed for Campaign 04). Commands are exact and
reproducible. Checks that were NOT run are listed at the end with reasons.

## 1. Frontend unit tests (vitest)

```bash
cd apps/web && npm test
```

**Result: 14 test files passed, 286/286 tests passed** (~1.7 s).

Breakdown: Campaign 03 suites `m1..m9.test.ts` (192 cases, all green) +
Campaign 04 suites `c04.test.ts` (29 cases: evidence, intent compiler,
scenario engine, recovery timeline, sensitivity, tenant matrix, determinism
proofs) + `c04-benchmark.test.ts` (4 cases incl. the REGRESSION GATE) + the
pre-existing trail/sim suites.

## 2. Lint (oxlint)

```bash
cd apps/web && npx oxlint src
```

**Result: 0 warnings, 0 errors** (108 files, 116 rules).

## 3. Type-check + production build

```bash
cd apps/web && npm run build   # tsc -b && vite build
```

**Result: ✓ built** (type-check clean; Vite chunk-size warning only, no
errors).

## 4. Playwright E2E — two-phase procedure (per `scripts/run_e2e.md`)

Playwright config: `workers: 1` (determinism, C03 fix retained). Preview
server: `npx vite preview --port 4173 --strictPort` against the freshly
built `dist/`.

### Phase A — API stopped (offline/degraded state)

```bash
cd apps/web
npx playwright test e2e/lab.spec.ts e2e/lab-a11y.spec.ts e2e/trail.spec.ts e2e/trail-a11y.spec.ts --reporter=line
# => 22 passed (26.4 s)
npx playwright test e2e/journey.spec.ts --grep "backend offline" --reporter=line
# => 1 passed (1.9 s)
```

**Result: 23/23 passed**, covering:
- `lab.spec.ts` (9): canvas + intent coverage; causality (meta-db failure →
  causal chain + blast radius); chaos verdict + flight-recorder replay +
  package round-trip; critic/scorecard/debate/mission; capstone lifecycle;
  **C04: intent → compiled starter model → adopt**; **C04: scenario runner
  end-to-end**; **C04: capstone evidence-pack export with typed provenance**;
  persistence across reload + reset.
- `lab-a11y.spec.ts` (6): full keyboard journey with visible focus;
  accessible names on every interactive control; severity + evidence-kind
  labels (not color alone); intent form labels/keyboard/announced results;
  scenario-runner pass/fail text labels; accessibility-tree snapshot of
  headings/regions.
- `trail.spec.ts` (4) and `trail-a11y.spec.ts` (3, incl. the two visual
  baselines) — Campaign 03 behavior intact. The topic-01 visual baseline is
  now stable (banner-wait + clock-freeze; three consecutive full-spec runs
  at 3/3 each during the fix investigation; final phase-A run green).

### Phase B — API running (online journey)

```bash
AEGIS_CORS_ORIGINS="http://localhost:4173,http://127.0.0.1:4173" \
  python -m uvicorn apps.api.main:app --port 8002 &
cd apps/web && npx playwright test e2e/journey.spec.ts --grep "live backend" --reporter=line
# => 1 passed (3.4 s)
```

**Result: 1/1 passed** (score → receipt → `SIGNATURE_VERIFIED` → tamper →
`SIGNATURE_INVALID` against the real API).

**Total Playwright: 24/24 passed.**

## 5. Python suite (fraud engine, release gates)

```bash
python -m pytest tests/ -W ignore          # => 141 passed in 21.12s
python -m pytest tests/release/           # => 12 passed (mandatory gates: leakage invariance + calibrator provenance)
python -m mypy packages apps scripts --ignore-missing-imports   # => Success: no issues found in 59 source files
python -m ruff check .                     # => All checks passed!
```

**Result: 141/141 pytest, release gates 12/12, mypy clean, ruff clean.**
The lab shares no runtime code with the fraud engine; these checks protect
the repo's standing verification contract.

## 6. Evidence index

| Evidence | Location |
|---|---|
| Campaign 04 test suites | `apps/web/src/lab/__tests__/c04.test.ts` (29), `c04-benchmark.test.ts` (4) |
| New engines | `apps/web/src/lab/engines/{evidence,intent-compiler,scenario,recovery-timeline,sensitivity,tenantmatrix,benchmark2}.ts` |
| A11y E2E | `apps/web/e2e/lab-a11y.spec.ts` (6 tests) |
| Journey E2E (C04 tests) | `apps/web/e2e/lab.spec.ts` (3 new C04 tests) |
| Manual SR protocol | `docs/campaign-04/screen-reader-protocol.md` |
| Deterministic visual baselines | `apps/web/e2e/trail-a11y.spec.ts-snapshots/` (committed reference; stable across 3 consecutive runs) |
| Benchmark v2 corpus + report | `engines/benchmark2.ts` (29 scenarios, 8 dimensions, `renderBenchmarkV2Report`) |
| Architecture inventory | `docs/campaign-04/architecture.md` |
| Task ledger | `docs/campaign-04/task-ledger.md` (225/225 work packages with per-WP evidence) |
| Campaign 03 baseline evidence | `docs/campaign-03-build-evidence.md`, `docs/campaign-03-test-report.md` |

## 7. Checks NOT run (and why)

- **Real screen-reader testing (NVDA/JAWS/VoiceOver/Narrator)** — requires
  assistive technology installed and human listening; documented as the
  manual protocol with run log `NOT YET RUN`
  (`screen-reader-protocol.md`, `known-limitations.md`).
- **Real external load tests / production telemetry** — out of scope by
  design; all lab simulations are deterministic models with declared
  assumptions and are labeled as such.
- **External dataset re-evaluation** (`scripts/run_ulb_evaluation.py`) —
  requires `datasets/external/creditcard.csv`, absent from this machine;
  unrelated to the lab.
- **Benchmark scripts** (`python scripts/run_benchmarks.py`,
  `run_policy_sensitivity.py`) — fraud-engine artifacts unchanged this
  campaign; no code touching them was modified, so the committed benchmark
  artifacts remain valid and were not regenerated.
