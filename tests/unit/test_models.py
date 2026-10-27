"""Unit tests for ML models and probability calibrator."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np

from packages.models.calibration import ProbabilityCalibrator
from packages.models.classifiers import (
    LightGBMFraudModel,
    LogisticRegressionFraudModel,
    XGBoostFraudModel,
)
from packages.models.rule_based import RuleBasedFraudClassifier


def test_models_fit_and_predict():
    X = np.random.randn(200, 10)
    y = np.random.choice([0, 1], size=200, p=[0.9, 0.1])

    models = [
        RuleBasedFraudClassifier(),
        LogisticRegressionFraudModel(),
        LightGBMFraudModel(n_estimators=10),
        XGBoostFraudModel(n_estimators=10),
    ]

    for m in models:
        m.fit(X, y)
        probs = m.predict_proba(X)
        assert len(probs) == 200
        assert np.all(probs >= 0.0)
        assert np.all(probs <= 1.0)


def test_probability_calibrator():
    raw_scores = np.linspace(0.05, 0.95, 100)
    labels = (raw_scores > 0.4).astype(int)

    calibrator = ProbabilityCalibrator(method="isotonic")
    calibrator.fit(raw_scores, labels)

    calibrated = calibrator.calibrate(raw_scores)
    assert len(calibrated) == 100
    assert np.all(calibrated >= 0.0)
    assert np.all(calibrated <= 1.0)
    # Monotonicity check for isotonic
    assert np.all(np.diff(calibrated) >= -1e-6)
