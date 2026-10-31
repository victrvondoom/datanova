# AEGIS-Fraud X — Next Actions (Priority Queue)

**Updated:** 2026-10-31, end of Milestone 3 (feature-expansion campaign).
The full capability universe now lives in `feature_catalog.json` /
`FEATURE_PRIORITIZATION.md` — this queue lists the next implementation
batches, ranked by the catalog's documented scoring.

| ID | Task | Priority | Dependencies | Acceptance criteria | Effort |
|:---|:---|:---:|:---|:---|:---:|
| NEXT-B1 | **Decision archive + retrieval** (catalog: `inv_model_output_inspection`, `explain_historical_archive`): persist the decision ledger durably (already append-only) and add `GET /api/decisions/{transaction_id}` returning the archived record with provenance | P1 | none (ledger exists) | Endpoint returns the exact archived record incl. receipt hash, run id, calibration source; test covers miss case | 2 h |
| NEXT-B2 | **Structured logging expansion** (`obs_structured_logging`, `obs_model_version_logging`): extend the request-id log line with artifact run id / model version / calibration source per score request | P2 | NEXT-B1 provenance fields | Log lines carry provenance without payloads; sample log asserted in test | 2 h |
| NEXT-B3 | **Ops metrics endpoint** (`monitor_metrics_endpoint`, `api_usage_analytics`): in-memory counters per endpoint (requests, 429s, degraded responses) with `/api/metrics` JSON | P2 | none | Counters reconcile with a scripted request sequence (test asserts exact counts) | 3 h |
| NEXT-01 | PaySim external evaluation — still blocked on Kaggle credentials | P1 | credentials + `datasets/external/paysim.csv` | Same protocol as ULB; artifact + report + dataset card | 2–4 h post-unblock |
| NEXT-02 | Docker post-fix verification (libgomp1 fix unverified — Docker Desktop outage) | P1 | Docker Desktop healthy | `docker compose up --build` + `/api/health` returns `bundle_validated` | 30 min |
| NEXT-04 | Frontend containerization (needs `VITE_API_BASE` env-configurable client) | P2 | NEXT-02 | Web container + compose service; E2E green against containerized stack | 4–6 h |
| NEXT-08 | ~~LightGBM prevalence robustness~~ **DONE** (TRK-030): cause identified and fixed; remaining: config bands for other prevalence levels | P3 | none | Per-band config matrix | 2 h |
| NEXT-10 | Feature-registry generation (`feat_semantic_names_registry`, `explain_feature_definitions_ui`): generate per-feature definitions/units from the pipeline | P2 | none | Registry generated from code; UI layer optional follow-up | 3 h |
| NEXT-07 | Remote repository + branch protection (CI config is prospective) | P3 | User decision on hosting | Required status checks: `release-gates`, `quality`, `frontend` | 1 h + user |
