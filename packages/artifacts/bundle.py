"""Versioned, checksum-verified model artifact bundle for AEGIS-Fraud X.

A bundle is the training-to-serving contract: trained model + fitted
calibrator + feature schema + frozen decision policy + provenance (run id,
benchmark artifact hash) + integrity checksum.

Layout:
- ``champion_bundle.pkl``  — the pickled payload (model, calibrator, schema...)
- ``champion_bundle_manifest.json`` — contract fields AND the SHA-256 of the
  exact payload file bytes.

Why the hash lives in a sidecar manifest: sklearn objects (notably
IsotonicRegression) are NOT byte-stable across a pickle roundtrip, so a
checksum computed from re-pickled objects would be unverifiable. Hashing the
payload FILE bytes is exact: any modification of the payload after training
changes the file and breaks the manifest hash.

Loading is STRICT: manifest presence, payload file hash, format version,
model identity, and feature schema are validated. Invalid bundles are
rejected — never silently substituted. (See MODEL_ARTIFACT_CONTRACT.md.)
"""

import hashlib
import json
import os
import pickle
from datetime import datetime
from typing import Any, Dict, List, Optional

from packages.artifacts.signing import sign_payload, verify_payload_signature
from packages.data.schemas import DecisionPolicy
from packages.models.base import BaseFraudClassifier
from packages.models.calibration import ProbabilityCalibrator

BUNDLE_FORMAT_VERSION = 1
BUNDLE_FILENAME = "champion_bundle.pkl"


def manifest_path_for(bundle_path: str) -> str:
    return bundle_path + ".manifest.json"


def save_bundle(
    path: str,
    model: BaseFraudClassifier,
    calibrator: ProbabilityCalibrator,
    feature_names: List[str],
    policy: DecisionPolicy,
    run_id: str,
    benchmark_artifact_path: Optional[str] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Persists a self-verifying artifact bundle and returns its manifest."""
    payload: Dict[str, Any] = {
        "format_version": BUNDLE_FORMAT_VERSION,
        "run_id": run_id,
        "created_at": datetime.utcnow().isoformat(),
        "model": model,
        "model_id": model.model_id,
        "model_version": model.version,
        "calibrator_method": calibrator.method,
        "calibrator": calibrator,
        "feature_names": list(feature_names),
        "policy": policy.model_dump(),
        "metadata": extra_metadata or {},
    }

    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    payload_bytes = pickle.dumps(payload)
    with open(path, "wb") as f:
        f.write(payload_bytes)
    payload_sha = hashlib.sha256(payload_bytes).hexdigest()

    manifest: Dict[str, Any] = {
        "format_version": BUNDLE_FORMAT_VERSION,
        "run_id": run_id,
        "created_at": payload["created_at"],
        "model_id": model.model_id,
        "model_version": model.version,
        "feature_names": list(feature_names),
        "policy": policy.model_dump(),
        "payload_sha256": payload_sha,
        "calibrator_method": calibrator.method,
        "metadata": extra_metadata or {},
    }

    if benchmark_artifact_path and os.path.exists(benchmark_artifact_path):
        with open(benchmark_artifact_path, "rb") as f:
            manifest["benchmark_artifact_sha256"] = hashlib.sha256(f.read()).hexdigest()
        manifest["benchmark_artifact_path"] = benchmark_artifact_path

    # Origin authenticity (catalog: registry_signature_verification):
    # SHA-256 above proves integrity; an ed25519 signature over the payload
    # bytes proves a trusted key holder produced this artifact. Unsigned
    # manifests stay backwards compatible and are reported as unsigned.
    signature_fields = sign_payload(payload_bytes)
    if signature_fields is not None:
        manifest.update(signature_fields)

    with open(manifest_path_for(path), "w") as f:
        json.dump(manifest, f, indent=2, default=str)

    return manifest


class BundleValidationError(RuntimeError):
    """Raised when an artifact bundle fails validation. Never silently ignored."""


def load_bundle(
    path: str,
    expected_model_id: Optional[str] = None,
    expected_feature_names: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Loads and validates an artifact bundle.

    Raises BundleValidationError on: missing manifest, corrupt file, payload
    hash mismatch, unknown format version, model identity mismatch, or
    feature schema mismatch.
    """
    manifest_file = manifest_path_for(path)
    if not os.path.exists(path) or not os.path.exists(manifest_file):
        raise BundleValidationError(
            f"Artifact bundle incomplete (payload or manifest missing): {path}"
        )

    with open(manifest_file) as f:
        manifest = json.load(f)

    with open(path, "rb") as f:
        payload_bytes = f.read()
    actual_sha = hashlib.sha256(payload_bytes).hexdigest()
    if actual_sha != manifest.get("payload_sha256"):
        raise BundleValidationError(
            "Artifact bundle payload hash mismatch — the bundle was modified or "
            "corrupted after training. Refusing to serve."
        )

    # Signature verification (catalog: registry_signature_verification).
    # Fail-closed: signed manifests without a configured verification key or
    # with a failing signature are rejected; unsigned manifests load in the
    # documented dev mode and are reported as unsigned.
    sig_ok, sig_reason, sig_info = verify_payload_signature(payload_bytes, manifest)
    if not sig_ok:
        raise BundleValidationError(f"Artifact signature rejected: {sig_reason}")

    try:
        payload: Dict[str, Any] = pickle.loads(payload_bytes)
    except Exception as e:
        raise BundleValidationError(f"Corrupt artifact bundle '{path}': {e}") from e

    payload["_artifact_signature"] = sig_info

    if payload.get("format_version") != BUNDLE_FORMAT_VERSION:
        raise BundleValidationError(
            f"Unsupported bundle format version {payload.get('format_version')} "
            f"(expected {BUNDLE_FORMAT_VERSION})"
        )

    # Cross-check the manifest contract fields against the payload
    for key in ("run_id", "model_id", "model_version"):
        if payload.get(key) != manifest.get(key):
            raise BundleValidationError(
                f"Bundle manifest/payload disagree on '{key}' — possible tampering."
            )
    if list(payload.get("feature_names", [])) != list(manifest.get("feature_names", [])):
        raise BundleValidationError("Feature schema mismatch between manifest and payload.")

    if expected_model_id is not None and payload["model_id"] != expected_model_id:
        raise BundleValidationError(
            f"Model identity mismatch: bundle holds '{payload['model_id']}', "
            f"expected '{expected_model_id}'"
        )

    if expected_feature_names is not None:
        if list(payload["feature_names"]) != list(expected_feature_names):
            raise BundleValidationError(
                "Feature schema mismatch: the serving feature pipeline does "
                "not match the features the bundled model was trained on."
            )

    return payload


def bundle_manifest_path(bundle_dir: str) -> str:
    return manifest_path_for(os.path.join(bundle_dir, BUNDLE_FILENAME))


def save_bundle_manifest(bundle_dir: str, manifest: Dict[str, Any]) -> None:
    """Retained for compatibility: save_bundle already writes the manifest."""
    os.makedirs(bundle_dir, exist_ok=True)
    with open(bundle_manifest_path(bundle_dir), "w") as f:
        json.dump(manifest, f, indent=2, default=str)
