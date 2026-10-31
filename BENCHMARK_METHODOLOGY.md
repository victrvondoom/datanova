# AEGIS-Fraud X — Benchmark Methodology

Applies identically to the synthetic benchmark (`scripts/run_benchmarks.py`)
and the external ULB evaluation (`scripts/run_ulb_evaluation.py`).

## 1. Split protocol

- **Strict chronological** 60% train / 20% validation / 20% test on the time
  axis (synthetic: generated timestamps; ULB: the `Time` field). The test
  partition is the most recent period — no future information can appear in
  training.
- External data hygiene: exact duplicate rows are dropped BEFORE splitting
  (duplicate-leakage guard). ULB: 1,081 duplicates dropped (284,807 → 283,726).
- ULB-specific: `Time` is the split key only, never a feature (an index-like
  feature would leak partition identity). StandardScaler is fitted on the
  training partition only. No graph features (the dataset is anonymized and
  has no entities — fabricating them is forbidden).

## 2. Selection, calibration, and policy fitting (validation only)

1. All preprocessing fitted on TRAIN only.
2. Models trained on TRAIN.
3. Per model: isotonic calibration fitted on VALIDATION predictions.
4. **Champion selection: VALIDATION PR-AUC only** (`select_champion_by_validation`).
5. **Policy: exact optimizer fitted on VALIDATION** probabilities/labels/amounts;
   thresholds frozen.
6. The frozen system (model + calibrator + policy) is evaluated ONCE on TEST.

Test data never influences model choice, hyperparameters, calibration method,
thresholds, or any preprocessing. This is enforced by release gate 1
(`tests/release/test_gate_benchmark_protocol.py`), which runs the real
pipeline twice with adversarially mutated test labels and asserts the champion
and frozen policy are invariant while test metrics change.

## 3. Metrics

Computed by `packages/evaluation/metrics.py` + `bootstrap.py`:
PR-AUC (primary, imbalanced-data appropriate), ROC-AUC, Recall@1%FPR, Brier,
ECE, and 95% bootstrap confidence intervals (200 resamples, seeded) for the
champion. Cost/policy metrics come from the single authoritative
`CostEngine`. Metric provenance is recorded in `METRICS_REGISTRY.md`.

## 4. Artifacts and reproducibility

- `benchmarks/runs/benchmark_summary.json` — authoritative synthetic artifact
  (model metrics, CIs, policy comparisons, optimization regret, frozen
  champion validation scores, dataset manifest).
- `benchmarks/runs/ulb_evaluation.json` — authoritative ULB artifact
  (adds full provenance: source, SHA-256, audit, currency assumptions).
- Deterministic: seed 42; re-running reproduces all numbers (verified
  2026-10-31).
- The champion artifact bundle (`experiments/champion_bundle.pkl` + manifest)
  records run id, benchmark artifact hash, feature schema, and frozen policy.

## 5. Reporting rules

- Reports (`reports/BENCHMARK_REPORT.md`, `reports/ULB_EVALUATION.md`,
  `BENCHMARKS.md`) are generated FROM the artifacts, never hand-edited.
- README numbers cite the artifact and note the protocol version.
- Savings figures are always labeled as simulated operating costs under
  documented assumptions.
- Cross-dataset comparisons of raw PR-AUC are prohibited (different
  environments/prevalences); ULB and synthetic results are reported
  separately.
