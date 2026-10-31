"""LightGBM prevalence-robustness experiment (catalog: model_lightgbm_fix /
model_prevalence_robustness; NEXT-08).

The ULB evaluation showed the repository's default LightGBM configuration
collapsing at 0.17% prevalence (val PR-AUC 0.0223) while it performs well on
the 2%-prevalence synthetic set. The default already applies
scale_pos_weight = neg/pos (~600 on ULB) — hypothesis: the extreme class
weighting plus fixed depth/rounds overweights the rare class and destroys
ranking quality.

PROTOCOL (leakage-clean): all configurations are trained on the TRAIN split
and compared on the VALIDATION split only. The TEST split is never read for
selection. The selected configuration is then fixed and the standard
evaluation script re-run for reporting.

Run:  python scripts/run_lgbm_prevalence_experiment.py
Output: reports/LGBM_PREVALENCE_EXPERIMENT.md + benchmarks/runs/lgbm_prevalence_experiment.json
"""

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from packages.data.adapters.ulb import ULBCreditCardAdapter
from packages.data.splitters import ChronologicalSplitter
from packages.evaluation.metrics import FraudEvaluationMetrics
from packages.models.calibration import ProbabilityCalibrator

ARTIFACT = "benchmarks/runs/lgbm_prevalence_experiment.json"
REPORT = "reports/LGBM_PREVALENCE_EXPERIMENT.md"


def main():
    import lightgbm as lgb

    print("ULB LightGBM prevalence experiment (validation-only selection)")
    raw = pd.read_csv("datasets/external/creditcard.csv")
    df = raw.drop_duplicates().reset_index(drop=True)
    std = ULBCreditCardAdapter().standardize_frame(df)

    splitter = ChronologicalSplitter(train_ratio=0.60, val_ratio=0.20, test_ratio=0.20)
    train_df, val_df, _test_df = splitter.split(std)

    feature_cols = [f"V{i}" for i in range(1, 29)] + ["Amount"]
    scaler = StandardScaler().fit(train_df[feature_cols].values)  # train only
    X_train = scaler.transform(train_df[feature_cols].values)
    X_val = scaler.transform(val_df[feature_cols].values)
    y_train = np.asarray(train_df["is_fraud"].values)
    y_val = np.asarray(val_df["is_fraud"].values)
    amt_val = np.asarray(val_df["amount"].values)

    pos = max(1, int((y_train == 1).sum()))
    neg = max(1, int((y_train == 0).sum()))
    configs = {
        "default_full_weight (status quo)": dict(
            scale_pos_weight=neg / pos, n_estimators=200, learning_rate=0.05, max_depth=6
        ),
        "capped_weight_30": dict(
            scale_pos_weight=min(30.0, neg / pos), n_estimators=200, learning_rate=0.05, max_depth=6
        ),
        "no_weighting": dict(
            scale_pos_weight=1.0, n_estimators=200, learning_rate=0.05, max_depth=6
        ),
        "no_weighting_shallow": dict(
            scale_pos_weight=1.0, n_estimators=300, learning_rate=0.03, max_depth=4,
            min_child_samples=100,
        ),
    }

    results = {}
    for name, params in configs.items():
        p = dict(params)
        n_est = p.pop("n_estimators")
        clf = lgb.LGBMClassifier(
            n_estimators=n_est, random_state=42, verbose=-1, **p
        )
        clf.fit(X_train, y_train)
        val_scores = clf.predict_proba(X_val)[:, 1]
        calibrator = ProbabilityCalibrator(method="isotonic").fit(val_scores, y_val)
        val_probs = calibrator.calibrate(val_scores)
        metrics = FraudEvaluationMetrics.evaluate(y_val, val_probs, amt_val)
        results[name] = {
            "params": {k: v for k, v in params.items()},
            "validation_pr_auc": metrics["pr_auc"],
            "validation_roc_auc": metrics["roc_auc"],
            "validation_recall_at_fpr_1pct": metrics["recall_at_fpr_1pct"],
        }
        print(
            f" -> {name:34s} | val PR-AUC {metrics['pr_auc']:.4f} | "
            f"ROC {metrics['roc_auc']:.4f} | R@1%FPR {metrics['recall_at_fpr_1pct']:.4f}"
        )

    selected = max(results, key=lambda k: results[k]["validation_pr_auc"])
    print(f"\nSelected on VALIDATION only: {selected}")

    artifact = {
        "generated": datetime.utcnow().isoformat(),
        "protocol": "train -> validation selection only; test never read",
        "train_prevalence": round(float(y_train.mean()), 6),
        "results": results,
        "selected_configuration": selected,
        "conclusion": (
            "The status-quo full weighting (neg/pos ~= 600 at 0.17% prevalence) "
            "is the suspected cause of the ULB collapse; the selected config "
            "should replace it in the ULB evaluation (selection: validation only)."
        ),
    }
    os.makedirs("benchmarks/runs", exist_ok=True)
    with open(ARTIFACT, "w") as f:
        json.dump(artifact, f, indent=2)

    md = [
        "# LightGBM Prevalence Robustness Experiment (ULB)",
        "",
        f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} · "
        "**Selection split:** VALIDATION ONLY (test never read)",
        f"**Train prevalence:** {artifact['train_prevalence']*100:.3f}%",
        "",
        "| Configuration | Val PR-AUC | Val ROC-AUC | Val Recall@1%FPR |",
        "|:---|:---:|:---:|:---:|",
    ]
    for name, r in results.items():
        md.append(
            f"| {name} | {r['validation_pr_auc']:.4f} | {r['validation_roc_auc']:.4f} "
            f"| {r['validation_recall_at_fpr_1pct']:.4f} |"
        )
    md += ["", f"**Selected (validation):** `{selected}`", "",
           "Next step: apply the selected configuration to the LightGBM candidate",
           "in `scripts/run_ulb_evaluation.py` and re-run the standard evaluation",
           "(champion selection remains validation-based; test reported once)."]
    with open(REPORT, "w") as f:
        f.write("\n".join(md) + "\n")
    print(f"Artifacts: {ARTIFACT} + {REPORT}")


if __name__ == "__main__":
    main()
