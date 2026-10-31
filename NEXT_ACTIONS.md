# AEGIS-Fraud X — Next Actions (Priority Queue)

**Updated:** 2026-10-31, end of Milestone 2. Ranked by impact on the product
objective (honest, cost-aware, externally validated fraud prevention).

| ID | Task | Priority | Dependencies | Acceptance criteria | Est. effort |
|:---|:---|:---:|:---|:---|:---:|
| NEXT-01 | **PaySim external evaluation** — blocked on Kaggle credentials | P1 | Kaggle account/API key; place `paysim.csv` in `datasets/external/` | `paysim_evaluation.json` artifact with leakage audit, model comparison, exact-policy evaluation; docs updated | 2–4 h after unblock |
| NEXT-02 | **Docker post-fix verification** — the libgomp1 fix is in the Dockerfile but the rebuild was blocked by a Docker Desktop outage | P1 | Docker Desktop healthy | `docker compose -f infra/docker-compose.yml up --build` then `/api/health` returns `bundle_validated`; record in DEPLOYMENT_READINESS.md | 30 min |
| NEXT-03 | Frontend containerization | P2 | Env-configurable API base URL in `apps/web/src/api.ts` (replace 127.0.0.1 port auto-detection with `VITE_API_BASE` + fallback) | Web container + compose service; E2E passes against containerized stack | 4–6 h |
| NEXT-04 | Observability: structured logs, request correlation IDs, model/policy/run-id logging per request, latency histogram | P2 | none | Log lines carry correlation id + artifact run id; no raw transaction payloads logged (redaction) | 4 h |
| NEXT-05 | Serving-policy alignment: `/api/optimize-policy` refits on reference data at runtime; document that the startup policy comes from the frozen bundle while runtime refits are reference-data-based (different provenance, visible in health) | P2 | none | Health exposes active policy provenance; DecisionLab shows which data the displayed policy was fitted on | 2 h |
| NEXT-06 | Metric-registry automation: generate `METRICS_REGISTRY.md` metric tables from artifacts instead of maintaining prose | P3 | none | Script regenerates registry rows from `benchmark_summary.json` + `ulb_evaluation.json`; CI diff check | 3 h |
| NEXT-07 | Remote repository + branch protection (none exists; CI config is prospective) | P3 | User decision on hosting | Remote created; required status checks: `release-gates`, `quality`, `frontend` | 1 h + user |
| NEXT-08 | LightGBM prevalence robustness: investigate/tune default config for sub-0.2% prevalence (it collapsed on ULB: val PR-AUC 0.02) | P3 | none | Documented tuning (scale_pos_weight/min_child_samples) or an explicit config contract per dataset; ULB re-run | 3 h |
