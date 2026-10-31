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

def test_lightgbm_class_weighting_contract():
    """class_weighting selects the imbalance strategy; invalid values rejected."""
    import numpy as np
    import pytest as _pytest

    from packages.models.classifiers import LightGBMFraudModel

    # Invalid strategy is rejected up front
    try:
        LightGBMFraudModel(class_weighting="bogus")
        raise AssertionError("Expected ValueError for invalid class_weighting")
    except ValueError:
        pass

    # 'none' must train with scale_pos_weight = 1.0 (prevalence-tuned band)
    rng = np.random.default_rng(7)
    X = rng.uniform(0, 1, (400, 3))
    y = (X[:, 0] > 0.9).astype(int)  # 10% positive
    model = LightGBMFraudModel(n_estimators=10, class_weighting="none")
    model.fit(X, y, feature_names=["a", "b", "c"])
    assert model.clf is not None
    assert model.clf.scale_pos_weight == 1.0

    # 'balanced' (default, historical behavior) weights by class ratio
    model_b = LightGBMFraudModel(n_estimators=10)
    model_b.fit(X, y, feature_names=["a", "b", "c"])
    pos = max(1, int((y == 1).sum()))
    neg = max(1, int((y == 0).sum()))
    assert model_b.clf.scale_pos_weight == _pytest.approx(neg / pos)
