"""
Probability Calibration Engine for Imbalanced Fraud Detection.
Implements:
1. Isotonic Regression (non-parametric monotonic mapping)
2. Platt Scaling (logistic sigmoid)
3. Expected Calibration Error (ECE) and Brier Score computation
Strict guarantee: Calibrators are fitted exclusively on Validation split, NEVER on Test data.
"""

import pickle
from typing import Dict, Optional, Union

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression


class ProbabilityCalibrator:
    """
    Calibrates raw model scores into true posterior fraud probabilities P(Y=1 | X).
    """

    def __init__(self, method: str = "isotonic"):
        if method not in {"isotonic", "sigmoid"}:
            raise ValueError(
                f"Unknown calibration method '{method}'. Choose 'isotonic' or 'sigmoid'."
            )
        self.method = method
        self.calibrator: Optional[Union[IsotonicRegression, LogisticRegression]] = None
        self.fitted = False

    def fit(self, val_scores: np.ndarray, val_labels: np.ndarray) -> "ProbabilityCalibrator":
        """Fits calibration curve on validation partition predictions."""
        # Clip input scores to avoid extreme infs
        scores = np.clip(val_scores, 1e-6, 1.0 - 1e-6)

        if self.method == "isotonic":
            iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
            iso.fit(scores, val_labels)
            self.calibrator = iso
        else:  # sigmoid (Platt scaling)
            lr = LogisticRegression(C=1.0, solver="lbfgs")
            lr.fit(scores.reshape(-1, 1), val_labels)
            self.calibrator = lr

        self.fitted = True
        return self

    def save(self, filepath: str) -> None:
        """Persists the fitted calibrator so serving processes can reuse it."""
        if not self.fitted:
            raise RuntimeError("ProbabilityCalibrator must be fitted before calling save.")
        with open(filepath, "wb") as f:
            pickle.dump({"method": self.method, "calibrator": self.calibrator}, f)

    @classmethod
    def load(cls, filepath: str) -> "ProbabilityCalibrator":
        """Restores a previously fitted calibrator from disk."""
        with open(filepath, "rb") as f:
            payload = pickle.load(f)
        instance = cls(method=payload["method"])
        instance.calibrator = payload["calibrator"]
        instance.fitted = True
        return instance

    def calibrate(self, raw_scores: np.ndarray) -> np.ndarray:
        """Applies calibration mapping to new raw predictions."""
        if not self.fitted:
            raise RuntimeError("ProbabilityCalibrator must be fitted before calling calibrate.")

        scores = np.clip(raw_scores, 1e-6, 1.0 - 1e-6)
        assert self.calibrator is not None, "calibrator not fitted; call fit() first"
        if self.method == "isotonic":
            calibrated = self.calibrator.predict(scores)
        else:
            calibrated = self.calibrator.predict_proba(scores.reshape(-1, 1))[:, 1]

        return np.asarray(np.clip(np.asarray(calibrated), 0.0, 1.0))

    @staticmethod
    def compute_calibration_metrics(
        probs: np.ndarray, labels: np.ndarray, n_bins: int = 10
    ) -> Dict[str, float]:
        """
        Computes Expected Calibration Error (ECE) and Brier score.
        """
        # Brier Score: Mean squared error of probabilities vs binary labels
        brier = float(np.mean((probs - labels) ** 2))

        # Expected Calibration Error (ECE)
        bin_boundaries = np.linspace(0, 1, n_bins + 1)
        ece = 0.0
        n = len(probs)

        for i in range(n_bins):
            bin_lower = bin_boundaries[i]
            bin_upper = bin_boundaries[i + 1]
            mask = (
                (probs >= bin_lower) & (probs < bin_upper)
                if i < n_bins - 1
                else (probs >= bin_lower) & (probs <= bin_upper)
            )

            bin_size = np.sum(mask)
            if bin_size > 0:
                bin_acc = float(np.mean(labels[mask]))
                bin_conf = float(np.mean(probs[mask]))
                ece += (bin_size / n) * abs(bin_acc - bin_conf)

        return {
            "brier_score": round(brier, 6),
            "expected_calibration_error": round(ece, 6),
        }
