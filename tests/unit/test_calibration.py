"""Regression tests for probability calibrator persistence.

The champion calibrator used to be silently discarded (no save/load existed),
forcing the serving API to fabricate a dummy calibrator. These tests pin the
persistence contract.
"""

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.models.calibration import ProbabilityCalibrator


def _fit_dummy_calibrator() -> ProbabilityCalibrator:
    rng = np.random.default_rng(42)
    scores = rng.uniform(0.0, 1.0, 500)
    labels = (scores + rng.normal(0, 0.1, 500) > 0.5).astype(int)
    return ProbabilityCalibrator(method="isotonic").fit(scores, labels)


def test_save_load_roundtrip(tmp_path):
    cal = _fit_dummy_calibrator()
    path = str(tmp_path / "calibrator.pkl")
    cal.save(path)

    loaded = ProbabilityCalibrator.load(path)
    assert loaded.fitted is True
    assert loaded.method == "isotonic"

    probe = np.array([0.05, 0.5, 0.95])
    np.testing.assert_allclose(loaded.calibrate(probe), cal.calibrate(probe))


def test_save_requires_fitted_calibrator(tmp_path):
    unfitted = ProbabilityCalibrator(method="isotonic")
    with pytest.raises(RuntimeError):
        unfitted.save(str(tmp_path / "never_created.pkl"))


def test_calibrate_requires_fitted():
    unfitted = ProbabilityCalibrator(method="isotonic")
    with pytest.raises(RuntimeError):
        unfitted.calibrate(np.array([0.5]))
