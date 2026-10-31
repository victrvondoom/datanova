# AEGIS-Fraud X — Comprehensive Benchmark & Empirical Evidence Report

**Generated:** 2026-10-31 06:14:13 UTC
**Evaluation Protocol:** Strict Chronological Train (60%) -> Val (20%) -> Test (20%)
**Dataset:** Deterministic Synthetic Benchmark (10,000 transactions, 2% ground truth fraud)

---

## 1. Candidate Model Performance Matrix (Held-Out Test Set)

| Model Architecture | PR-AUC | ROC-AUC | Recall @ FPR=1% | Brier Score | ECE | Latency (ms) | Operational Cost ($) |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Rule-Based Heuristic** | **0.0949** | 0.6091 | 0.1245 | 0.0198 | 0.0041 | 0.00 ms | $35,750.07 |
| **Logistic Regression** | **0.4509** | 0.9646 | 0.4303 | 0.0143 | 0.0039 | 0.00 ms | $27,844.57 |
| **Random Forest** | **0.7190** | 0.9783 | 0.6724 | 0.0096 | 0.0036 | 0.01 ms | $9,581.30 |
| **LightGBM (Tabular)** | **0.7240** | 0.9891 | 0.6887 | 0.0086 | 0.0043 | 0.00 ms | $5,960.88 |
| **XGBoost** | **0.7147** | 0.9915 | 0.7141 | 0.0091 | 0.0048 | 0.00 ms | $7,442.83 |
| **AEGIS LightGBM + Graph** | **0.7667** | 0.9905 | 0.7753 | 0.0082 | 0.0037 | 0.00 ms | $5,940.88 |

---

## 2. Champion Model 95% Bootstrap Confidence Intervals

**Champion Model:** `XGBoost`

- **PR-AUC (95% CI):** [0.5912, 0.8294] (Mean: 0.7169)
- **ROC-AUC (95% CI):** [0.9863, 0.9961] (Mean: 0.9916)

---

## 3. Cost-Aware Operational Policy Comparison

| Operational Regime | Allow ($	au_{allow}$) | Review ($	au_{rev}$) | Block ($	au_{blk}$) | False Alarm Rate (FPR) | Total Cost ($) | Net Dollar Savings ($) |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| Fixed-Threshold (p>=0.5) | 0.50 | 0.50 | 0.50 | 0.10% | $7,107.83 | **$31,470.00** (81.6%) |
| Conservative Heuristic | 0.30 | 0.70 | 0.95 | 0.10% | $7,107.83 | **$31,470.00** (81.6%) |
| Cost-Aware-Optimized | 0.22 | 0.23 | 1.00 | 0.20% | $5,376.27 | **$33,201.56** (86.1%) |

---

## 4. Key Scientific Insights & Ablation Findings
1. **Graph Value Add:** Integrating dynamic temporal graph features (`g_cycle`, `g_dev_shared`, `g_in_degree`) elevates PR-AUC by capturing coordinated mule ring structuring that tabular features alone miss.
2. **Cost-Aware Optimization:** Moving from fixed $p \ge 0.5$ thresholding to AEGIS's 4-tier cost-optimized policy captures high-value fraud via step-up authentication while keeping manual investigator workloads strictly within capacity.
