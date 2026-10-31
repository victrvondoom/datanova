# AEGIS-Fraud X — Dataset Cards

## Card 1: Synthetic Benchmark Population

| Property | Value |
|:---|:---|
| Nature | **SIMULATED** (deterministic generator, seed 42) |
| Rows / fraud | 10,000 / 199 (1.99%) |
| Entities | accounts, merchants, devices, mule rings (simulated) |
| Timestamps | yes (chronological) |
| Features | 33 tabular velocity/history features + 6 graph features |
| Split | chronological 60/20/20 |
| Use | primary development + ablation evidence |
| Limitations | synthetic; no claim of external validity; graph ground truth comes from the generator's construction |

## Card 2: ULB Credit Card Fraud Detection (external)

| Property | Value |
|:---|:---|
| Nature | REAL anonymized card transactions (PCA features) |
| Source | OpenML dataset 1597 (mirror of ULB/Worldline release) |
| SHA-256 | `fdaf1273…d89d2a` (full value in DATA_PROVENANCE.md) |
| Rows / fraud | 284,807 / 492 (0.173%); 283,726 / 473 after exact-duplicate removal |
| Entities | **none** (anonymized) → no graph features, unique pseudo-IDs only |
| Timestamps | `Time` = seconds since first transaction (48h span), chronological order |
| Features | V1–V28 (PCA) + Amount; `Time` excluded as a feature (split key) |
| Preprocessing | StandardScaler fitted on training partition only |
| Split | chronological 60/20/20 (170,235 / 56,745 / 56,746) |
| Currency | EUR (treated as USD-equivalent for the simulated cost model — documented assumption) |
| Leakage audit | duplicates dropped pre-split; no entity leakage possible; temporal split; scaler train-only |
| Champion (validation PR-AUC) | XGBoost, val 0.7696 / test 0.7408 |
| Policy (exact, validation-fitted) | test savings 63.2% vs unmitigated loss at 0.19% FPR (simulated) |
| Limitations | 48h window (no long-range temporal generalization); thin validation fraud support (~99 cases) makes isotonic calibration coarse; repository-default LightGBM config collapses at 0.17% prevalence (val PR-AUC 0.02) — documented finding, not hidden |

## Card 3: PaySim — PENDING (acquisition blocked)

Kaggle-gated; tested adapter exists; no results claimed. See
DATA_PROVENANCE.md §3 for the exact unblocking procedure.
