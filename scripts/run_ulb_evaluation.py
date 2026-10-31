"""Zero-leakage external evaluation on the ULB Credit Card Fraud dataset.

Dataset: ULB Credit Card Fraud Detection (Dal Pozzolo et al., ULB / Worldline),
284,807 European card transactions over 48 hours, 492 frauds (0.173%).
Acquired from OpenML dataset 1597 ("creditcard", ARFF), which mirrors the
original Kaggle release one-to-one (same rows, class counts, and schema).

Protocol (identical leakage protections as the synthetic benchmark):
- Rows are chronologically ordered by 'Time' (seconds since first transaction).
- Exact duplicate rows are DROPPED before splitting (duplicate leakage guard).
- 'Time' is used ONLY as the chronological split key, never as a feature:
  future timestamps never appear in training, and index-like features would
  leak partition identity.
- Features: V1..V28 (PCA components) + Amount, standardized with a scaler
  fitted on the TRAINING partition only.
- NO graph or entity features: ULB is fully anonymized with no account or
  merchant identifiers, and the adapter deliberately assigns unique
  pseudo-IDs so no relationships can be fabricated.
- Champion selection by VALIDATION PR-AUC; isotonic calibration fitted on
  validation; exact policy optimizer fitted on validation; the frozen policy
  is evaluated once on the held-out test partition.

Run:  python scripts/run_ulb_evaluation.py
Outputs:
- benchmarks/runs/ulb_evaluation.json
- reports/ULB_EVALUATION.md
"""

import hashlib
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pandas as pd
from sklearn.preprocessing import StandardScaler

from packages.data.adapters.ulb import ULBCreditCardAdapter
from packages.data.splitters import ChronologicalSplitter
from packages.evaluation.bootstrap import BootstrapConfidenceEvaluator
from packages.evaluation.metrics import FraudEvaluationMetrics
from packages.models.calibration import ProbabilityCalibrator
from packages.models.classifiers import (
    LightGBMFraudModel,
    LogisticRegressionFraudModel,
    RandomForestFraudModel,
    XGBoostFraudModel,
)
from packages.optimization.cost_engine import CostEngine
from packages.optimization.optimizer import PolicyOptimizer

ARFF_PATH = "datasets/external/creditcard.arff"
ARTIFACT_PATH = "benchmarks/runs/ulb_evaluation.json"
REPORT_PATH = "reports/ULB_EVALUATION.md"

# Economic assumption for the cost analysis: ULB amounts are in EUR; we treat
# them as USD-equivalent for the simulated cost model. This is a modeling
# assumption, NOT a realized saving.
CURRENCY_NOTE = (
    "ULB amounts are EUR. The cost analysis treats amounts as USD-equivalent; "
    "all dollar figures are simulated operating costs under the documented "
    "cost model, not realized bank savings."
)


def audit_dataset(df_raw: pd.DataFrame) -> dict:
    """Data-quality and leakage audit on the raw ULB frame."""
    full_dupes = int(df_raw.duplicated().sum())
    feature_cols = [c for c in df_raw.columns if c.startswith("V") or c == "Amount"]
    dupes_excl_label = int(df_raw.duplicated(subset=feature_cols).sum())
    return {
        "record_count": int(len(df_raw)),
        "fraud_count": int(df_raw["Class"].sum()),
        "prevalence": round(float(df_raw["Class"].mean()), 6),
        "missing_values": int(df_raw.isna().sum().sum()),
        "exact_duplicate_rows": full_dupes,
        "duplicate_feature_vectors": dupes_excl_label,
        "duplicate_policy": (
            "Exact duplicate rows are dropped before splitting to prevent "
            "train-to-test duplicate leakage (duplicate feature vectors with "
            "conflicting labels are retained as genuine ambiguous cases)."
        ),
        "timestamp_semantics": (
            "'Time' = seconds elapsed since the first transaction; rows arrive "
            "in chronological order, enabling a strict chronological split."
        ),
        "entity_identifiers": (
            "None. ULB is PCA-anonymized card data; no graph features are used."
        ),
    }


def main():
    print("=" * 70)
    print("AEGIS-Fraud X — ULB External Evaluation (Zero-Lookahead Protocol)")
    print("=" * 70)

    adapter = ULBCreditCardAdapter()
    if not adapter.is_available():
        print(
            "ULB dataset not found. Place creditcard.csv (or the OpenML ARFF) in "
            "datasets/external/ first. Acquisition: OpenML dataset 1597."
        )
        sys.exit(2)

    # ------------------------------------------------------------- provenance
    sha = hashlib.sha256(open(ARFF_PATH, "rb").read()).hexdigest() if os.path.exists(ARFF_PATH) else None

    raw = pd.read_csv("datasets/external/creditcard.csv")
    audit = audit_dataset(raw)

    # Drop exact duplicates (leakage guard)
    df = raw.drop_duplicates().reset_index(drop=True)

    # Standardize the IN-MEMORY deduplicated frame via the adapter (single
    # canonical transformation; no re-read, no misalignment).
    std = adapter.standardize_frame(df)
    audit["rows_after_dedup"] = int(len(std))
    print(
        f"Rows: {audit['record_count']:,} -> {audit['rows_after_dedup']:,} after dedup | "
        f"fraud {int(std['is_fraud'].sum()):,} ({std['is_fraud'].mean() * 100:.3f}%)"
    )

    # ------------------------------------------------------------ split
    splitter = ChronologicalSplitter(train_ratio=0.60, val_ratio=0.20, test_ratio=0.20)
    train_df, val_df, test_df = splitter.split(std)
    print(f"Chronological split: train {len(train_df):,} | val {len(val_df):,} | test {len(test_df):,}")

    feature_cols = [f"V{i}" for i in range(1, 29)] + ["Amount"]
    X_train_raw = train_df[feature_cols].values
    X_val_raw = val_df[feature_cols].values
    X_test_raw = test_df[feature_cols].values

    # Scaler fitted on TRAIN only (zero lookahead)
    scaler = StandardScaler().fit(X_train_raw)
    X_train = scaler.transform(X_train_raw)
    X_val = scaler.transform(X_val_raw)
    X_test = scaler.transform(X_test_raw)

    y_train = train_df["is_fraud"].values
    y_val = val_df["is_fraud"].values
    y_test = test_df["is_fraud"].values
    amt_val = val_df["amount"].values
    amt_test = test_df["amount"].values

    # ------------------------------------------------------------ models
    models = {
        "Logistic Regression": LogisticRegressionFraudModel(),
        "Random Forest": RandomForestFraudModel(n_estimators=100),
        "LightGBM (repo default)": LightGBMFraudModel(n_estimators=200),
        # Validation-selected for ~0.17% prevalence (see
        # reports/LGBM_PREVALENCE_EXPERIMENT.md; selection on VALIDATION only)
        "LightGBM (prevalence-tuned)": LightGBMFraudModel(
            n_estimators=300,
            learning_rate=0.03,
            max_depth=4,
            min_child_samples=100,
            class_weighting="none",
        ),
        "XGBoost": XGBoostFraudModel(n_estimators=200),
    }

    results = {}
    artifacts = {}
    val_pr_aucs = {}
    for name, model in models.items():
        model.fit(X_train, y_train, feature_names=feature_cols)
        val_raw = model.predict_proba(X_val)
        calibrator = ProbabilityCalibrator(method="isotonic").fit(val_raw, y_val)
        test_probs = calibrator.calibrate(model.predict_proba(X_test))

        val_probs = calibrator.calibrate(val_raw)
        val_metrics = FraudEvaluationMetrics.evaluate(y_val, val_probs, amt_val)
        test_metrics = FraudEvaluationMetrics.evaluate(y_test, test_probs, amt_test)

        results[name] = {
            "validation_pr_auc": val_metrics["pr_auc"],
            "test_pr_auc": test_metrics["pr_auc"],
            "test_roc_auc": test_metrics["roc_auc"],
            "test_recall_at_fpr_1pct": test_metrics["recall_at_fpr_1pct"],
            "test_brier": test_metrics["brier_score"],
            "test_ece": test_metrics["expected_calibration_error"],
        }
        artifacts[name] = (model, calibrator)
        val_pr_aucs[name] = val_metrics["pr_auc"]
        print(
            f" -> {name:22s} | val PR-AUC {val_metrics['pr_auc']:.4f} | "
            f"test PR-AUC {test_metrics['pr_auc']:.4f} | "
            f"recall@1%FPR {test_metrics['recall_at_fpr_1pct']:.4f}"
        )

    champion_name = max(val_pr_aucs, key=lambda k: val_pr_aucs[k])
    champion_model, champion_calibrator = artifacts[champion_name]
    print(f"Champion (validation-selected): {champion_name}")

    # ------------------------------------------------------------ policy
    champ_val_probs = champion_calibrator.calibrate(champion_model.predict_proba(X_val))
    champ_test_probs = champion_calibrator.calibrate(champion_model.predict_proba(X_test))

    optimizer = PolicyOptimizer()
    cost_engine = CostEngine()
    frozen_policy, fit_metrics = optimizer.optimize_policy(champ_val_probs, amt_val, y_val)
    frozen_test = cost_engine.evaluate_policy_batch(champ_test_probs, amt_test, y_test, frozen_policy)

    fixed_policy = type(frozen_policy)(
        policy_name="Fixed-Threshold (p>=0.5)", tau_allow=0.5, tau_review=0.5, tau_block=0.5, use_challenge=False
    )
    fixed_test = cost_engine.evaluate_policy_batch(champ_test_probs, amt_test, y_test, fixed_policy)

    # ------------------------------------------------------------ uncertainty
    bootstrap_eval = BootstrapConfidenceEvaluator(n_bootstraps=200, random_seed=42)
    ci = bootstrap_eval.compute_intervals(y_test, champ_test_probs, amt_test)

    # ------------------------------------------------------------ artifact
    artifact = {
        "evaluation": "ULB_CREDIT_CARD_EXTERNAL",
        "generated": datetime.utcnow().isoformat(),
        "provenance": {
            "dataset": "ULB Credit Card Fraud Detection (Dal Pozzolo et al., ULB/Worldline)",
            "source": "OpenML dataset 1597 (creditcard), ARFF mirror of the Kaggle release",
            "source_url": "https://www.openml.org/d/1597",
            "acquisition_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "arff_sha256": sha,
            "license_note": (
                "Made available for research use per the dataset's public release; "
                "PCA features are anonymized and contain no direct personal data."
            ),
            "currency_note": CURRENCY_NOTE,
        },
        "dataset_audit": audit,
        "protocol": {
            "split": "Strict chronological 60/20/20 on 'Time'",
            "duplicate_handling": "exact duplicates dropped pre-split",
            "features": "V1..V28 + Amount (Time excluded as split key)",
            "scaler": "StandardScaler fitted on training partition only",
            "graph_features": "not applicable (anonymized, no entities)",
            "champion_selection": "validation PR-AUC",
            "calibration": "isotonic fitted on validation",
            "policy": "exact optimizer fitted on validation, frozen test evaluation",
        },
        "model_results": results,
        "champion_model_name": champion_name,
        "champion_confidence_intervals_95": ci,
        "policy_comparison": {
            "fixed_threshold_baseline": {
                "policy": fixed_policy.model_dump(),
                "metrics": fixed_test,
            },
            "aegis_cost_optimized": {
                "policy": frozen_policy.model_dump(),
                "metrics": frozen_test,
            },
        },
        "champion_validation_scores": {
            "probs": [round(float(v), 6) for v in champ_val_probs],
            "amounts": [round(float(v), 2) for v in amt_val],
            "labels": [int(v) for v in y_val],
        },
    }

    os.makedirs("benchmarks/runs", exist_ok=True)
    with open(ARTIFACT_PATH, "w") as f:
        json.dump(artifact, f, indent=2, default=str)

    # ------------------------------------------------------------ report
    md = f"""# AEGIS-Fraud X — ULB Credit Card External Evaluation

**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
**Dataset:** ULB Credit Card Fraud Detection (284,807 rows; 492 fraud, 0.173%)
**Source:** OpenML dataset 1597 (public mirror of the original release)
**Source ARFF SHA-256:** `{sha}`

{CURRENCY_NOTE}

## 1. Dataset audit (leakage findings)

| Check | Result |
|:---|:---|
| Records | {audit['record_count']:,} |
| Fraud | {audit['fraud_count']:,} ({audit['prevalence'] * 100:.3f}%) |
| Missing values | {audit['missing_values']} |
| Exact duplicate rows (dropped pre-split) | {audit['exact_duplicate_rows']:,} |
| Duplicate feature vectors (retained) | {audit['duplicate_feature_vectors']:,} |
| Rows after dedup | {audit['rows_after_dedup']:,} |
| Entity identifiers | None — no graph features used |

## 2. Model comparison (champion selected on VALIDATION PR-AUC)

| Model | Val PR-AUC | Test PR-AUC | Test ROC-AUC | Recall@1%FPR | Brier | ECE |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
"""
    for name, m in results.items():
        md += (
            f"| {name} | {m['validation_pr_auc']:.4f} | {m['test_pr_auc']:.4f} | "
            f"{m['test_roc_auc']:.4f} | {m['test_recall_at_fpr_1pct']:.4f} | "
            f"{m['test_brier']:.4f} | {m['test_ece']:.4f} |\n"
        )
    md += f"""
**Champion (validation-selected):** `{champion_name}`

95% bootstrap CI (test): PR-AUC [{ci['pr_auc']['ci_lower']:.4f}, {ci['pr_auc']['ci_upper']:.4f}],
ROC-AUC [{ci['roc_auc']['ci_lower']:.4f}, {ci['roc_auc']['ci_upper']:.4f}]

## 3. Frozen-policy operational comparison (held-out test)

| Regime | tau (allow/review/block) | FPR | Total Cost | Savings vs unmitigated |
|:---|:---:|:---:|:---:|:---:|
| Fixed p>=0.5 | {fixed_policy.tau_allow:.2f}/{fixed_policy.tau_review:.2f}/{fixed_policy.tau_block:.2f} | {fixed_test['false_positive_rate'] * 100:.2f}% | ${fixed_test['total_cost']:,.2f} | {fixed_test['savings_ratio'] * 100:.1f}% |
| Exact cost-aware (fitted on validation) | {frozen_policy.tau_allow:.2f}/{frozen_policy.tau_review:.2f}/{frozen_policy.tau_block:.2f} | {frozen_test['false_positive_rate'] * 100:.2f}% | ${frozen_test['total_cost']:,.2f} | {frozen_test['savings_ratio'] * 100:.1f}% |

Policy action mix (test): {json.dumps(frozen_test['action_counts'])}

## 4. Limitations

- ULB is 48 hours of European card data; temporal generalization over months is untested.
- No entity/graph features exist in ULB; graph components of AEGIS are not exercised here.
- Prevalence 0.173% means validation-set calibration support is thin
  (~{int(y_val.sum())} fraud cases in validation); isotonic calibration is
  correspondingly coarse.
- All cost figures are simulated under documented assumptions (see header).
"""
    os.makedirs("reports", exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        f.write(md)

    print(f"\nArtifacts: {ARTIFACT_PATH} + {REPORT_PATH}")


if __name__ == "__main__":
    main()
