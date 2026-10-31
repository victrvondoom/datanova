"""RELEASE GATE 2 — Calibrator provenance lifecycle gate.

This is a MANDATORY release gate (see RELEASE_GATES.md). It verifies the full
calibration lifecycle: fitting on an explicitly permitted split, persistence,
loading, consistency, provenance visibility, model/schema association, and —
critically — that missing or corrupt artifacts can NEVER silently produce a
fabricated calibrated result.
"""

import os
import pickle
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.models.calibration import ProbabilityCalibrator

PERMITTED_SPLIT = "validation"


def _fit_real_calibrator(seed: int = 42) -> ProbabilityCalibrator:
    """Fits a calibrator the way the benchmark does: on validation scores."""
    rng = np.random.default_rng(seed)
    val_scores = rng.uniform(0.0, 1.0, 500)
    val_labels = (val_scores + rng.normal(0, 0.15, 500) > 0.5).astype(int)
    return ProbabilityCalibrator(method="isotonic").fit(val_scores, val_labels)


def test_lifecycle_fit_persist_load_consistency(tmp_path):
    cal = _fit_real_calibrator()
    path = str(tmp_path / "champion_calibrator.pkl")
    cal.save(path)

    loaded = ProbabilityCalibrator.load(path)
    assert loaded.fitted is True
    assert loaded.method == "isotonic"

    probe = np.array([0.05, 0.25, 0.5, 0.75, 0.95])
    np.testing.assert_allclose(
        loaded.calibrate(probe), cal.calibrate(probe), rtol=0, atol=1e-12
    )
    # Monotonic calibration mapping (isotonic contract)
    out = loaded.calibrate(probe)
    assert np.all(np.diff(out) >= -1e-12)


def test_save_requires_fitted_calibrator(tmp_path):
    with pytest.raises(RuntimeError):
        ProbabilityCalibrator(method="isotonic").save(str(tmp_path / "x.pkl"))


def test_corrupt_artifact_is_rejected_not_silently_substituted(tmp_path):
    path = str(tmp_path / "corrupt_calibrator.pkl")
    with open(path, "wb") as f:
        f.write(b"this is not a pickle file")
    with pytest.raises((pickle.UnpicklingError, EOFError, AttributeError)):
        ProbabilityCalibrator.load(path)


def test_wrong_method_artifact_is_rejected(tmp_path):
    """An artifact persisted with a different method must not load as isotonic."""
    path = str(tmp_path / "foreign_calibrator.pkl")
    with open(path, "wb") as f:
        pickle.dump({"method": "sigmoid", "calibrator": "not-a-fitted-object"}, f)
    loaded = ProbabilityCalibrator.load(path)
    # The loader restores the persisted method honestly; a consumer demanding
    # isotonic must detect the mismatch explicitly:
    assert loaded.method == "sigmoid"
    with pytest.raises((AttributeError, TypeError, ValueError)):
        # calibrate() must fail on the garbage inner object, never fabricate output
        loaded.calibrate(np.array([0.5]))


def test_api_calibrator_provenance_is_visible():
    """The serving API must expose which calibration source it uses."""
    from apps.api.main import startup_event, state

    startup_event()
    assert state.calibration_source in {
        "validation-artifact",
        "reference-data",
        "base-rate-prior",
    }, f"Unexpected calibration source: {state.calibration_source}"
    assert state.calibrator is not None
    assert state.calibrator.fitted is True


def test_api_uses_persisted_validation_artifact_when_present(tmp_path, monkeypatch):
    """When a valid bundle exists, the API must load exactly its calibrator."""
    import numpy as np

    from apps.api import main as api_main
    from packages.artifacts.bundle import save_bundle
    from packages.data.schemas import DecisionPolicy
    from packages.models.classifiers import LogisticRegressionFraudModel

    rng = np.random.default_rng(0)
    X = rng.uniform(0, 1, (300, 4))
    y = (X[:, 0] > 0.5).astype(int)
    model = LogisticRegressionFraudModel()
    model.fit(X, y, feature_names=["f1", "f2", "f3", "f4"])
    cal = ProbabilityCalibrator(method="isotonic").fit(model.predict_proba(X), y)

    bundle = str(tmp_path / "champion_bundle.pkl")
    save_bundle(
        bundle, model, cal,
        feature_names=["f1", "f2", "f3", "f4"],
        policy=DecisionPolicy(tau_allow=0.2, tau_review=0.5, tau_block=0.9),
        run_id="gate_run_001",
    )

    monkeypatch.setattr(api_main, "CHAMPION_BUNDLE_PATH", bundle)
    monkeypatch.setattr(api_main, "state", api_main.ModelState())
    api_main.init_engine()

    assert api_main.state.artifact_status == "bundle_validated"
    assert api_main.state.artifact_run_id == "gate_run_001"
    assert api_main.state.calibration_source == "validation-artifact", (
        "API did not use the persisted validation calibrator although a valid "
        "bundle exists"
    )
    probe = np.array([0.1, 0.5, 0.9])
    np.testing.assert_allclose(
        api_main.state.calibrator.calibrate(probe), cal.calibrate(probe), atol=1e-12
    )


def test_missing_artifact_falls_back_identifiably(tmp_path, monkeypatch):
    """With no bundle and no calibrator artifact, the API must fall back AND
    mark the fallback as such."""
    from apps.api import main as api_main

    monkeypatch.setattr(
        api_main, "CHAMPION_BUNDLE_PATH", str(tmp_path / "missing_bundle.pkl")
    )
    monkeypatch.setattr(
        api_main, "CHAMPION_CALIBRATOR_PATH", str(tmp_path / "missing_calibrator.pkl")
    )
    monkeypatch.setattr(api_main, "state", api_main.ModelState())
    api_main.init_engine()
    # Fallback must be identifiable, never presented as a validation artifact
    assert api_main.state.calibration_source in {"reference-data", "base-rate-prior"}
    assert api_main.state.calibration_source != "validation-artifact"
    assert api_main.state.calibrator is not None
    assert api_main.state.calibrator.fitted is True
