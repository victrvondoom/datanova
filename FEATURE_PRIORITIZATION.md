# AEGIS-Fraud X — Feature Prioritization

PriorityScore = (Impact x Confidence x DependencyImportance) / (ImplementationCost + RiskPenalty).

Scales (documented): Impact: P0=10, P1=8, P2=6, P3=4, P4=3 (curated tier).
Confidence: verified=1.0, implemented_unverified=0.8, partial=0.7, missing=0.6,
blocked=0.3, not_applicable/unsafe/deprecated=0.2. DependencyImportance:
1 + 0.5 x (number of features depending on this one). Cost/RiskPenalty: tier-derived.
The score is a SEQUENCING heuristic, not a truth claim; P0 correctness/security
features override the numerical ranking regardless of score. Tie-break:
lower domain, then catalog order (deterministic).

## Top 40 ranked actionable features (missing/partial only)

| Rank | ID | Feature | Domain | Tier | Status | Score |
|:---:|:---|:---|:---|:---:|:---|:---:|
| 1 | AFX-F0662 | PII Inventory | D23 | P1 | missing | 4.11 |
| 2 | AFX-F0723 | Promotion Gate | D25 | P1 | partial | 4.00 |
| 3 | AFX-F0003 | Ingestion Schema Registry | D01 | P2 | partial | 3.89 |
| 4 | AFX-F0006 | Dead-Letter Queue for Invalid Events | D01 | P2 | missing | 3.33 |
| 5 | AFX-F0016 | Currency Normalization | D01 | P2 | missing | 3.33 |
| 6 | AFX-F0117 | Feature Semantic Registry | D04 | P2 | partial | 3.11 |
| 7 | AFX-F0035 | Dataset Lineage Graph | D02 | P2 | missing | 2.67 |
| 8 | AFX-F0042 | Data Freshness Markers | D02 | P2 | missing | 2.67 |
| 9 | AFX-F0299 | Review Allocation Value Model | D10 | P2 | missing | 2.67 |
| 10 | AFX-F0325 | Historical Policy Backtest | D11 | P2 | missing | 2.67 |
| 11 | AFX-F0444 | Model Cards | D15 | P2 | missing | 2.67 |
| 12 | AFX-F0525 | Decision Replay | D18 | P2 | missing | 2.67 |
| 13 | AFX-F0665 | Retention Enforcement | D23 | P2 | missing | 2.67 |
| 14 | AFX-F0032 | Source Registry | D02 | P1 | partial | 2.40 |
| 15 | AFX-F0185 | Prevalence Robustness Testing | D07 | P1 | partial | 2.40 |
| 16 | AFX-F0120 | Feature Computation Budget | D04 | P2 | partial | 2.33 |
| 17 | AFX-F0268 | Calibration Visibility in UI | D09 | P2 | partial | 2.33 |
| 18 | AFX-F0039 | Right-to-Erasure Workflow | D02 | P3 | missing | 2.18 |
| 19 | AFX-F0081 | Label-Derived Feature Scan | D03 | P1 | missing | 2.06 |
| 20 | AFX-F0122 | Train/Serve Parity Tests | D05 | P1 | missing | 2.06 |
| 21 | AFX-F0351 | Graph State Recovery | D12 | P1 | missing | 2.06 |
| 22 | AFX-F0483 | Case Queue Management | D17 | P1 | missing | 2.06 |
| 23 | AFX-F0549 | Override Workflow | D19 | P1 | missing | 2.06 |
| 24 | AFX-F0015 | Entity Resolution at Ingestion | D01 | P2 | missing | 2.00 |
| 25 | AFX-F0021 | Poison-Message Resistance | D01 | P2 | missing | 2.00 |
| 26 | AFX-F0025 | Schema Diff on Contract Change | D01 | P2 | missing | 2.00 |
| 27 | AFX-F0086 | Ground-Truth Feedback Ingestion | D03 | P2 | missing | 2.00 |
| 28 | AFX-F0217 | Reproduction Check CI | D08 | P2 | missing | 2.00 |
| 29 | AFX-F0820 | Graceful Shutdown | D28 | P2 | missing | 2.00 |
| 30 | AFX-F0004 | Kafka-Compatible Stream Ingestion | D01 | P3 | missing | 1.64 |
| 31 | AFX-F0045 | Audit Export of Provenance | D02 | P3 | missing | 1.64 |
| 32 | AFX-F0157 | Transactional Outbox | D06 | P3 | missing | 1.64 |
| 33 | AFX-F0603 | External Verification Services | D21 | P3 | missing | 1.64 |
| 34 | AFX-F0008 | PaySim Source Adapter | D01 | P1 | partial | 1.60 |
| 35 | AFX-F0023 | Event Ordering Integrity | D01 | P1 | partial | 1.60 |
| 36 | AFX-F0046 | Artifact Overwrite Protection | D02 | P1 | partial | 1.60 |
| 37 | AFX-F0058 | Data Contract Tests | D02 | P1 | partial | 1.60 |
| 38 | AFX-F0063 | Missing-Value Report | D03 | P1 | partial | 1.60 |
| 39 | AFX-F0067 | Temporal Consistency Checks | D03 | P1 | partial | 1.60 |
| 40 | AFX-F0084 | Identifier Uniqueness Audit | D03 | P1 | partial | 1.60 |
