# AEGIS-Fraud X — Audit Findings (2026-10-31)

**Scope gate:** The repository at the audit working root is `datanova` — the AEGIS-Fraud X
project (DataNova 2026, DN-FN-01, Real-Time Payment Fraud Detection). It is **not**
Aether-Score (`updatingmyhim/Aether-Score`). No Aether-Scope findings were applied here;
this audit was performed against the actual local source. The repository has **no git
remote**; work happens on `master` locally.

**Baseline at audit start:** 28/28 tests passing, mypy clean, ruff clean. All findings
below were established by source tracing and/or execution, not by README claims.

---

## Confirmed defects (found and fixed this audit)

### AFX-01 — P0 — Benchmark protocol test-set leakage
- **Component:** `scripts/run_benchmarks.py`
- **Observed behavior:** Champion model selected by **test-set** PR-AUC; policy thresholds
  optimized via `optimizer.compare_policies(champ_probs, amt_test, y_test)` — i.e. tuned on
  the held-out test partition with ground-truth labels.
- **Impact:** Headline claims (PR-AUC 0.8004, $35,516 savings, 92.1% loss reduction) were
  optimistically biased. Measurement integrity defect.
- **Fix:** Champion selection now uses validation PR-AUC (`select_champion_by_validation`);
  policy thresholds fit on validation predictions; the frozen policy is evaluated once on
  test. Fixed heuristic baselines (parameter-free) are evaluated on test directly.
- **Resulting honest numbers:** champion = XGBoost (val PR-AUC 0.8111, test 0.7147);
  frozen policy test cost $5,376.27, savings $33,201.56 (86.1%), FPR 0.20%.
- **Regression tests:** `tests/unit/test_benchmark_protocol.py` (4 tests).
- **Status:** Fixed and verified.

### AFX-02 — P0 — Serving API used a fabricated calibrator
- **Component:** `apps/api/main.py` (`init_engine`)
- **Observed behavior:** `ProbabilityCalibrator` fitted on `dummy_scores`/`dummy_labels`
  (linear ramp + 0.4 threshold), because `ProbabilityCalibrator` had no `save`/`load` and
  `run_benchmarks.py` silently never persisted the real calibrator
  (`... .save(...) if hasattr(...) else None`).
- **Impact:** Every `/api/score` `calibrated_probability` was calibrated against nonsense,
  propagating to actions, receipts, and the dashboard.
- **Fix:** Added `ProbabilityCalibrator.save/load` (pickle, same convention as
  `BaseFraudClassifier`); benchmark persists `experiments/champion_calibrator.pkl`; API loads
  it, falling back to fitting on real reference data (model scores + ground-truth labels),
  and exposes `state.calibration_source` ∈ {validation-artifact, reference-data,
  base-rate-prior}.
- **Regression tests:** `tests/unit/test_calibration.py` (3), `test_calibrator_is_never_the_fabricated_dummy`.
- **Status:** Fixed and verified.

### AFX-03 — P1 — Digital Twin comparison biased toward AEGIS
- **Component:** `apps/api/main.py` (`/api/stream/replay-batch`)
- **Observed behavior:** Baseline cost computed with ground-truth labels; AEGIS cost taken
  from `score_res.expected_cost`, which used the **predicted** label (`p>0.5 → is_fraud`).
  A missed fraud (ALLOW on a fraudulent transaction) cost AEGIS $0, inflating the live
  savings counter.
- **Fix:** Both sides now use `cost_engine.calculate_action_cost(action, ground_truth, amount)`;
  baseline block-friction also sourced from `cost_engine.config` instead of a hardcoded 25.0.
- **Regression tests:** `test_replay_batch_costs_reconcile_with_cost_engine` (per-record
  reconciliation + missed-fraud full-loss assertion + cumulative-sum consistency).
- **Status:** Fixed and verified.

### AFX-04 — P1 — CORS wildcard origins with credentials
- **Component:** `apps/api/main.py`
- **Observed behavior:** `allow_origins=["*"]` with `allow_credentials=True`.
- **Fix:** Explicit allowlist from `AEGIS_CORS_ORIGINS` env var (comma-separated or JSON
  list; default = localhost dev origins). Matches the existing `.env.example` key.
- **Regression tests:** `test_cors_rejects_disallowed_origin`, `test_cors_allows_configured_origin`.
- **Status:** Fixed and verified.

### AFX-05 — P1 — Frontend fabricated data on API failure, including fake receipt verification
- **Component:** `apps/web/src/api.ts`, `apps/web/src/views/ExplainabilityView.tsx`
- **Observed behavior:** Every API client function silently returned fully fabricated
  data when the backend was unreachable (invented probabilities, SHAP values, drift
  metrics, savings). Worst case: `verifyReceipt` returned `VALID_AUTHENTIC` based only on
  hash **length**, fabricating cryptographic verification.
- **Fix:** All offline fallbacks now carry `degraded: true` + `source: "offline-fallback"`;
  receipt verification offline returns `VERIFICATION_UNAVAILABLE_OFFLINE` (never a
  validity verdict); the view renders an explicit offline state instead of an HMAC-mismatch
  error.
- **Status:** Fixed (data layer + verification view). Surfacing `degraded` banners across
  all views is queued as NEXT-ACTIONS item 3.

### AFX-06 — P1 — Optimizer collapsed on zero-inflated calibrated probabilities
- **Component:** `packages/optimization/optimizer.py`
- **Observed behavior:** Allow-threshold candidates came from percentiles [50..95] of the
  calibrated probability distribution. Isotonic calibration maps most low-risk scores to
  exactly 0.0, so all candidates collapsed to 0.0; no candidate satisfied the FPR
  constraint; the fallback (which performed **no constraint check**) returned
  `tau_allow=0.0` → FPR = 1.0 on test (every legitimate transaction challenged). This
  defect was masked by the AFX-01 leaky protocol and surfaced only after the honest
  protocol was adopted.
- **Fix:** Candidate grid extended with high percentiles (up to 99.5) and the smallest
  strictly-positive probability (allows exactly the zero mass); degenerate candidates
  that cannot form a valid 4-tier policy are skipped; fallback rebuilt from the constraint
  definitions (allow below the (1−max_fpr) quantile; review within capacity).
- **Regression tests:** `test_optimizer_handles_zero_inflated_calibrated_probs`,
  `test_policy_thresholds_fit_on_validation_satisfy_constraints`,
  `test_frozen_policy_evaluation_does_not_refit_thresholds`.
- **Status:** Fixed and verified.

### AFX-07 — P2 — Fabricated graph node risk scores
- **Component:** `apps/api/main.py` (`/api/graph/subgraph`)
- **Observed behavior:** `risk_score: 0.88 if "mule" in node name else 0.12` — hardcoded
  per-name values presented as risk.
- **Fix:** Risk indicator derived from real topology: cycle membership via strongly
  connected components (SCC size > 1). Node payload carries `cycle_member` and the
  display-scale score (0.9/0.1) consistent with it.
- **Regression tests:** `test_graph_subgraph_risk_score_is_derived_not_fabricated`.
- **Status:** Fixed and verified.

### AFX-08 — P3 — Dead code / stale conventions
- `np.sort(calibrated_probs)` no-op in `optimizer.py` — removed.
- `champion_calibrator.save(...) if hasattr(...) else None` expression-statement —
  replaced by a real save.
- README test badge claimed 24/24 while 41 tests exist — updated.

---

## Documentation inconsistencies (corrected)

- **AFX-D1:** README/BENCHMARKS/frontend/Sidebar/MissionControl/DecisionLab/ResearchCenter
  all reproduced the leaked benchmark numbers. All were regenerated from
  `benchmarks/runs/benchmark_summary.json` (post-fix) or updated to the honest values;
  README carries an explicit evidence-integrity note pointing at this file.
- **AFX-D2:** The "AEGIS LightGBM + Graph" champion narrative in the UI. Champion is
  selected by validation PR-AUC; the honest champion is XGBoost. (The graph model remains
  the best test PR-AUC of 0.7667, but test performance must not drive selection.)
- **PROGRESS.md** claimed "24/24 tests passing" — stale; updated.

## Notable non-defects (verified)

- Chronological splitter, feature pipeline fit-on-train-only, isotonic calibration
  fitted on validation only, HMAC receipt generation/verification, and drift PSI
  thresholds were traced and behaved consistently with their documentation.
- `run_ablation.py` does not tune anything on test; its component deltas are test-metric
  reporting (regenerated post-fix for consistency).

## Known limitations remaining (see LIMITATIONS.md)

- The optimized policy's review window captured 0 test transactions in the current
  honest run (review_rate 0.0 on test); savings come from the challenge tier. The
  optimizer's percentile grid is coarse; a finer search or exact solver is queued.
- All benchmarks are on deterministic synthetic data; no external dataset (ULB/PaySim)
  has been run through this protocol yet.


---

# Milestone 2 Audit Findings (2026-10-31)

## AFX-09 — P1 — Client-side receipt reconstruction could never verify
- **Component:** `apps/web/src/views/ExplainabilityView.tsx`, `/api/score`
- **Observed behavior:** `/api/score` returned only the receipt hash; the
  frontend reconstructed a receipt-like object with different `receipt_id`,
  cost field, and rounding than the server signed. "Verify Authentic"
  therefore ALWAYS failed against a live backend (masked until now by the
  fabricated offline verification, AFX-05).
- **How found:** Playwright E2E journey (not by unit tests — the defect spans
  the client/server boundary).
- **Fix:** `/api/score` returns the full server-signed receipt
  (`audit_receipt`); the client verifies it verbatim.
- **Regression tests:** `apps/web/e2e/journey.spec.ts` (online journey).

## AFX-10 — P1 — ULB adapter desynchronized features from labels
- **Component:** `packages/data/adapters/ulb.py`
- **Observed behavior:** `sort_values` (unstable quicksort) shuffled rows
  sharing the same `Time` second; any consumer re-attaching data to the
  sorted frame got features misaligned from labels. First ULB run produced
  PR-AUC BELOW class prevalence (0.0013 < 0.00173) — worse than random.
- **How found:** external-data magnitude sanity check.
- **Fix:** stable sort (`kind="stable"`) + `standardize_frame()` API so
  callers standardize an in-memory frame without re-reads.
- **Regression tests:** `tests/unit/test_dataset_adapters.py` (stable-order
  test with tied timestamps).

## AFX-11 — P2 — ULB adapter fabricated recurring entity identities
- **Observed behavior:** `sender_id = ulb_card_{i % 5000}` invented fake
  recurring accounts for a dataset with no entity semantics.
- **Fix:** unique per-row pseudo-IDs + fixed counterparty, documented; graph
  features explicitly not computed for ULB.

## AFX-12 — P2 — Receipt verification overclaimed authenticity
- **Observed behavior:** status `VALID_AUTHENTIC` for a plain HMAC match
  under a hardcoded, source-public key.
- **Fix:** truthful states `SIGNATURE_VERIFIED` / `SIGNATURE_INVALID`, key
  via `AEGIS_RECEIPT_SECRET`, verification semantics stated in the response;
  development-key forgeability documented.
- **Regression tests:** `test_receipt_verification_edge_cases` (schema error,
  wrong-key signature, semantics disclosure).

## AFX-13 — P2 — Container image missing native ML runtime
- **Observed behavior:** API container crashed at startup:
  `libgomp.so.1: cannot open shared object file` (LightGBM OpenMP runtime
  absent from python:3.12-slim).
- **Fix:** `apt-get install libgomp1` in `infra/Dockerfile.api`.
- **Verification status:** image build verified once pre-fix; the post-fix
  build + smoke test is BLOCKED (Docker Desktop became unresponsive) —
  recorded as implemented-not-verified in DEPLOYMENT_READINESS.md.
