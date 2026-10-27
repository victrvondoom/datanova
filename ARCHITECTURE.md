# AEGIS-Fraud X — System Architecture Specification

## 1. Executive Summary
**AEGIS-Fraud X** is an enterprise-grade, research-defensible payment fraud prevention platform combining **tabular gradient boosting**, **temporal graph feature engineering**, **probability calibration**, **cost-aware operational policy optimization**, and **cryptographically verifiable explainability**.

```
+----------------------------------------------------------------------------------------------------+
|                                    INCOMING PAYMENT STREAM                                         |
|                       (Card, Wire, P2P, ACH, Mobile Wallet, Synthetic Replay)                       |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                 1. DATA ADAPTER & SCHEMA VALIDATOR                                 |
|            - Pydantic v2 Schema Enforcement          - Temporal Ordering Validator                 |
|            - Zero Lookahead Sanitization             - Source Provenance Tracker                   |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                 2. DUAL-STREAM FEATURE EXTRACTION                                  |
|   +-----------------------------------------------+   +------------------------------------------+ |
|   |         A. Temporal Tabular Pipeline          |   |       B. Temporal Graph Ego-Net          | |
|   | - Sliding window velocity (1h, 6h, 24h, 7d)   |   | - Dynamic bipartite account-device graph | |
|   | - Amount z-score relative to user history     |   | - 2-hop in/out-degree & transitivity     | |
|   | - Category risk & geographic distance         |   | - Mule ring & cycle detection heuristics | |
|   +-----------------------------------------------+   +------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                  3. ENSEMBLE SCORING & CALIBRATION                                 |
|   - Baseline Rules -> Logistic Regression -> LightGBM -> XGBoost -> Calibrated Risk Estimator       |
|   - Non-parametric Isotonic Regression / Platt Scaling on strict Validation fold                   |
|   - Real-time P(Fraud | x) with uncertainty estimate                                               |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                              4. COST-AWARE OPERATIONAL POLICY OPTIMIZER                            |
|   - Objective: min E[Fraud Loss] + Cost(Investigation) + Cost(Friction)                            |
|   - Constraints: FPR <= FPR_max, Hourly Investigator Capacity <= K                                 |
|   - Multi-Action Dispatch:                                                                         |
|         * [ALLOW]           p < tau_allow                                                          |
|         * [CHALLENGE / OTP] tau_allow <= p < tau_review                                            |
|         * [MANUAL REVIEW]   tau_review <= p < tau_block (bounded by capacity)                      |
|         * [HARD BLOCK]      p >= tau_block                                                         |
+----------------------------------------------------------------------------------------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
+-------------------------------------------------+ +------------------------------------------------+
|       5. EXPLAINABILITY & AUDIT RECEIPT         | |       6. DRIFT MONITORING & ADVERSARIAL LAB    |
| - Fast TreeSHAP local feature attributions      | | - Population Stability Index (PSI)             |
| - Counterfactual explanation distance           | | - Wasserstein distance across sliding windows  |
| - SHA-256 cryptographically verifiable receipt  | | - Delayed chargeback simulation                |
+-------------------------------------------------+ +------------------------------------------------+
                         \                                                 /
                          \                                               /
                           v                                             v
+----------------------------------------------------------------------------------------------------+
|                                7. FASTAPI ASGI & MISSION CONTROL UI                                |
|   - REST & Server-Sent Events (SSE) Streaming API   - React 18 + Vite + Tailwind CSS               |
|   - Live Digital Twin Side-by-Side Replay Engine    - Interactive Fraud Graph Explorer             |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Mathematical Formulations

### 2.1 Calibrated Fraud Probability
Let $x_t \in \mathbb{R}^d$ be the feature vector of transaction $t$ at time $\tau_t$. The raw model outputs an uncalibrated margin $f(x_t)$. The calibrated posterior fraud probability is obtained via an isotonic mapping $g: \mathbb{R} \to [0, 1]$ fitted on validation data $\mathcal{D}_{val}$:
$$p_t = \hat{P}(Y_t = 1 \mid x_t) = g(f(x_t))$$

### 2.2 Constrained Operational Cost Function
For an operational decision $a_t \in \{\text{Allow}, \text{Challenge}, \text{Review}, \text{Block}\}$:
$$\text{Cost}(a_t, y_t, v_t) = \begin{cases}
y_t \cdot v_t & \text{if } a_t = \text{Allow} \\
(1 - \eta_{chal}) \cdot y_t \cdot v_t + c_{chal} & \text{if } a_t = \text{Challenge} \\
c_{inv} + (1 - \eta_{inv}) \cdot y_t \cdot v_t + (1 - y_t) \cdot c_{fric} & \text{if } a_t = \text{Review} \\
(1 - y_t) \cdot c_{fric}^{block} & \text{if } a_t = \text{Block}
\end{cases}$$
where:
- $v_t$ is the transaction monetary value (USD),
- $y_t \in \{0, 1\}$ is ground-truth fraud label,
- $c_{inv}$ is the manual investigation labor cost (default: \$15.00),
- $c_{fric}$ is customer friction/drop-off cost (default: \$5.00),
- $\eta_{chal}, \eta_{inv}$ are deterrence/detection efficiencies ($\approx 0.90, 0.98$).

The policy optimizer solves:
$$\min_{\tau_{allow}, \tau_{review}, \tau_{block}} \frac{1}{N} \sum_{i=1}^N \mathbb{E}[\text{Cost}(a_i(\tau), y_i, v_i)]$$
subject to:
$$\frac{1}{N} \sum_{i=1}^N \mathbb{I}(a_i = \text{Review}) \le \frac{K}{N}, \quad \text{and} \quad \text{FPR}(\tau) \le \alpha_{max}$$

---

## 3. Package Architecture & Responsibilities

1. **`packages/data`**:
   - `schemas.py`: Unified Pydantic models for transactions, accounts, predictions, and audit receipts.
   - `synthetic.py`: Deterministic seedable generator with Benford's law amount distributions, burstiness, and synthetic mule rings.
   - `adapters/`: Adapters for ULB Credit Card, PaySim, and Synthetic datasets with strict validation.
   - `splitters.py`: Strict chronological splitting engine with zero lookahead.

2. **`packages/features`**:
   - `temporal.py`: Sliding window velocity (1h, 6h, 24h, 7d), transaction frequency, cumulative amounts.
   - `statistical.py`: Moving z-scores, category deviation, time-since-last-transaction.

3. **`packages/graph`**:
   - `network.py`: Directed multi-relational temporal graph using NetworkX (Account $\to$ Transaction $\to$ Account, Device $\to$ Account).
   - `features.py`: Node in/out degree, ego-network density, PageRank score, cyclic path heuristic.

4. **`packages/models`**:
   - `base.py`: Protocol interface for fraud classifiers.
   - `rule_based.py`: Expert heuristic baseline.
   - `classifiers.py`: Logistic Regression, Random Forest, LightGBM, and XGBoost wrappers.
   - `calibration.py`: Isotonic Regression and Temperature Scaling calibrators.

5. **`packages/optimization`**:
   - `cost_matrix.py`: Cost evaluation engine under configurable financial assumptions.
   - `optimizer.py`: Grid-search and constrained Nelder-Mead policy threshold solver.

6. **`packages/explainability`**:
   - `shap_engine.py`: Fast TreeSHAP for tree ensembles + LinearSHAP for regression.
   - `receipts.py`: SHA-256 tamper-evident JSON audit receipt generator.

7. **`packages/monitoring`**:
   - `drift.py`: PSI (Population Stability Index) and Wasserstein distance computer.
   - `stress_lab.py`: Scenarios for volume surge, delayed chargebacks, and adversarial evasion.

8. **`packages/evaluation`**:
   - `metrics.py`: PR-AUC, ROC-AUC, Brier score, ECE, Recall@FPR, bootstrap confidence intervals.
   - `reporting.py`: Markdown and JSON benchmark artifact reporter.
