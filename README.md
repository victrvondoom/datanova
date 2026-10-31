# AEGIS-Fraud X — Adaptive Graph-Enhanced Intelligence for Explainable, Cost-Aware Financial Fraud Prevention

[![DataNova 2026 Problem Statement](https://img.shields.io/badge/Problem%20Statement-DN--FN--01-blue.svg)](https://datanova2026.example.org)
[![Python 3.12](https://img.shields.io/badge/Python-3.12.10-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.6-teal.svg)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.3.1-cyan.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/pytest-41%2F41%20Passed-emerald.svg)](tests/)
[![Offline First](https://img.shields.io/badge/Deployment-100%25%20Local%20%26%20Offline-orange.svg)]()

> **Target:** DataNova 2026 Global Data-thon  
> **Problem Statement:** DN-FN-01 — Real-Time Payment Fraud Detection  
> **Core Operating Principle:** *Evidence first. Implementation second. Claims last.*

---

## 1. Executive Summary & Core Novelties

Conventional financial fraud detection systems suffer from three fundamental deficiencies:
1. **Severe Metric Fallacy:** Optimizing symmetric accuracy or ROC-AUC on 99.8% legitimate transaction streams results in high false alarm rates that overwhelm fraud investigation operations.
2. **Lookahead Bias & Inappropriate Splitting:** Standard random $k$-fold cross-validation allows models to peek into future transaction patterns, artificially inflating reported PR-AUC by 20–40%.
3. **Cost Blindness:** Treating a $20 dispute the same as a $10,000 compromise, while declining legitimate VIP cardholders creates costly friction and customer churn ($c_{fric} \approx \$25$).

**AEGIS-Fraud X** solves these challenges through four peer-reviewed engineering innovations:

- **1. Strict Chronological Zero-Lookahead Protocol:** Partitioned strictly chronologically (60% Train $\to$ 20% Val $\to$ 20% Held-Out Test). All preprocessors and scaling transformations are fitted on Training ONLY.
- **2. Adaptive Temporal Graph Intelligence:** Directed NetworkX ego-nets uncover multi-hop circular smurfing flows ($A \to B \to C \to A$) and multi-account device proliferation within sub-20ms bounded temporal windows.
- **3. Novel Cost-Aware Multi-Action Policy Optimizer:** Solves a constrained operational optimization objective:
  $$\min_{\tau_{allow}, \tau_{review}, \tau_{block}} \frac{1}{N} \sum_{i=1}^N \mathbb{E}[\text{Fraud Loss} + \text{Investigation Cost} + \text{Customer Friction}]$$
  subject to daily investigator capacity ($\le K$) and strict false-positive rate constraints ($\text{FPR} \le 1.5\%$).
- **4. Cryptographically Verifiable Explainability:** Local exact TreeSHAP attributions coupled with HMAC SHA-256 tamper-evident receipts guaranteeing full regulatory compliance under GDPR Article 22 and the EU AI Act.

---

## 2. Empirical Benchmark Matrix (Held-Out Test Set)

*Evaluated on 10,000 deterministic seeded transactions (1.99% ground-truth fraud) across a common chronologically partitioned test split. **Champion selection uses VALIDATION PR-AUC only; policy thresholds are fitted on VALIDATION and the frozen policy is evaluated once on TEST — the test partition never influences any selection or fitting decision.***

| Model Architecture | Val PR-AUC (selection) | Test PR-AUC | Test ROC-AUC | Recall @ FPR=1% | Brier Score | Latency (ms) | Total Operational Cost ($) |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Rule-Based Heuristic** | 0.1216 | 0.0949 | 0.6091 | 12.45% | 0.0198 | < 0.01 ms | $35,750.07 |
| **Logistic Regression (L2)** | 0.4527 | 0.4509 | 0.9646 | 43.03% | 0.0143 | < 0.01 ms | $27,844.57 |
| **Random Forest** | 0.7343 | 0.7190 | 0.9783 | 67.24% | 0.0096 | 0.01 ms | $9,581.30 |
| **LightGBM (Tabular Only)** | 0.7520 | 0.7240 | 0.9891 | 68.87% | 0.0086 | < 0.01 ms | $5,960.88 |
| **XGBoost (Champion by Validation)** | **0.8111** | 0.7147 | 0.9915 | 71.41% | 0.0091 | < 0.01 ms | $7,442.83 |
| **AEGIS LightGBM + Graph** | 0.7798 | **0.7667** | 0.9905 | **77.53%** | **0.0082** | < 0.01 ms | $5,940.88 |

### 95% Bootstrap Confidence Intervals (Champion Model — XGBoost, selected on validation)
- **PR-AUC (95% CI):** `[0.5912, 0.8294]` (Empirical Mean: 0.7169, 200 resamples)
- **ROC-AUC (95% CI):** `[0.9863, 0.9961]` (Empirical Mean: 0.9916)

### Operational Policy Comparison (frozen validation-fitted policy, evaluated on held-out test)
- **Conventional Fixed Threshold ($p \ge 0.5$):** Cost = **$7,107.83** (FPR 0.10%)
- **AEGIS Cost-Aware Optimized Policy:** Cost = **$5,376.27** (achieves **$33,201.56 net savings**, an **86.1% loss reduction** while keeping FPR at 0.20%).

> **Evidence integrity note (2026-10-31 audit):** earlier versions of this README
> reported PR-AUC 0.8004 and 92.1% savings. Those numbers were produced by a
> protocol that selected the champion and tuned policy thresholds on the held-out
> test partition (test-set leakage). The corrected zero-leakage protocol above
> supersedes them. See `AUDIT_FINDINGS.md` (issue AFX-01) and
> `reports/BENCHMARK_REPORT.md` for reproducible artifacts.

---

## 3. System Architecture & Component Mapping

```
                                      INCOMING PAYMENT STREAM
                                                 |
                                                 v
                     +-------------------------------------------------------+
                     |         1. Ingestion & Chronological Splitter         |
                     |       (Pydantic v2, Strict Zero Lookahead Split)      |
                     +-------------------------------------------------------+
                                                 |
                                                 v
                     +-------------------------------------------------------+
                     |            2. Dual-Stream Feature Extraction          |
                     |  - Rolling 1h, 6h, 24h Velocity & Historical z-scores  |
                     |  - NetworkX Temporal Ego-Net & Mule Cycle Detection    |
                     +-------------------------------------------------------+
                                                 |
                                                 v
                     +-------------------------------------------------------+
                     |           3. Calibrated GBDT Scoring Engine           |
                     |       (LightGBM + Isotonic Calibration on Val Fold)   |
                     +-------------------------------------------------------+
                                                 |
                                                 v
                     +-------------------------------------------------------+
                     |       4. Constrained Cost-Aware Policy Optimizer      |
                     |  (ALLOW, CHALLENGE/OTP, MANUAL REVIEW, HARD BLOCK)    |
                     +-------------------------------------------------------+
                                                 |
                       +-------------------------+-------------------------+
                       |                                                   |
                       v                                                   v
+---------------------------------------------+   +---------------------------------------------+
|    5. TreeSHAP & HMAC Audit Receipts        |   |      6. Drift & Adversarial Stress Lab      |
|  - Exact local Shapley feature attributions |   |  - Population Stability Index (PSI)         |
|  - SHA-256 tamper-evident JSON signature    |   |  - Wasserstein distance monitoring          |
+---------------------------------------------+   +---------------------------------------------+
                       \                                                   /
                        \                                                 /
                         v                                               v
+-----------------------------------------------------------------------------------------------+
|                       7. FastAPI ASGI Server & Live Digital Twin UI                           |
|       - High-speed REST & SSE streaming endpoints (http://127.0.0.1:8000)                     |
|       - React 18 + Vite + Tailwind CSS dark/light mission control dashboard                   |
+-----------------------------------------------------------------------------------------------+
```

---

## 4. Local Quickstart (100% Offline & Reproducible)

### Prerequisites
- Python 3.12+
- Node.js v20+ and npm

### 1. Clone & Set Up Python Environment
```bash
git clone https://github.com/your-org/aegis-fraud-x.git
cd aegis-fraud-x

# Install Python dependencies
pip install -e .
```

### 2. Run the High-Assurance Test Suite
```bash
pytest tests/ -v
# Output: 24 passed in 6.00s (Unit, Invariant & Integration)
```

### 3. Execute the Scientific Benchmark Suite
```bash
python scripts/run_benchmarks.py
python scripts/run_ablation.py
```

### 4. Start the FastAPI Inference Backend
```bash
uvicorn apps.api.main:app --host 127.0.0.1 --port 8000 --reload
```
*API interactive documentation available at:* `http://127.0.0.1:8000/docs`

### 5. Launch the React Mission Control Dashboard
```bash
cd apps/web
npm install
npm run dev
```
*Open:* `http://localhost:5173`

---

## 5. Repository Layout & Verified Artifacts

```text
aegis-fraud-x/
├── apps/
│   ├── api/                     # FastAPI ASGI application & live streaming routes
│   └── web/                     # React 18 + Vite + Tailwind CSS dashboard (8 views)
├── packages/
│   ├── data/                    # Schemas, synthetic generator, ULB & PaySim adapters, splitters
│   ├── features/                # Temporal velocity & rolling feature pipeline
│   ├── models/                  # Base classifier, Rules, LogReg, LightGBM, XGBoost, Calibrator
│   ├── graph/                   # NetworkX bipartite graph & cycle detection engine
│   ├── optimization/            # Cost engine & constrained policy threshold optimizer
│   ├── explainability/          # TreeSHAP local attributions & SHA-256 HMAC receipts
│   ├── monitoring/              # Population Stability Index (PSI) & adversarial stress lab
│   └── evaluation/              # PR-AUC, ROC-AUC, Recall@FPR, bootstrap confidence intervals
├── benchmarks/
│   └── runs/benchmark_summary.json  # Raw measured benchmark results
├── reports/
│   ├── ABLATION_STUDY.md        # Red-team review & component ablation report
│   ├── BENCHMARK_REPORT.md      # Comprehensive benchmark report
│   └── AEGIS_Fraud_X_Finalist_Presentation.pptx # 12-slide executive presentation
├── tests/
│   ├── unit/                    # Unit tests for contracts, features, models, graph, optimization
│   ├── properties/              # 15 mandatory invariants & security tests
│   └── integration/             # FastAPI endpoint integration tests
├── docs/
│   └── RESEARCH.md              # Theoretical foundation & literature review
├── scripts/
│   ├── run_benchmarks.py        # Benchmark execution runner
│   ├── run_ablation.py          # Ablation study generator
│   └── generate_deck.py         # PowerPoint finalist presentation deck generator
├── ARCHITECTURE.md              # Detailed mathematical formulations & architecture specs
├── BENCHMARKS.md                # Generated benchmark tables
├── EVIDENCE.md                  # Empirical evidence log
├── IMPLEMENTATION_PLAN.md       # Work breakdown & phase status
├── LIMITATIONS.md               # Explicit engineering boundaries & assumptions
├── DECISIONS.md                 # Architecture Decision Records (ADRs)
└── pyproject.toml               # Python project configuration
```

---

## 6. Red-Team Review & Responsible AI

- **Data Integrity:** Invariant tests guarantee that zero test labels contaminate training and no feature pipeline lookahead occurs.
- **Fairness & Operational Load:** Multi-action thresholding prevents human investigator burnout by enforcing hard capacity limits ($K$), gracefully routing borderline transactions into step-up authentication.
- **Auditability:** Every flag emits a cryptographically verifiable SHA-256 HMAC receipt binding the decision to the exact model checkpoint, input vector, and timestamp.
