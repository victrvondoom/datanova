"""Tests for artifact signing (catalog: registry_signature_verification).

ed25519 signatures over bundle payload bytes: integrity is proven by
SHA-256, ORIGIN is proven by the signature. Fail-closed on signed artifacts
without a verification key; honest unsigned-dev-mode reporting otherwise.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.artifacts.bundle import load_bundle, save_bundle
from packages.artifacts.signing import (
    generate_keypair,
    key_id_for_public_key,
    signing_available,
    verify_payload_signature,
)
from packages.data.schemas import DecisionPolicy
from packages.models.calibration import ProbabilityCalibrator

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))


@pytest.fixture()
def keypair(tmp_path, monkeypatch):
    priv = str(tmp_path / "signing_key.pem")
    pub = str(tmp_path / "signing_pub.pem")
    info = generate_keypair(priv, pub)
    monkeypatch.setenv("AEGIS_SIGNING_KEY", priv)
    monkeypatch.setenv("AEGIS_SIGNING_PUBKEY", pub)
    yield info
    monkeypatch.delenv("AEGIS_SIGNING_KEY", raising=False)
    monkeypatch.delenv("AEGIS_SIGNING_PUBKEY", raising=False)


@pytest.fixture(autouse=True)
def _no_default_keys(monkeypatch):
    monkeypatch.delenv("AEGIS_SIGNING_KEY", raising=False)
    monkeypatch.delenv("AEGIS_SIGNING_PUBKEY", raising=False)


def _save_bundle(path, run_id="sign_test_run"):
    calibrator = ProbabilityCalibrator(method="isotonic")
    calibrator.fit([0.1, 0.4, 0.7, 0.9], [0, 0, 1, 1])
    return save_bundle(
        path,
        model=_StubModel(),
        calibrator=calibrator,
        feature_names=["a", "b"],
        policy=DecisionPolicy(),
        run_id=run_id,
    )


class _StubModel:
    model_id = "sign_test_model"
    version = "1.0"

    def predict_proba(self, X):  # pragma: no cover - unused
        return [0.1]


def test_save_without_key_writes_unsigned_manifest(tmp_path):
    """No signing key configured -> manifest has NO fake signature fields."""
    manifest = _save_bundle(str(tmp_path / "bundle.pkl"))
    assert "payload_signature" not in manifest
    assert signing_available() is False
    ok, reason, info = verify_payload_signature(b"x", manifest)
    assert ok is True and reason == "unsigned-dev-mode" and info["signed"] is False


def test_signed_bundle_round_trips(tmp_path, keypair):
    """Signing key configured -> manifest carries a verifiable signature."""
    path = str(tmp_path / "bundle.pkl")
    manifest = _save_bundle(path)
    assert manifest["signature_algorithm"] == "ed25519"
    assert manifest["signing_key_id"] == keypair["key_id"]
    payload = load_bundle(path)
    sig = payload["_artifact_signature"]
    assert sig == {
        "signed": True,
        "verified": True,
        "key_id": keypair["key_id"],
        "algorithm": "ed25519",
    }


def test_signed_manifest_without_verification_key_is_rejected(tmp_path, keypair, monkeypatch):
    """Fail-closed: a signature we cannot verify is not trusted."""
    path = str(tmp_path / "bundle.pkl")
    _save_bundle(path)
    with open(path + ".manifest.json") as f:
        import json

        signed_manifest = json.load(f)
    monkeypatch.delenv("AEGIS_SIGNING_PUBKEY", raising=False)
    ok, reason, _ = verify_payload_signature(b"payload-bytes", signed_manifest)
    assert ok is False
    assert "no verification key is configured" in reason


def test_wrong_key_signature_is_rejected(tmp_path, keypair, tmp_path_factory):
    """A payload signed by an attacker's key fails verification."""
    # bundle saved + signed with the trusted key
    path = str(tmp_path / "bundle.pkl")
    _save_bundle(path)
    with open(path, "rb") as f:
        payload_bytes = f.read()

    # attacker generates their own key and signs the payload
    attacker_dir = tmp_path_factory.mktemp("attacker")
    attacker = generate_keypair(str(attacker_dir / "k.pem"), str(attacker_dir / "k.pub.pem"))
    assert attacker["key_id"] != keypair["key_id"]
    forged_manifest = {
        "payload_signature": sign_payload_with(attacker_priv=str(attacker_dir / "k.pem"), data=payload_bytes),
        "signature_algorithm": "ed25519",
        "signing_key_id": keypair["key_id"],  # attacker claims the trusted key id
    }
    ok, reason, _ = verify_payload_signature(payload_bytes, forged_manifest)
    assert ok is False
    assert "signature verification failed" in reason or "does not match" in reason


def sign_payload_with(attacker_priv: str, data: bytes) -> str:
    import base64

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    with open(attacker_priv, "rb") as f:
        key = serialization.load_pem_private_key(f.read(), password=None)
    assert isinstance(key, Ed25519PrivateKey)
    return base64.b64encode(key.sign(data)).decode("ascii")


def test_unsigned_bundle_still_loads_in_dev_mode(tmp_path):
    """Backwards compatibility: unsigned bundles load and say so honestly."""
    path = str(tmp_path / "bundle.pkl")
    _save_bundle(path)
    payload = load_bundle(path)
    assert payload["_artifact_signature"]["signed"] is False


def test_key_id_is_stable_for_same_public_key(keypair):
    with open(keypair["public_key"], "rb") as f:
        pem = f.read()
    assert key_id_for_public_key(pem) == keypair["key_id"]
    assert key_id_for_public_key(pem) == key_id_for_public_key(pem)
