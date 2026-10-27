# AEGIS-Fraud X — Scientific Research Foundation & Literature Review

**Document Purpose:** Establishes the theoretical foundation, methodological choices, and literature backing for AEGIS-Fraud X for DataNova 2026 Problem Statement DN-FN-01 (Real-Time Payment Fraud Detection).

---

## 1. Key Problem Dimensions in Payment Fraud Detection

### 1.1 Severe Class Imbalance & Metric Fallacy
- **Literature:** Dal Pozzolo et al. (2015), *Calibrating Probability with Undersampling for Unbalanced Classification*; Saito & Rehmsmeier (2015), *The Precision-Recall Plot Is More Informative than the ROC Plot when Evaluating Imbalanced Datasets*.
- **Findings:** In real card and digital payment networks, fraud prevalence is typically between $0.05\%$ and $0.2\%$. High ROC-AUC (e.g. 0.98) can be deceptive because a high false positive rate on the vast majority class ($99.8\%$ legitimate) drowns operations in false alarms.
- **AEGIS-Fraud X Choice:** Primary optimization metric is **Average Precision (PR-AUC)** and **Recall at fixed low False Positive Rate (FPR $\le 1\%$)**, rather than ROC-AUC or uncalibrated accuracy.

### 1.2 Temporal Lookahead Bias & Non-Stationarity
- **Literature:** Pasa et al. (2020), *Temporal Splits and Cross-Validation for Credit Card Fraud Detection*; Carcillo et al. (2018), *Streaming Active Learning for Fraud Detection*.
- **Findings:** Random $k$-fold cross-validation randomly distributes transactions across time, allowing models to "peek" into future fraud patterns (e.g., a card compromised in day 3 being detected on day 1). This causes 20–40% optimistic bias in PR-AUC.
- **AEGIS-Fraud X Choice:** Enforce strict forward-chaining chronological splits. Preprocessing transformers (imputers, standard scalers, categorical encoders) fit strictly on historical training data.

### 1.3 Probability Calibration in Skewed Domains
- **Literature:** Niculescu-Mizil & Caruana (2005), *Predicting Good Probabilities With Supervised Learning*; Guo et al. (2017), *On Calibration of Modern Neural Networks*.
- **Findings:** Tree-based models (XGBoost, LightGBM) output biased margins due to tree depth regularization and split criteria (entropy/gini), frequently underestimating confidence in extreme tails or pushing scores towards 0 and 1.
- **AEGIS-Fraud X Choice:** Fit non-parametric **Isotonic Regression** and **Platt Sigmoid Scaling** on an independent temporal validation set. Model outputs are assessed via **Expected Calibration Error (ECE)** and **Brier Score**.

### 1.4 Financial Cost-Aware Classification
- **Literature:** Elkan (2001), *The Foundations of Cost-Sensitive Learning*; Bahnsen et al. (2016), *Feature Engineering and Cost-Sensitive Evaluation for Credit Card Fraud Detection*.
- **Findings:** Symmetric loss functions (0-1 loss) fail in finance. Misclassifying a \$5,000 fraud costs \$5,000; misclassifying a \$10 fraud costs \$10. Conversely, falsely declining a legitimate VIP cardholder incurs merchant friction, brand damage, and potential churn ($c_{fric}$).
- **AEGIS-Fraud X Choice:** AEGIS-Fraud X introduces a 4-action operational policy ($\{\text{Allow}, \text{Challenge}, \text{Review}, \text{Block}\}$) that optimizes a continuous expected cost objective under investigator queue constraints.

### 1.5 Temporal Graph Analytics for Syndicate & Mule Detection
- **Literature:** Wang et al. (2019), *Semi-supervised Graph Attention Networks for Financial Fraud Detection*; Dou et al. (2020), *Enhancing Graph Neural Networks for Fraud Detection with Self-paced Heterogeneous Graph Mining*.
- **Findings:** Fraud is rarely an isolated act. Fraud syndicates share device fingerprints, IP subnets, mule accounts, and execute rapid cycles or "fan-out fan-in" structuring (smurfing) to evade single-transaction velocity checks.
- **AEGIS-Fraud X Choice:** Dynamic bipartite graph linking Accounts, Transactions, and Devices. Ego-net feature extractors calculate rolling degree centrality, burst velocity, and cyclic path presence within low-latency ($<20\text{ms}$) constraints.

### 1.6 Explainability for Regulatory Compliance (GDPR, FCRA, EU AI Act)
- **Literature:** Lundberg & Lee (2017), *A Unified Approach to Interpreting Model Predictions (SHAP)*; European Commission (2024), *EU Artificial Intelligence Act (High-Risk AI Systems in Financial Services)*.
- **Findings:** Black-box rejections without clear adverse action explanations violate banking consumer protection regulations.
- **AEGIS-Fraud X Choice:** Instant exact TreeSHAP local attribution for every flagged transaction, producing a cryptographically hashed JSON evidence receipt suitable for human-in-the-loop audit.

---

## 2. Summary of Design Choices

| Dimension | Standard Industry Practice | AEGIS-Fraud X Approach | Scientific Justification |
|:---|:---|:---|:---|
| **Split Strategy** | Random 80/20 train/test | Strict Chronological Split | Prevents lookahead leakage; mirrors production reality |
| **Primary Metric** | ROC-AUC or Accuracy | PR-AUC & Recall@FPR=1% | Robust against 99.8% class imbalance |
| **Actioning** | Binary threshold (e.g. $p > 0.5$) | 4-tier Constrained Cost Optimizer | Minimizes expected dollar loss & investigator fatigue |
| **Features** | Static tabular attributes | Tabular + Dynamic Temporal Graph | Captures mule rings and velocity spikes |
| **Calibration** | Uncalibrated raw outputs | Isotonic Calibrated Posterior $P(Y=1 \mid X)$ | Mathematically sound input for decision equations |
| **Audit Trail** | Ephemeral log messages | SHA-256 Tamper-Evident Evidence Receipts | Full regulatory audit compliance (GDPR Art 22) |
