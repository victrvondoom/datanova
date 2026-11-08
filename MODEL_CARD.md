# Model Card — AEGIS-Fraud X Champion

Generated 2026-11-08T10:47:20.028363+00:00 by `scripts/generate_model_card.py` from recorded artifacts. Every figure below is read from the champion manifest and benchmark run at generation time.

## Model details

- Model: **lightgbm_fraud_detector** (version 1.3.0)
- Calibrator: isotonic
- Policy: Cost-Aware-Optimized (tau_allow=0.1818, solver=exact-distinct-value-sweep)
- Artifact run id: `bench_20261104T083846_42_10000`
- Artifact payload SHA-256: `0168563e6706feb2770edd9c9689d53370c4fcc98935733146548147c2781f20`
- Feature schema: 39 features (see FEATURE_SEMANTICS.md)

## Intended use

Real-time payment-transaction fraud screening as a DECISION-SUPPORT system: scores are consumed by the documented cost-aware policy to recommend ALLOW / CHALLENGE / REVIEW / BLOCK actions for human operations. Calibrated probabilities are required whenever a probability is interpreted as a fraud likelihood.

## Out-of-scope use

- Not a standalone identity-verification or sanctions-screening system.
- Not to be used for automated irreversible customer-harm actions without human review; the emergency-stop control forces review.
- Probabilities must not be presented as model outputs when the calibrator is missing or incompatible (the API refuses instead).

## Data and evaluation

- Primary benchmark dataset: **Synthetic_Bench_10000** (10000 records, 199 fraud, prevalence 0.0199)
- Split strategy: Chronological_60_20_20 (champion selection, calibration fitting, and policy tuning are validation-only; the test partition is touched once for honest final evaluation — enforced by release gates `tests/release/`)
- Seed: 42

## Metrics (honest test partition, single final evaluation)

- PR-AUC (validation, selection): 0.7880
- PR-AUC (test, honest): **0.8513**
- ROC-AUC: 0.9943
- Precision / Recall / F1: 0.9630 / 0.6047 / 0.7429
- False-positive rate: 0.0005
- Brier score / ECE: 0.0063 / 0.0039
- Inference latency: 0.0020 ms/tx

## Economic outcomes (SIMULATED, not realized bank savings)

- Baseline cost with no detection: $38,577.83
- Total operational cost under the AEGIS policy: $6,556.41
- Simulated net savings vs. baseline: $32,021.42
- These figures are produced by the shared cost engine under documented assumptions on this benchmark run; they are simulated estimates, not measured financial results.

## External validation

- ULB Credit Card Fraud dataset (OpenML dataset 1597 (creditcard), ARFF mirror of the Kaggle release): champion **XGBoost** validation PR-AUC 0.7696, honest test PR-AUC **0.7408** (artifact: `benchmarks/runs/ulb_evaluation.json`).
- PaySim evaluation: BLOCKED — dataset download requires Kaggle credentials that are not available in this environment. No PaySim results are claimed.

## Limitations

- Primary benchmark data is SYNTHETIC; absolute metrics are not evidence of real-world performance, only of protocol integrity.
- The policy is tuned on validation data only; realized savings depend on cost assumptions that must be recalibrated per deployment.
- Champion selection is validation-based; test metrics above are single-use and will lose honesty meaning if reused for selection.
- The case store and ledger are in-memory single-process; multi-instance deployments need external state.

## Provenance

- Manifest: `experiments/champion_bundle.pkl.manifest.json` (benchmark artifact SHA-256 `d2accb868f6836de64f6fa065f19b339fe7be6e110dd518e261ff6f6344e806d`)
- Generation is deterministic from the artifacts; regenerate after any champion promotion.
