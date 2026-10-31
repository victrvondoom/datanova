# AEGIS-Fraud X — Mandatory Release Gates

Two regression gates are **mandatory for every release**. They exist because
the system's own history shows these exact failure modes occurred and inflated
every downstream claim (see `AUDIT_FINDINGS.md`, AFX-01/AFX-02):

1. **Benchmark protocol leakage gate**
   `tests/release/test_gate_benchmark_protocol.py`
   Runs the REAL benchmark pipeline twice; the two runs differ ONLY in the
   held-out TEST labels (adversarial mutation of the highest-amount test rows).
   The validation-selected champion, the frozen policy thresholds, and the
   policy-fitting inputs must be IDENTICAL across runs, while the reported test
   metrics must differ (vacuity guard). Any use of test data for selection,
   tuning, calibration choice, or policy fitting fails this gate.

2. **Calibrator provenance lifecycle gate**
   `tests/release/test_gate_calibrator_provenance.py`
   Verifies the full calibration lifecycle: fit on a permitted split → persist
   → load → consistent outputs → serving uses the persisted artifact →
   provenance visible (`state.calibration_source`, `/api/health`) → corrupt,
   missing, tampered, wrong-method, or schema-mismatched artifacts are REJECTED,
   never silently substituted; fallbacks are explicitly marked as fallbacks.

## Why these two

- The benchmark artifact feeds every published number (README, reports, deck,
  frontend). If test data leaks into selection or tuning, every claim —
  including the optimizer's and the Digital Twin's — is optimistically biased.
- The serving path previously fabricated a calibrator; a regression there is
  invisible in metrics but corrupts every decision, receipt, and UI number.

## Local enforcement (current repository state)

This repository currently has **no Git remote and no branch protection** —
remote CI enforcement has NOT been claimed and is NOT active. Until a remote
exists, run locally before every release:

```bash
python -m pytest tests/release/ -v          # both gates
python -m pytest tests/ -q                  # full suite
python -m ruff check . && python -m mypy packages apps scripts --ignore-missing-imports
cd apps/web && npm run build
```

## CI configuration

`.github/workflows/ci.yml` runs both gates as explicit required steps on every
push and pull request, with no `continue-on-error`, no `|| true`, and no
conditional bypass. Once a remote exists, configure branch protection:

- Settings → Branches → Branch protection rule for the default branch
- Require status checks to pass: `release-gates`, `quality`, `frontend`
- Require branches to be up to date before merging

Until that is configured on an actual remote, CI enforcement is **prospective
configuration only**, verified locally.
