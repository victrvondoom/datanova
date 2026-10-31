# AEGIS-Fraud X — Implementation Roadmap

Completed milestones and the live execution queue. Task-level detail with
priorities, acceptance criteria, and dependencies lives in `NEXT_ACTIONS.md`.

## Completed

- **M1 — Correctness audit:** zero-leakage benchmark protocol, real serving
  calibrator, ground-truth Digital Twin costs, CORS allowlist, offline-trust
  markers, optimizer zero-inflation fix, derived graph risk scores
  (commit `ca357bd`; findings AFX-01..08 in `AUDIT_FINDINGS.md`).
- **M2 — Evidence & optimization:** exact policy optimizer (brute-force
  verified) with regret measurement and sensitivity analysis; adversarial
  release gates (falsified before being trusted); ULB external evaluation
  (real data, full provenance) with leakage audit; versioned artifact bundle
  with strict load validation; truthful receipt-verification semantics;
  global degraded-state UX; CI workflow + release-gate documentation;
  API containerization; Playwright E2E of the full user journey.

## In flight (see NEXT_ACTIONS.md)

- P1: PaySim external evaluation (blocked on Kaggle credentials).
- P2: Docker post-fix build verification (Docker Desktop was unresponsive).
- P2: Frontend containerization (needs env-configurable API base URL).
- P2: Observability (structured logs, correlation IDs).
- P3: Remote repository + branch protection (none exists today).
