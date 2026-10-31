# AEGIS-Fraud X — Next Actions (Priority Queue)

**Updated:** 2026-10-31, after the correctness audit (see `AUDIT_FINDINGS.md`).
Ranked by impact on the product objective (honest, cost-aware fraud prevention).

| ID | Task | Priority | Rationale / Acceptance criteria |
|:---|:---|:---:|:---|
| NEXT-01 | Evaluate on external datasets (ULB Credit Card, PaySim) through the same zero-leakage protocol; adapters exist in `packages/data/adapters/` | P1 | All current evidence is synthetic. Reproducible artifact per dataset: `benchmarks/runs/<dataset>_summary.json` |
| NEXT-02 | Replace the optimizer's percentile grid with a finer search (or exact solver on small instances); report optimization regret vs. exhaustive optimum | P1 | Current honest run's review tier captured 0 test transactions (savings from challenge tier only). Regret test compares against exhaustive grid |
| NEXT-03 | Surface `degraded: true` across all dashboard views (offline banner) and Playwright E2E for: score → receipt → verify, replay twin, policy optimize | P2 | Data-layer markers exist (AFX-05); UI surfacing + E2E tests missing |
| NEXT-04 | Load the benchmark-frozen policy into the API at startup (currently a hardcoded default policy 0.15/0.42/0.75 is active until `/api/optimize-policy` runs) | P2 | `/api/health` should report the policy actually used for scoring |
| NEXT-05 | Reconcile `evaluate_drift_endpoint` scenario naming: `"none"` falls into the else-branch labeled "volume_surge" in the frontend union type | P3 | Minor contract mismatch; add explicit scenario enum on both sides |
| NEXT-06 | Metric registry (definitions, numerators/denominators, provenance) for every displayed metric; reconciliation test API ↔ frontend | P2 | Codifies what `METRICS_REGISTRY.md` from the master directive asks for, grounded in the now-honest artifacts |
| NEXT-07 | Containerize API + web with health checks and a startup smoke test | P3 | `infra/` is currently empty; deployment story unverified |
