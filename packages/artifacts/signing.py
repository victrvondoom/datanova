"""Artifact signing (catalog: registry_signature_verification).

SHA-256 in the bundle manifest proves INTEGRITY; an ed25519 signature over
the payload bytes proves ORIGIN — that a key holder the operator trusts
produced this artifact. Key governance:

- Private key path: env ``AEGIS_SIGNING_KEY`` (PEM, ed25519).
- Public key path: env ``AEGIS_SIGNING_PUBKEY`` (PEM, ed25519).
- Without a private key, ``save_bundle`` writes an UNSIGNED manifest
  (backwards compatible); without a public key, a SIGNED manifest is
  rejected rather than trusted on key-id alone.

This module never fabricates trust: unsigned artifacts load only in the
explicitly documented dev mode and are reported as unsigned by the loader.
"""

import base64
import hashlib
import os
from typing import Any, Dict, Optional, Tuple, cast

SIGNATURE_ALGORITHM = "ed25519"

try:  # cryptography is an optional hard dependency of this module
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    _CRYPTO_AVAILABLE = True
except ImportError:  # pragma: no cover - environment without cryptography
    _CRYPTO_AVAILABLE = False


def _private_key_path() -> Optional[str]:
    return os.environ.get("AEGIS_SIGNING_KEY") or None


def _public_key_path() -> Optional[str]:
    return os.environ.get("AEGIS_SIGNING_PUBKEY") or None


def signing_available() -> bool:
    """True when a private signing key is configured and loadable."""
    return _load_private_key() is not None


def _load_private_key() -> Optional[Any]:
    if not _CRYPTO_AVAILABLE:
        return None
    path = _private_key_path()
    if not path or not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        key = serialization.load_pem_private_key(f.read(), password=None)
    return key  # type: ignore[no-any-return]


def load_public_key_from_path(path: str) -> Any:
    """Loads an ed25519 public key from a PEM file (raises on failure)."""
    if not _CRYPTO_AVAILABLE:
        raise RuntimeError("cryptography package unavailable; cannot verify signatures")
    with open(path, "rb") as f:
        return serialization.load_pem_public_key(f.read())


def key_id_for_public_key(public_key_pem: bytes) -> str:
    """Stable short identifier for a verification key (sha256 prefix)."""
    return "ed25519:" + hashlib.sha256(public_key_pem).hexdigest()[:16]


def _public_key_pem(public_key: Any) -> bytes:
    return cast(
        bytes,
        public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ),
    )


def sign_payload(payload_bytes: bytes) -> Optional[Dict[str, str]]:
    """Signs artifact payload bytes; returns manifest fields or None.

    Returns None when signing is not configured — the caller then writes an
    unsigned manifest (never a fake signature).
    """
    key = _load_private_key()
    if key is None:
        return None
    if not _CRYPTO_AVAILABLE:  # pragma: no cover
        return None
    signature = key.sign(payload_bytes)
    pub_pem = _public_key_pem(key.public_key())
    return {
        "payload_signature": base64.b64encode(signature).decode("ascii"),
        "signature_algorithm": SIGNATURE_ALGORITHM,
        "signing_key_id": key_id_for_public_key(pub_pem),
    }


def verify_payload_signature(
    payload_bytes: bytes, manifest: Dict[str, Any]
) -> Tuple[bool, str, Dict[str, Any]]:
    """Verifies a manifest's signature over the payload bytes.

    Returns (ok, reason, info). info carries provenance for observability:
    {"signed": bool, "verified": bool, "key_id": str, "algorithm": str}.

    Semantics (honest, fail-closed):
    - Unsigned manifest -> (True, "unsigned-dev-mode", signed=False): the
      SHA-256 integrity check in load_bundle remains the only protection;
      deployments that require origin MUST reject unsigned artifacts at
      their own gate.
    - Signed manifest, no verification key configured -> REJECT.
    - Signed manifest, key mismatch or bad signature -> REJECT.
    """
    signature_b64 = manifest.get("payload_signature")
    if not signature_b64:
        return True, "unsigned-dev-mode", {
            "signed": False,
            "verified": False,
            "key_id": None,
            "algorithm": None,
        }

    pub_path = _public_key_path()
    if not pub_path or not os.path.exists(pub_path):
        return False, (
            "Artifact is signed but no verification key is configured "
            "(AEGIS_SIGNING_PUBKEY); refusing to trust a signature we cannot verify."
        ), {"signed": True, "verified": False,
            "key_id": manifest.get("signing_key_id"),
            "algorithm": manifest.get("signature_algorithm")}

    try:
        public_key = load_public_key_from_path(pub_path)
    except Exception as e:
        return False, f"Cannot load verification key '{pub_path}': {e}", {
            "signed": True, "verified": False,
            "key_id": manifest.get("signing_key_id"),
            "algorithm": manifest.get("signature_algorithm"),
        }

    pub_pem = _public_key_pem(public_key)
    expected_key_id = key_id_for_public_key(pub_pem)
    if manifest.get("signing_key_id") not in (None, expected_key_id):
        return False, (
            f"Signature key id '{manifest.get('signing_key_id')}' does not match the "
            f"configured verification key '{expected_key_id}'."
        ), {"signed": True, "verified": False,
            "key_id": manifest.get("signing_key_id"),
            "algorithm": manifest.get("signature_algorithm")}

    try:
        public_key.verify(base64.b64decode(signature_b64), payload_bytes)
    except Exception:
        return False, (
            "Artifact signature verification failed — payload was modified "
            "after signing or signed by an untrusted key. Refusing to serve."
        ), {"signed": True, "verified": False,
            "key_id": manifest.get("signing_key_id"),
            "algorithm": manifest.get("signature_algorithm")}

    return True, "signature-verified", {
        "signed": True,
        "verified": True,
        "key_id": expected_key_id,
        "algorithm": manifest.get("signature_algorithm", SIGNATURE_ALGORITHM),
    }


def generate_keypair(private_path: str, public_path: str) -> Dict[str, str]:
    """Generates a new ed25519 keypair for artifact signing (operator tool).

    Key governance: generate OFFLINE, keep the private key out of the
    repository and any container image; distribute only the public key to
    serving environments.
    """
    if not _CRYPTO_AVAILABLE:  # pragma: no cover
        raise RuntimeError("cryptography package unavailable; cannot generate keys")
    key = Ed25519PrivateKey.generate()
    os.makedirs(os.path.dirname(private_path) or ".", exist_ok=True)
    os.makedirs(os.path.dirname(public_path) or ".", exist_ok=True)
    with open(private_path, "wb") as f:
        f.write(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
    with open(public_path, "wb") as f:
        f.write(_public_key_pem(key.public_key()))
    return {
        "private_key": private_path,
        "public_key": public_path,
        "key_id": key_id_for_public_key(_public_key_pem(key.public_key())),
    }
