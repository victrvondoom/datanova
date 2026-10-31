"""Contract tests for the versioned model artifact bundle.

Pins the training-to-serving contract: valid roundtrip, corrupt rejection,
checksum tampering rejection, model-identity mismatch rejection, feature
schema mismatch rejection, and that the serving API refuses invalid bundles
instead of silently substituting artifacts.
"""

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.artifacts.bundle import (
    BUNDLE_FILENAME,
    BundleValidationError,
    load_bundle,
    save_bundle,
)
from packages.data.schemas import DecisionPolicy
from packages.models.calibration import ProbabilityCalibrator
from packages.models.classifiers import LogisticRegressionFraudModel


def _trained_model():
    rng = np.random.default_rng(0)
    X = rng.uniform(0, 1, (200, 4))
    y = (X[:, 0] > 0.5).astype(int)
    model = LogisticRegressionFraudModel()
    model.fit(X, y, feature_names=["f1", "f2", "f3", "f4"])
    scores = model.predict_proba(X)
    calibrator = ProbabilityCalibrator(method="isotonic").fit(scores, y)
    return model, calibrator


def _policy():
    return DecisionPolicy(policy_name="Cost-Aware-Optimized", tau_allow=0.2, tau_review=0.5, tau_block=0.9)


def test_bundle_roundtrip(tmp_path):
    model, cal = _trained_model()
    path = str(tmp_path / BUNDLE_FILENAME)
    manifest = save_bundle(
        path, model, cal,
        feature_names=["f1", "f2", "f3", "f4"],
        policy=_policy(),
        run_id="test_run_001",
    )
    assert os.path.exists(path)
    assert manifest["payload_sha256"] and len(manifest["payload_sha256"]) == 64

    payload = load_bundle(path)
    assert payload["run_id"] == "test_run_001"
    assert payload["model_id"] == model.model_id
    assert payload["feature_names"] == ["f1", "f2", "f3", "f4"]
    assert payload["policy"]["tau_allow"] == 0.2
    # Loaded artifacts are functional and identical in behavior
    probe = np.array([[0.2, 0.3, 0.4, 0.5]])
    assert payload["calibrator"].fitted
    assert payload["model"].predict_proba(probe).shape == (1,)


def test_corrupt_bundle_is_rejected(tmp_path):
    model, cal = _trained_model()
    path = str(tmp_path / BUNDLE_FILENAME)
    save_bundle(path, model, cal, feature_names=["f1", "f2", "f3", "f4"], policy=_policy(), run_id="r1")
    with open(path, "wb") as f:
        f.write(b"garbage")
    with pytest.raises(BundleValidationError):
        load_bundle(path)


def test_payload_tampering_is_rejected(tmp_path):
    """A bundle whose payload file was modified after training must never serve."""
    model, cal = _trained_model()
    path = str(tmp_path / BUNDLE_FILENAME)
    save_bundle(path, model, cal, feature_names=["f1", "f2", "f3", "f4"], policy=_policy(), run_id="r1")

    # Flip a single byte in the pickled payload file
    with open(path, "rb") as f:
        data = bytearray(f.read())
    data[-1] ^= 0xFF
    with open(path, "wb") as f:
        f.write(bytes(data))
    with pytest.raises(BundleValidationError, match="payload hash mismatch"):
        load_bundle(path)


def test_missing_manifest_is_rejected(tmp_path):
    import json as _json

    model, cal = _trained_model()
    path = str(tmp_path / BUNDLE_FILENAME)
    manifest = save_bundle(path, model, cal, feature_names=["f1", "f2", "f3", "f4"], policy=_policy(), run_id="r1")
    assert manifest["payload_sha256"]

    os.remove(str(tmp_path / (BUNDLE_FILENAME + ".manifest.json")))
    with pytest.raises(BundleValidationError, match="incomplete"):
        load_bundle(path)


def test_model_identity_mismatch_is_rejected(tmp_path):
    model, cal = _trained_model()
    path = str(tmp_path / BUNDLE_FILENAME)
    save_bundle(path, model, cal, feature_names=["f1", "f2", "f3", "f4"], policy=_policy(), run_id="r1")
    with pytest.raises(BundleValidationError, match="identity"):
        load_bundle(path, expected_model_id="some_other_model")


def test_feature_schema_mismatch_is_rejected(tmp_path):
    model, cal = _trained_model()
    path = str(tmp_path / BUNDLE_FILENAME)
    save_bundle(path, model, cal, feature_names=["f1", "f2", "f3", "f4"], policy=_policy(), run_id="r1")
    with pytest.raises(BundleValidationError, match="schema"):
        load_bundle(path, expected_feature_names=["f1", "f2", "f3", "f4", "f5"])


def test_missing_bundle_is_rejected(tmp_path):
    with pytest.raises(BundleValidationError):
        load_bundle(str(tmp_path / "nonexistent.pkl"))


def test_api_refuses_invalid_bundle_and_reports_it(tmp_path, monkeypatch):
    """A corrupt bundle must leave the API model-less and honestly report it."""
    from apps.api import main as api_main

    corrupt = str(tmp_path / BUNDLE_FILENAME)
    with open(corrupt, "wb") as f:
        f.write(b"corrupt bundle bytes")

    monkeypatch.setenv("AEGIS_BUNDLE_PATH", corrupt)
    monkeypatch.setattr(api_main, "CHAMPION_BUNDLE_PATH", corrupt)
    monkeypatch.setattr(api_main, "state", api_main.ModelState())

    api_main.startup_engine = api_main.init_engine  # ensure fresh engine state
    api_main.init_engine()
    assert api_main.state.model is None, "API must not serve a model from a corrupt bundle"
    assert api_main.state.artifact_status.startswith("bundle_rejected")
    assert api_main.state.artifact_run_id is None
    # Calibrator provenance must reflect a fallback, never 'validation-artifact'
    assert api_main.state.calibration_source in {"reference-data", "base-rate-prior"}
