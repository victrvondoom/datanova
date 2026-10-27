"""
Statistical Drift & Concept Shift Monitoring Engine.
Computes:
- Population Stability Index (PSI) for feature and prediction drift
- Wasserstein Distance (Earth Mover's Distance)
- Three-tier alert state (STABLE, WARNING, CRITICAL_DRIFT)
"""

from typing import Dict, Optional

import numpy as np
from scipy.stats import wasserstein_distance


class DriftMonitor:
    """Monitors incoming transaction feature distributions against baseline reference distributions."""

    @staticmethod
    def calculate_psi(
        baseline: np.ndarray,
        target: np.ndarray,
        n_bins: int = 10,
    ) -> float:
        """
        Calculates Population Stability Index:
        PSI = sum((Actual% - Expected%) * ln(Actual% / Expected%))
        Standard thresholds:
        - PSI < 0.10: No significant shift (Green)
        - 0.10 <= PSI < 0.25: Moderate shift, review recommended (Yellow)
        - PSI >= 0.25: Significant shift, model retraining required (Red)
        """
        # Clean NaNs and infs
        b = baseline[np.isfinite(baseline)]
        t = target[np.isfinite(target)]

        if len(b) < 10 or len(t) < 10:
            return 0.0

        # Bin based on baseline quantiles
        quantiles = np.linspace(0, 100, n_bins + 1)
        bin_edges = np.percentile(b, quantiles)
        bin_edges[0] -= 1e-5
        bin_edges[-1] += 1e-5
        bin_edges = np.unique(bin_edges) # Deduplicate

        if len(bin_edges) < 2:
            return 0.0

        b_counts, _ = np.histogram(b, bins=bin_edges)
        t_counts, _ = np.histogram(t, bins=bin_edges)

        # Normalize with Laplace smoothing
        b_pct = (b_counts + 1e-4) / (np.sum(b_counts) + 1e-4 * len(b_counts))
        t_pct = (t_counts + 1e-4) / (np.sum(t_counts) + 1e-4 * len(t_counts))

        psi_val = np.sum((t_pct - b_pct) * np.log(t_pct / b_pct))
        return float(max(0.0, psi_val))

    @staticmethod
    def calculate_wasserstein(baseline: np.ndarray, target: np.ndarray) -> float:
        """Calculates 1D Wasserstein distance between baseline and target distributions."""
        b = baseline[np.isfinite(baseline)]
        t = target[np.isfinite(target)]
        if len(b) == 0 or len(t) == 0:
            return 0.0
        return float(wasserstein_distance(b, t))

    def evaluate_drift(
        self,
        baseline_scores: np.ndarray,
        current_scores: np.ndarray,
        feature_baselines: Optional[Dict[str, np.ndarray]] = None,
        feature_currents: Optional[Dict[str, np.ndarray]] = None,
    ) -> Dict:
        """Evaluates overall model score drift and individual feature stability."""
        score_psi = self.calculate_psi(baseline_scores, current_scores)
        score_wd = self.calculate_wasserstein(baseline_scores, current_scores)

        if score_psi >= 0.25:
            status = "CRITICAL_DRIFT"
            recommendation = "Immediate model retraining triggered. Concept shift detected."
        elif score_psi >= 0.10:
            status = "WARNING_MODERATE_DRIFT"
            recommendation = "Elevate human review rate. Monitor feature stability."
        else:
            status = "STABLE"
            recommendation = "Operating within normal statistical parameters."

        feat_drifts: Dict[str, float] = {}
        if feature_baselines and feature_currents:
            for fname, b_vals in feature_baselines.items():
                if fname in feature_currents:
                    feat_drifts[fname] = round(self.calculate_psi(b_vals, feature_currents[fname]), 4)

        return {
            "status": status,
            "prediction_psi": round(score_psi, 4),
            "prediction_wasserstein_distance": round(score_wd, 4),
            "recommendation": recommendation,
            "feature_psis": feat_drifts,
        }
