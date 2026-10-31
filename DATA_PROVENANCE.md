# AEGIS-Fraud X — Data Provenance

## 1. Synthetic benchmark population (primary development dataset)

- **Source:** `packages/data/synthetic.py::SyntheticTransactionGenerator`,
  seed 42, 10,000 transactions, 1.99% fraud, deterministic.
- **Nature:** SIMULATED. Realistic Benford amounts, burstiness, velocities,
  mule rings — but synthetic. Never presented as external validation.
- **Manifest:** `datasets/manifests/synthetic_10k_manifest.json`
  (counts, prevalence, split sizes, checksum).

## 2. ULB Credit Card Fraud Detection (external validation — acquired)

- **Identity:** "creditcard", OpenML dataset **1597**
  (https://www.openml.org/d/1597), public mirror of the original ULB/Worldline
  release (Dal Pozzolo et al.). Verified against the original's published
  profile: 284,807 rows, 492 frauds (0.173%), 31 columns (Time, V1–V28 PCA
  components, Amount, Class).
- **Acquisition date:** 2026-10-31. File: `datasets/external/creditcard.arff`
  (gitignored; 150,829,308 bytes).
- **SHA-256 (ARFF):**
  `fdaf12730dc1fc426f318b71349f24f5c5fd00aa1152940be7e7509ae3d89d2a`
- **Converted CSV:** `datasets/external/creditcard.csv` (gitignored),
  regenerated deterministically from the ARFF by `scripts/run_ulb_evaluation.py`.
- **License/privacy:** released for research use; PCA features are anonymized
  and contain no direct personal data. Raw files stay out of version control.
- **Audit:** 0 missing values; 1,081 exact duplicate rows (dropped pre-split);
  `Time` is seconds-since-first-transaction (chronological order).
- **Known limitation:** 48 hours of European card data; no entity identifiers,
  so graph features are NOT used (and must not be fabricated).

## 3. PaySim (external validation — BLOCKED, honestly recorded)

- **Identity:** PaySim mobile-money simulator (Lopez-Rojas et al.),
  ~6.3M transactions.
- **Blocker:** the dataset is distributed via Kaggle
  (`ealaxi/paysim`) and requires Kaggle account/API credentials. No public
  mirror was available at acquisition time (OpenML returns no results).
- **What exists instead:** a tested adapter
  (`packages/data/adapters/paysim.py`) pinned by contract tests with
  schema-valid fixture files (`tests/unit/test_dataset_adapters.py`) — the
  fixtures are labeled fixtures, NOT the dataset. To unblock: download
  `paysim.csv` via Kaggle, place it in `datasets/external/`, and run the
  evaluation protocol.
- **No PaySim results are claimed anywhere in this repository.**

## 4. Data-handling rules (enforced by tests and review)

- Raw external data is never committed (`.gitignore`: `datasets/external/*`).
- Adapters validate schemas and reject malformed input
  (`FileNotFoundError` / `ValueError`) rather than coercing silently.
- ULB pseudo-IDs are unique per row — no fabricated recurring entities.
- Duplicates are dropped before splitting (leakage guard).
- Every benchmark artifact records its dataset manifest and provenance.
