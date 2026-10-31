# Model Card — AEGIS-Fraud X Champion

Generated 2026-10-31T09:08:10.106593+00:00 by `scripts/generate_model_card.py` from recorded artifacts. Every figure below is read from the champion manifest and benchmark run at generation time.

## Model details

- Model: **xgboost_fraud_detector** (version 1.1.0)
- Calibrator: isotonic
- Policy: Cost-Aware-Optimized (tau_allow=0.2222, solver=exact-distinct-value-sweep)
- Artifact run id: `bench_20261031T081621_42_10000`
- Artifact payload SHA-256: `09a63ad8cec09eedd86dd93446ffb4f5cc7b4e76e38b47fd0917e6e6f44fb4fd`
- Feature schema: 33 features (see FEATURE_SEMANTICS.md)

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

- PR-AUC (validation, selection): 0.8111
- PR-AUC (test, honest): **0.7147**
- ROC-AUC: 0.9915
- Precision / Recall / F1: 0.9200 / 0.5349 / 0.6765
- False-positive rate: 0.0010
- Brier score / ECE: 0.0091 / 0.0048
- Inference latency: 0.0010 ms/tx

## Economic outcomes (SIMULATED, not realized bank savings)

- Baseline cost with no detection: $38,577.83
- Total operational cost under the AEGIS policy: $7,442.83
- Simulated net savings vs. baseline: $31,135.00
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

- Manifest: `experiments/champion_bundle.pkl.manifest.json` (benchmark artifact SHA-256 `8e448b9305f72ff5aa0e96e373606cfe8e5d0667408fafdb46a0e1610085460a`)
- Generation is deterministic from the artifacts; regenerate after any champion promotion.
