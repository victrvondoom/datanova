# AEGIS-Fraud X — Model Artifact Contract

The bundle (`packages/artifacts/bundle.py`) is the verifiable
training-to-serving contract.

## Layout

- `experiments/champion_bundle.pkl` — pickled payload: trained model, fitted
  calibrator, feature schema, frozen decision policy, run id, creation time,
  format version, metadata (dataset, split, champion name, solver, seed).
- `experiments/champion_bundle.pkl.manifest.json` — contract fields AND the
  SHA-256 of the exact payload file bytes.

**Why the hash lives in a sidecar:** sklearn objects (notably
IsotonicRegression) are NOT byte-stable across a pickle roundtrip, so a
checksum computed from re-pickled objects cannot be verified. Hashing the
payload file bytes is exact — any post-training modification breaks it.

## Validation on load (all enforced, none skippable)

`load_bundle()` raises `BundleValidationError` on:
1. Missing payload or manifest.
2. Corrupt/unpicklable payload.
3. Payload file hash ≠ manifest hash (tampering or corruption).
4. Unknown format version.
5. Manifest/payload disagreement on run_id, model_id, model_version, or
  feature schema.
6. Caller-supplied `expected_model_id` / `expected_feature_names` mismatch.

## Serving behavior (`apps/api/main.py`)

- Bundle-first loading via `AEGIS_BUNDLE_PATH` (default
  `experiments/champion_bundle.pkl`).
- A bundle that fails validation leaves the API **model-less** with
  `artifact_status = "bundle_rejected: <reason>"` — it is NEVER silently
  substituted with the legacy `champion_model.pkl`.
- Fallback chain (each explicitly identifiable): validated bundle →
  legacy model + standalone calibrator artifact → calibrator fitted on real
  reference data → base-rate prior. The active source is exposed as
  `state.calibration_source` and in `GET /api/health`
  (`artifact_status`, `artifact_run_id`, `calibration_source`).
- `/api/score` returns the full server-signed receipt
  (`audit_receipt`) which clients must verify verbatim.

## Regeneration

`python scripts/run_benchmarks.py` overwrites the bundle + manifest and
records the new run id; the previous benchmark artifact hash is embedded in
the manifest for provenance. Test environments override paths
(`artifact_dir`, `experiments_dir`, ...) so gate runs never clobber the
authoritative artifacts.

## Origin signing (catalog: registry_signature_verification)

SHA-256 in the manifest proves INTEGRITY; an ed25519 signature over the
payload bytes proves ORIGIN — that a key holder the operator trusts
produced this artifact.

- Training host sets `AEGIS_SIGNING_KEY` (PEM private key path):
  `save_bundle` then adds `payload_signature`, `signature_algorithm`
  ("ed25519"), and `signing_key_id` to the manifest. Without the env key the
  manifest is written UNSIGNED (never a fake signature).
- Serving host sets `AEGIS_SIGNING_PUBKEY`: `load_bundle` verifies the
  signature and REJECTS the bundle on (a) a signed manifest with no
  configured verification key (fail-closed), (b) key-id mismatch, or
  (c) failed signature verification (payload changed after signing or
  signed by an untrusted key).
- Unsigned manifests load in the documented dev mode; the loaded payload
  carries `_artifact_signature` (signed/verified/key_id/algorithm) and
  `/api/health` exposes it as `artifact_signature`.
- Key generation: `python scripts/generate_signing_key.py <priv.pem> <pub.pem>`
  (run OFFLINE; the private key must never be committed or baked into images).

**Current repository state (honest):** the checked-in champion bundle is
UNSIGNED (dev mode, reported as such by the API). Production rollout must
generate a keypair, configure the env keys, and re-sign the champion.

## Tests

`tests/unit/test_artifact_bundle.py` (roundtrip, corrupt, tampered payload,
missing manifest, identity/schema mismatch, API refusal),
`tests/unit/test_artifact_signing.py` (sign roundtrip, unsigned-dev-mode,
fail-closed without verification key, forged/wrong-key signature rejection,
stable key ids), and release gate 2
(`tests/release/test_gate_calibrator_provenance.py`) pin this contract.
