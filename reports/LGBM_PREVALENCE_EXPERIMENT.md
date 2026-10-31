# LightGBM Prevalence Robustness Experiment (ULB)

**Generated:** 2026-10-31 08:35 UTC · **Selection split:** VALIDATION ONLY (test never read)
**Train prevalence:** 0.201%

| Configuration | Val PR-AUC | Val ROC-AUC | Val Recall@1%FPR |
|:---|:---:|:---:|:---:|
| default_full_weight (status quo) | 0.0345 | 0.8963 | 0.4484 |
| capped_weight_30 | 0.0636 | 0.8310 | 0.6679 |
| no_weighting | 0.0909 | 0.7732 | 0.5290 |
| no_weighting_shallow | 0.7054 | 0.9796 | 0.8103 |

**Selected (validation):** `no_weighting_shallow`

Next step: apply the selected configuration to the LightGBM candidate
in `scripts/run_ulb_evaluation.py` and re-run the standard evaluation
(champion selection remains validation-based; test reported once).
