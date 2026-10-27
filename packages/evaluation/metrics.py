"""
Evaluation Metrics & Benchmark Engine for Fraud Detection.
Calculates:
- Average Precision (PR-AUC) & ROC-AUC
- Recall at strict fixed False Positive Rates (Recall@FPR=1.0%, Recall@FPR=0.1%)
- Precision@K & Recall@K
- Confusion matrix (TP, FP, TN, FN)
- Brier Score & Expected Calibration Error (ECE)
- Modeled Financial Loss & Operational Cost
"""

from typing import Dict, List, Optional, Tuple
import numpy as np
from sklearn.metrics import (
    average_precision_score,
    roc_auc_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_curve,
    precision_recall_curve,
)

from packages.data.schemas import CostConfiguration
from packages.models.calibration import ProbabilityCalibrator


class FraudEvaluationMetrics:
    """Computes comprehensive scientific and operational metrics for fraud classifiers."""

    @staticmethod
    def evaluate(
        y_true: np.ndarray,
        y_prob: np.ndarray,
        amounts: Optional[np.ndarray] = None,
        threshold: float = 0.5,
        cost_config: Optional[CostConfiguration] = None,
    ) -> Dict[str, any]:
        """
        Full evaluation suite across discrimination, calibration, and financial cost.
        """
        cost_cfg = cost_config or CostConfiguration()
        y_pred = (y_prob >= threshold).astype(int)

        # 1. Discrimination metrics
        pr_auc = float(average_precision_score(y_true, y_prob))
        roc_auc = float(roc_auc_score(y_true, y_prob))
        precision = float(precision_score(y_true, y_pred, zero_division=0))
        recall = float(recall_score(y_true, y_pred, zero_division=0))
        f1 = float(f1_score(y_true, y_pred, zero_division=0))

        # 2. Confusion matrix
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
        fpr = float(fp / max(1, fp + tn))

        # 3. Recall at fixed low False Positive Rates (Crucial for banking!)
        fpr_arr, tpr_arr, _ = roc_curve(y_true, y_prob)
        recall_at_fpr_1pct = float(np.interp(0.01, fpr_arr, tpr_arr))
        recall_at_fpr_05pct = float(np.interp(0.005, fpr_arr, tpr_arr))
        recall_at_fpr_01pct = float(np.interp(0.001, fpr_arr, tpr_arr))

        # 4. Precision & Recall @ Top-K
        n = len(y_true)
        k_100 = min(100, n)
        top_k_indices = np.argsort(y_prob)[::-1][:k_100]
        prec_at_k100 = float(np.mean(y_true[top_k_indices]))
        recall_at_k100 = float(np.sum(y_true[top_k_indices]) / max(1, np.sum(y_true)))

        # 5. Calibration metrics
        calib_metrics = ProbabilityCalibrator.compute_calibration_metrics(y_prob, y_true)

        # 6. Financial cost calculation
        amt_arr = amounts if amounts is not None else np.ones(n, dtype=float) * 100.0
        
        # Uncaught fraud loss (False Negatives)
        fraud_losses = float(np.sum(amt_arr[(y_true == 1) & (y_pred == 0)]))
        
        # Operational investigation costs (All positive flags: TP + FP)
        investigation_costs = float((tp + fp) * cost_cfg.investigation_cost)
        
        # False alert friction costs (False Positives)
        friction_costs = float(fp * cost_cfg.customer_friction_cost)

        total_financial_cost = fraud_losses + investigation_costs + friction_costs

        # Baseline cost if NO fraud detection was deployed (allow everything)
        cost_no_detection = float(np.sum(amt_arr[y_true == 1]))
        net_savings = max(0.0, cost_no_detection - total_financial_cost)

        return {
            "pr_auc": round(pr_auc, 5),
            "roc_auc": round(roc_auc, 5),
            "precision": round(precision, 5),
            "recall": round(recall, 5),
            "f1": round(f1, 5),
            "false_positive_rate": round(fpr, 5),
            "recall_at_fpr_1pct": round(recall_at_fpr_1pct, 5),
            "recall_at_fpr_05pct": round(recall_at_fpr_05pct, 5),
            "recall_at_fpr_01pct": round(recall_at_fpr_01pct, 5),
            "precision_at_k100": round(prec_at_k100, 5),
            "recall_at_k100": round(recall_at_k100, 5),
            "brier_score": calib_metrics["brier_score"],
            "expected_calibration_error": calib_metrics["expected_calibration_error"],
            "confusion_matrix": {
                "true_positives": int(tp),
                "false_positives": int(fp),
                "true_negatives": int(tn),
                "false_negatives": int(fn),
            },
            "financial_outcomes": {
                "uncaught_fraud_loss": round(fraud_losses, 2),
                "investigation_labor_cost": round(investigation_costs, 2),
                "customer_friction_cost": round(friction_costs, 2),
                "total_operational_cost": round(total_financial_cost, 2),
                "baseline_cost_no_detection": round(cost_no_detection, 2),
                "estimated_net_savings": round(net_savings, 2),
            },
        }
