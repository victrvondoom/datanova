# Campaign 07 — Verification Index & Regression Ledger

All claims in this document are verified by executed commands and reproducible test artifacts.

---

## 1. Test Matrix Execution Ledger

| Suite | Category | Target Files | Verification Target | Command | Result |
|---|---|---|---|---|---|
| **Vitest Unit Suite** | Pure Analytical Engines | `src/reality/__tests__/c07-reality-engines.test.ts` (18 tests) + 22 other test suites | Envelope schema, hashing, connectors, reconciliation, SLOs, causal graph, git diff | `cd apps/web && npm run test -- --run` | **475 passed across 23 files** in 1.77s |
| **Playwright E2E Capstone** | Full Reality Lifecycle | `apps/web/e2e/reality-capstone.spec.ts` | 9-step integrated capstone journey across all 7 tabs and 3D Studio | `cd apps/web && npx playwright test e2e/reality-capstone.spec.ts` | **9 passed (0 failures)** in 13.4s |
| **Playwright Visual Evidence** | High-Res Screenshots | `apps/web/e2e/reality-visual.spec.ts` | 12 full-screen evidence artifacts | `cd apps/web && npx playwright test e2e/reality-visual.spec.ts` | **1 passed (12 artifacts written)** in 8.1s |
| **Oxlint Static Analysis** | Code Quality & Linter | `apps/web/src/reality/` | 0 errors, 0 warnings across whole workspace | `cd apps/web && npm run lint` | **0 warnings, 0 errors** across 207 files in 84ms |
| **Production Build** | TypeScript Compilation & Vite | `apps/web/dist/` | Production bundle generation | `cd apps/web && npm run build` | **Clean build** in 2.10s |
| **Python ML Release Gates** | Zero Leakage & Provenance | `tests/release/` | 12 release gates in virtual environment | `.venv\Scripts\python.exe -m pytest tests/release/ -v` | **12 passed (0 failures)** in 15.97s |

---

## 2. Visual Evidence Inventory

All screenshots are stored under `docs/campaign-07/evidence/screens/` and verified:

| File Name | Size | Resolution | Viewport Description |
|---|---|---|---|
| `01-reality-overview.png` | 226 KB | 1440×900 | Reality Engine hero overview, 4 sovereign view KPI cards, Section 8 demo loader |
| `02-ingestion-center.png` | 212 KB | 1440×900 | Ingestion Center, connector catalog (OTel, Metrics, Logs, K8s), read-only badges, import console |
| `03-runtime-topology.png` | 226 KB | 1440×900 | Active runtime service topology table (Order Service, Pricing Service, Order DB, etc.) |
| `04-trace-waterfall.png` | 226 KB | 1440×900 | Trace Explorer span waterfall (`POST /order` &rarr; `routeOrderRequest` &rarr; `createOrder` &rarr; `calculateDiscount`) |
| `05-reconciliation-drift.png` | 303 KB | 1440×900 | Three-way architecture reconciliation drift finding inbox and severity filter |
| `06-section8-undocumented-pricing.png` | 303 KB | 1440×900 | Section 8 showcase banner highlighting undocumented `Pricing Service` dependency bypassing queue |
| `07-reliability-slos.png` | 226 KB | 1440×900 | Operational reliability composite scorecard, SLO compliance table, critical-path analysis, anomaly alerts |
| `08-incident-workspace.png` | 285 KB | 1440×900 | Correlated multi-signal timeline, dual blast-radius discrepancy (+3 unarchitected nodes) |
| `09-causal-hypotheses.png` | 285 KB | 1440×900 | AI-assisted causal hypotheses with zero false certainty (88% SUPPORTED hypothesis) |
| `10-postmortem-package.png` | 280 KB | 1440×900 | Cryptographically attested incident postmortem with immutable SHA-256 digest |
| `11-change-release-gate.png` | 235 KB | 1440×900 | Git commit mapping, OpenAPI contract breaking change diff, and human authorization release gate |
| `12-studio-divergence-layer.png` | 288 KB | 1440×900 | 3D Spatial Architecture Studio rendered with Operational Reality Divergence Map layer |

---

## 3. Reproduction Commands

To reproduce the entire verification pipeline independently:

```bash
# 1. Run Python release gates
.venv\Scripts\python.exe -m pytest tests/release/ -v

# 2. Run frontend unit test suite
cd apps/web
npm run test -- --run

# 3. Run linter
npm run lint

# 4. Compile and build production bundle
npm run build

# 5. Run Playwright Capstone E2E tests
npx playwright test e2e/reality-capstone.spec.ts

# 6. Capture Visual Evidence screenshots
npx playwright test e2e/reality-visual.spec.ts
```
