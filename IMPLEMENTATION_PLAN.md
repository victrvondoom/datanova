# AEGIS-Fraud X — Master Implementation Plan

**Problem Statement:** DN-FN-01 — Real-Time Payment Fraud Detection  
**Target:** DataNova 2026 Global Data-thon  
**Core Mission:** Adaptive Graph-Enhanced Intelligence for Explainable, Cost-Aware Financial Fraud Prevention  

---

## 1. System Philosophy & Non-Negotiables
- **Evidence First, Implementation Second, Claims Last.**
- **No Mock Inference:** Every prediction is computed by a real, calibrated model with real weights.
- **Strict Data Integrity:** Temporal train/val/test splits, zero lookahead leakage, test sets reserved exclusively for final unbiased evaluation.
- **Cost-Awareness:** Minimize $\text{Expected Fraud Loss} + \text{Investigation Cost} + \text{Customer Friction Cost}$ subject to capacity constraints.
- **Explainability:** SHAP feature attribution & decision logic receipts with cryptographic checksums.

---

## 2. Work Breakdown & Phase Mapping

| Phase | Description | Priority | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Repo initialization, Git setup, Monorepo structure, Tooling validation | P0 | In Progress |
| **Phase 1** | Scientific Research, Schemas, Dataset Adapters (ULB, PaySim, Synthetic) | P0 | Scheduled |
| **Phase 2** | Reproducible Baseline Classifiers (Rules, LogReg, RF, LightGBM, XGBoost) & Benchmarking | P0 | Scheduled |
| **Phase 3** | Adaptive Temporal Graph Features & Graph Ablation Engine | P2 | Scheduled |
| **Phase 4** | Cost-Aware Decision Optimizer & Policy Frontier Engine | P1 | Scheduled |
| **Phase 5** | Fraud Drift, Adversarial Robustness & Concept Shift Monitoring Lab | P2 | Scheduled |
| **Phase 6** | Explainability Engine (SHAP, Audit Trail, Cryptographic Receipts) | P2 | Scheduled |
| **Phase 7** | Premium React + Vite + Tailwind Enterprise Full-Stack Application | P0 | Scheduled |
| **Phase 8** | Live Digital Twin & Streaming Transaction Replay Engine | P2 | Scheduled |
| **Phase 9** | High-Assurance Test Harness (Unit, Invariant, Property, Security, Integration) | P0 | Scheduled |
| **Phase 10** | Independent Red-Team Benchmark & Ablation Study (`reports/ABLATION_STUDY.md`) | P1 | Scheduled |
| **Phase 11** | Submission Materials: README, Model Cards, PPTX Slide Deck, Architecture Docs | P3 | Scheduled |
| **Phase 12** | Continuous Execution Tracking (`PROGRESS.md`, `EVIDENCE.md`, `DECISIONS.md`, `LIMITATIONS.md`) | Continuous | Active |

---

## 3. Directory Layout
```text
aegis-fraud-x/
├── apps/
│   ├── web/                     # React 18 + Vite + Tailwind CSS + Lucide Icons + Recharts
│   └── api/                     # FastAPI ASGI application, streaming endpoints, health checks
├── packages/
│   ├── data/                    # Schemas, dataset adapters (ULB, PaySim, Synthetic), validators
│   ├── features/                # Temporal velocity, rolling windows, entity aggregations
│   ├── models/                  # BaseClassifier, RuleEngine, LogisticRegression, LightGBM, XGBoost, Calibrator
│   ├── graph/                   # NetworkX bipartite & multi-hop transaction graph, velocity & cycle metrics
│   ├── optimization/            # Cost-aware threshold optimizer, constraint solver, policy frontier
│   ├── explainability/          # SHAP explainer, counterfactual hints, audit receipt generator
│   ├── monitoring/              # Population Stability Index (PSI), Wasserstein drift, alert triggers
│   └── evaluation/              # PR-AUC, ROC-AUC, Recall@FPR, Expected Cost, Bootstrap CIs
├── experiments/                 # Reproducible experiment configurations and checkpoints
├── benchmarks/                  # Raw benchmark runs, execution logs, timing profiles
├── datasets/
│   ├── synthetic/               # Deterministic seedable generator outputs
│   ├── external/                # Storage for external datasets (ULB, PaySim) - gitignored
│   └── manifests/               # Hash verification manifests and dataset metadata
├── tests/
│   ├── unit/                    # Unit tests for packages and modules
│   ├── integration/             # End-to-end API and pipeline integration tests
│   ├── properties/              # Property & invariant tests (no lookahead, capacity constraints)
│   ├── security/                # Input validation, sanitization, path traversal tests
│   └── e2e/                     # End-to-end user journey tests
├── docs/                        # Research foundation, methodology, mathematical formulations
├── reports/                     # Model cards, ablation studies, benchmark reports
├── scripts/                     # Benchmark runners, training scripts, replay simulators
└── infra/                       # Dockerfile, docker-compose, CI workflows
```
