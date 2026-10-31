# AEGIS-Fraud X — ULB Credit Card External Evaluation

**Generated:** 2026-10-31 08:36:02 UTC
**Dataset:** ULB Credit Card Fraud Detection (284,807 rows; 492 fraud, 0.173%)
**Source:** OpenML dataset 1597 (public mirror of the original release)
**Source ARFF SHA-256:** `fdaf12730dc1fc426f318b71349f24f5c5fd00aa1152940be7e7509ae3d89d2a`

ULB amounts are EUR. The cost analysis treats amounts as USD-equivalent; all dollar figures are simulated operating costs under the documented cost model, not realized bank savings.

## 1. Dataset audit (leakage findings)

| Check | Result |
|:---|:---|
| Records | 284,807 |
| Fraud | 492 (0.173%) |
| Missing values | 0 |
| Exact duplicate rows (dropped pre-split) | 1,081 |
| Duplicate feature vectors (retained) | 9,144 |
| Rows after dedup | 283,726 |
| Entity identifiers | None — no graph features used |

## 2. Model comparison (champion selected on VALIDATION PR-AUC)

| Model | Val PR-AUC | Test PR-AUC | Test ROC-AUC | Recall@1%FPR | Brier | ECE |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| Logistic Regression | 0.7537 | 0.7618 | 0.9804 | 0.8644 | 0.0005 | 0.0002 |
| Random Forest | 0.7665 | 0.7725 | 0.9593 | 0.8406 | 0.0004 | 0.0001 |
| LightGBM (repo default) | 0.0223 | 0.0391 | 0.8628 | 0.4212 | 0.0013 | 0.0004 |
| LightGBM (prevalence-tuned) | 0.7054 | 0.6789 | 0.9715 | 0.8561 | 0.0005 | 0.0003 |
| XGBoost | 0.7696 | 0.7408 | 0.9693 | 0.8295 | 0.0005 | 0.0002 |

**Champion (validation-selected):** `XGBoost`

95% bootstrap CI (test): PR-AUC [0.6480, 0.8235],
ROC-AUC [0.9491, 0.9856]

## 3. Frozen-policy operational comparison (held-out test)

| Regime | tau (allow/review/block) | FPR | Total Cost | Savings vs unmitigated |
|:---|:---:|:---:|:---:|:---:|
| Fixed p>=0.5 | 0.50/0.50/0.50 | 0.01% | $4,294.35 | 44.4% |
| Exact cost-aware (fitted on validation) | 0.01/0.92/0.92 | 0.19% | $2,841.60 | 63.2% |

Policy action mix (test): {"ALLOW": 56581, "CHALLENGE": 116, "REVIEW": 0, "BLOCK": 49}

## 4. Limitations

- ULB is 48 hours of European card data; temporal generalization over months is untested.
- No entity/graph features exist in ULB; graph components of AEGIS are not exercised here.
- Prevalence 0.173% means validation-set calibration support is thin
  (~57 fraud cases in validation); isotonic calibration is
  correspondingly coarse.
- All cost figures are simulated under documented assumptions (see header).
