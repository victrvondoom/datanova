# AEGIS-Fraud X — Metrics Registry

Single authoritative source for every published metric. All values are
regenerated from the artifacts; this registry defines what each one IS.

## Predictive metrics

| Metric | Definition | Unit | Source (calculation) | Artifact |
|:---|:---|:---|:---|:---|
| `validation_pr_auc` | Average precision on the VALIDATION split (drives champion selection) | fraction | `packages/evaluation/metrics.py` | `benchmark_summary.json`, `ulb_evaluation.json` |
| `pr_auc` | Average precision on the held-out TEST split (reporting only) | fraction | same | same |
| `roc_auc` | Rank statistic, TEST | fraction | same | same |
| `recall_at_fpr_1pct` | Recall at 1.0% FPR, TEST | fraction | same | same |
| `brier_score` / `ece` | Calibration error measures, TEST | fraction | `packages/models/calibration.py` | same |
| `ci_*` | 95% bootstrap intervals (200 seeded resamples) | bounds | `packages/evaluation/bootstrap.py` | same |

## Policy / financial metrics (single calculation: `packages/optimization/cost_engine.py`)

| Metric | Definition | Notes |
|:---|:---|:---|
| `total_cost` | Sum of realized action costs over an evaluation split | simulated operating cost |
| `estimated_savings` | `max(0, unmitigated_fraud_loss - total_cost)` | NOT a realized saving |
| `savings_ratio` | savings / unmitigated loss | label with cost assumptions |
| `false_positive_rate` | #legit(p ≥ tau_allow) / n_legit | challenge counts as an alarm |
| `review_rate` | #REVIEW / n | capacity-checked by the optimizer |
| `optimization_gap_validation_usd` | coarse-grid val cost − exact val cost | regret diagnostic |

## Provenance and status classification

- Every metric carries: dataset, split, model, calibration source, policy,
  and run timestamp inside its artifact.
- Status labels used across docs/UI: **Verified** (reproduced locally from
  artifact), **Simulated** (cost-model outputs), **Estimated** (bootstrap CIs),
  **Degraded** (frontend offline fallback — never displayed as live).
- Frontend rule: live values come from the API; offline fallbacks are marked
  `degraded: true` and the global banner states that they are simulations.
- Cross-dataset comparisons of raw PR-AUC are prohibited (different
  prevalences/environments); ULB and synthetic results are reported separately.
