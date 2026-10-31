# AEGIS-Fraud X — Project Context

## What this is

AEGIS-Fraud X (DataNova 2026, DN-FN-01) — real-time payment fraud detection:
strict chronological evaluation, cost-aware multi-action decision policies,
exact constrained policy optimization, calibrated probabilities, HMAC-SHA256
tamper-evident receipts, a FastAPI serving engine, and a React decision-support
dashboard. Local repository (no remote).

## Verified current state (2026-10-31, Milestone 2)

- **Protocol:** zero-leakage — champion by validation PR-AUC; policy fitted on
  validation by an EXACT solver; frozen system evaluated once on test.
  Enforced by two mandatory release gates (falsified against reintroduced
  leakage before being trusted).
- **Synthetic evidence** (seed 42, 10k tx): champion XGBoost (val PR-AUC
  0.8111 / test 0.7147); exact policy saves 86.1% vs unmitigated loss at
  0.20% FPR (simulated). Optimization gap vs legacy grid: $0.00 — the exact
  solver adds the guarantee, not a number.
- **External evidence (ULB, real data):** champion XGBoost (val 0.7696 /
  test 0.7408); exact policy saves 63.2% at 0.19% FPR (simulated). PaySim:
  acquisition blocked (Kaggle credentials), adapter tested, no claims made.
- **Serving:** versioned artifact bundle (checksum-verified) loads at startup;
  corrupt bundles are refused; provenance visible in `/api/health`; `/api/score`
  returns the server-signed receipt.
- **Frontend:** truthful degraded states end-to-end; score→receipt→verify
  journey verified with Playwright against the real backend (online and
  offline).
- **Tests:** 70+ tests green (unit/property/integration/release/E2E), mypy and
  ruff clean.

## What it is not

- Not externally validated beyond ULB; not a production deployment (single
  stateful process, no observability stack); cost/savings figures are
  simulations under documented assumptions, not realized bank savings.

## Before editing code, read

`AGENTS.md` (engineering rules) · `BENCHMARK_METHODOLOGY.md` ·
`OPTIMIZATION_METHODOLOGY.md` · `MODEL_ARTIFACT_CONTRACT.md` ·
`RELEASE_GATES.md` · `AUDIT_FINDINGS.md` · `LIMITATIONS.md`
