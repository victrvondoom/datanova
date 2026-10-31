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

## Tests

`tests/unit/test_artifact_bundle.py` (roundtrip, corrupt, tampered payload,
missing manifest, identity/schema mismatch, API refusal) and release gate 2
(`tests/release/test_gate_calibrator_provenance.py`) pin this contract.
