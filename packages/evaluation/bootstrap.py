"""
Non-Parametric Bootstrap Uncertainty Engine.
Computes 95% empirical confidence intervals for discrimination metrics and expected cost.
"""

from typing import Dict, Optional

import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score


class BootstrapConfidenceEvaluator:
    """Computes empirical confidence intervals via bootstrap resampling."""

    def __init__(self, n_bootstraps: int = 200, random_seed: int = 42):
        self.n_bootstraps = n_bootstraps
        self.rng = np.random.default_rng(random_seed)

    def compute_intervals(
        self,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        amounts: Optional[np.ndarray] = None,
        confidence_level: float = 0.95,
    ) -> Dict[str, Dict[str, float]]:
        """
        Resamples with replacement and returns lower/upper quantiles.
        """
        n = len(y_true)
        alpha = (1.0 - confidence_level) / 2.0

        pr_aucs = []
        roc_aucs = []

        amounts if amounts is not None else np.ones(n, dtype=float) * 100.0

        for _ in range(self.n_bootstraps):
            indices = self.rng.integers(0, n, size=n)
            sample_true = y_true[indices]
            sample_prob = y_prob[indices]

            # Avoid single-class resamples
            if len(np.unique(sample_true)) < 2:
                continue

            pr_aucs.append(float(average_precision_score(sample_true, sample_prob)))
            roc_aucs.append(float(roc_auc_score(sample_true, sample_prob)))

        return {
            "pr_auc": {
                "mean": round(float(np.mean(pr_aucs)), 5),
                "ci_lower": round(float(np.quantile(pr_aucs, alpha)), 5),
                "ci_upper": round(float(np.quantile(pr_aucs, 1.0 - alpha)), 5),
            },
            "roc_auc": {
                "mean": round(float(np.mean(roc_aucs)), 5),
                "ci_lower": round(float(np.quantile(roc_aucs, alpha)), 5),
                "ci_upper": round(float(np.quantile(roc_aucs, 1.0 - alpha)), 5),
            },
        }
