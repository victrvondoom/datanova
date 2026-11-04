# DataNova Atlas — Verification & Regression Ledger

All assertions must be backed by executed commands and reproducible artifacts.

## 1. Complete Verification Matrix

| Test Suite | Environment | Command | Status | Result / Details |
|---|---|---|---|---|
| Vitest Unit & Lab Suite | Node / Vitest | `npm run test` (in `apps/web`) | **PASSED** | 457 tests passed across 22 test files (2.19s) |
| Release Gates | Python 3.12 (`.venv`) | `.venv\Scripts\python.exe -m pytest tests/release/ -v` | **PASSED** | 12 tests passed, 0 failures (9.41s) |
| Code Quality / Linter | oxlint | `npm run lint` (in `apps/web`) | **PASSED** | 0 errors, 0 warnings across 182 files (149ms) |
| Production Build | Vite / TSC | `npm run build` (in `apps/web`) | **PASSED** | 2,649 modules transformed, dist built in 2.68s |
| Playwright Baseline E2E | Chromium / Preview | `npx playwright test e2e/atlas.spec.ts` | **PASSED** | 9 tests passed in 14.8s |
| Playwright Interactive E2E | Chromium / Preview | `npx playwright test e2e/atlas-interactive.spec.ts` | **PASSED** | 5 tests passed in 7.3s |
| Combined Playwright Suites | Chromium / Preview | `npx playwright test e2e/atlas.spec.ts e2e/atlas-interactive.spec.ts` | **PASSED** | 14 tests passed in 21.1s |
| Playwright Visual Capture | Chromium / Preview | `npx playwright test e2e/atlas-visual.spec.ts` | **PASSED** | 1 test passed in 21.2s (19 screenshots captured) |

---

## 2. Spatial Stress Benchmarks (`c06-atlas-performance.test.ts`)

Command: `cd apps/web && npx vitest run src/lab/__tests__/c06-atlas-performance.test.ts`

| Metric Profile | Nodes / Edges | Layout Budget | Actual Layout Time | Graph Prep Time | Total Runtime | Verification |
|---|---|---|---|---|---|---|
| Small | 25 / 50 | < 10ms | 2.1ms | 1.4ms | 3.5ms | Validated |
| Medium | 100 / 300 | < 30ms | 9.4ms | 4.8ms | 14.2ms | Validated |
| Large | 250 / 750 | < 80ms | 28.5ms | 11.2ms | 39.7ms | Validated |
| Stress | 500 / 1500 | < 200ms | 64.1ms | 24.3ms | 88.4ms | Validated |

All layout coordinates verified within bounding bounds `[-40, 40]` on $X$ and $Z$.

---

## 3. Visual Artifacts Verification

All 19 screenshots in `docs/campaign-06/evidence/screens/` verified on disk:
- `01-mission-control.png` (243 KB)
- `02-studio-topology-3d.png` (286 KB)
- `03-studio-dependency.png` (258 KB)
- `04-studio-trust.png` (257 KB)
- `05-studio-data-lineage.png` (260 KB)
- `06-studio-failure.png` (257 KB)
- `07-studio-traffic-with-scenario.png` (263 KB)
- `08-studio-recovery.png` (262 KB)
- `09-studio-evidence.png` (264 KB)
- `10-studio-2d-fallback.png` (236 KB)
- `11-experiments.png` (198 KB)
- `12-validation-room.png` (230 KB)
- `13-evidence-exchange.png` (211 KB)
- `14-benchmarks.png` (224 KB)
- `15-sources.png` (312 KB)
- `16-decisions.png` (272 KB)
- `17-design-system.png` (205 KB)
- `18-responsive-studio.png` (164 KB)
- `19-studio-final.png` (206 KB)
