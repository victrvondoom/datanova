# AEGIS-Fraud X — Architecture Decision Records (ADR)

## ADR-001: Strict Chronological Splitting (Zero Lookahead)
- **Status:** Accepted
- **Context:** Payment fraud detection models are uniquely vulnerable to lookahead bias and temporal leakage. Random k-fold cross-validation inflates PR-AUC by up to 25-40% because fraudsters frequently reuse techniques within short time windows.
- **Decision:** All datasets must be partitioned strictly chronologically: Training (earliest 60%), Validation/Calibration (next 20%), Test (latest 20%). Preprocessing transformers (scalers, encoders) must be fitted on Training ONLY.
- **Consequences:** Benchmarked metrics reflect realistic forward-looking operational conditions.

## ADR-002: Real ML Inference Over Static/Mocked Predictions
- **Status:** Accepted
- **Context:** Competition rules and ethical engineering prohibit fake or pre-baked scores.
- **Decision:** Every API endpoint calls real scikit-learn / LightGBM / XGBoost pipeline artifacts serialized to disk or trained on demand with fixed seeds. If dependencies fail, an explicit error is returned.
- **Consequences:** Ensures scientific integrity, reproducibility, and defensibility during live evaluation.

## ADR-003: Cost-Aware Decision Objective Over Raw F1 / Risk Thresholds
- **Status:** Accepted
- **Context:** Standard F1-optimal or fixed probability thresholds (e.g., $p > 0.5$) do not reflect banking reality: a \$10,000 fraudulent transaction causes 100x more damage than a \$100 transaction, while reviewing legitimate customers incurs fixed operational expense ($c_{inv} \approx \$15$) and churn-inducing friction ($c_{fric} \approx \$5$).
- **Decision:** Formalize operational action assignment (Allow, Challenge/Verify, Review, Block) as a constrained optimization problem minimizing Total Cost:
  $$\min \sum \text{FraudLoss}(a) + \text{Cost}_{inv}(a) + \text{Cost}_{fric}(a)$$
  subject to daily investigator capacity ($K$) and maximum false-positive rate ($\text{FPR}_{max}$).
- **Consequences:** AEGIS-Fraud X delivers quantified financial savings rather than disconnected classification metrics.

## ADR-004: Lightweight Local Monorepo Architecture
- **Status:** Accepted
- **Context:** Judges and evaluators must be able to run and audit the application locally without requiring expensive external cloud accounts, proprietary APIs, or mandatory Docker daemons.
- **Decision:** Python 3.12 + FastAPI + SQLite for the backend; React 18 + Vite + Tailwind CSS for the frontend. Fast local execution, zero API keys required.
- **Consequences:** Total offline reliability and zero vendor lock-in.

## ADR-005: Explainability with TreeSHAP and Hash-Chained Evidence Receipts
- **Status:** Accepted
- **Context:** Financial compliance (GDPR Article 22, FCRA, EU AI Act) requires high-stakes fraud flags to be explainable and auditable.
- **Decision:** Fast exact TreeSHAP for tree-based models, supplemented by cryptographically hashed (SHA-256) evidence receipts tying each transaction score to the exact model version, timestamp, and feature vector.
- **Consequences:** Every decision is defensible in an audit or human-in-the-loop review.
