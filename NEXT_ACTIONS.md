# AEGIS-Fraud X — Next Actions (Priority Queue)

**Updated:** 2026-10-31, end of Milestone 3 (feature-expansion campaign).
The full capability universe now lives in `feature_catalog.json` /
`FEATURE_PRIORITIZATION.md` — this queue lists the next implementation
batches, ranked by the catalog's documented scoring.

| ID | Task | Priority | Dependencies | Acceptance criteria | Effort |
|:---|:---|:---:|:---|:---|:---:|
| NEXT-B1 | ~~Decision archive + retrieval~~ **DONE** (TRK-029, batch B): `GET /api/decisions/{transaction_id}` + listing with 404-on-miss, provenance-complete | — | — | — | — |
| NEXT-B2 | ~~Structured logging expansion~~ **DONE** (TRK-029, batch B): provenance-complete, payload-free decision logs asserted via caplog | — | — | — | — |
| NEXT-B3 | ~~Ops metrics endpoint~~ **DONE** (TRK-029, batch B): `/api/metrics` with reconciliation-tested counters | — | — | — | — |
| NEXT-01 | PaySim external evaluation — still blocked on Kaggle credentials | P1 | credentials + `datasets/external/paysim.csv` | Same protocol as ULB; artifact + report + dataset card | 2–4 h post-unblock |
| NEXT-02 | Docker post-fix verification (libgomp1 fix unverified — Docker Desktop outage) | P1 | Docker Desktop healthy | `docker compose up --build` + `/api/health` returns `bundle_validated` | 30 min |
| NEXT-04 | Frontend containerization (needs `VITE_API_BASE` env-configurable client) | P2 | NEXT-02 | Web container + compose service; E2E green against containerized stack | 4–6 h |
| NEXT-08 | ~~LightGBM prevalence robustness~~ **DONE** (TRK-030): cause identified and fixed; remaining: config bands for other prevalence levels | P3 | none | Per-band config matrix | 2 h |
| NEXT-10 | ~~Feature-registry generation~~ **DONE** (TRK-036, batch G): `packages/features/semantics.py` + `scripts/generate_feature_semantics.py`; UI layer (`explain_feature_definitions_ui`) remains optional | — | — | — | — |
| NEXT-11 | Dependency vulnerability auditing (`privacy_dependency_audit`): wire `pip-audit` into the quality workflow with a remediation log; document offline fallback | P1 | none | Audit command recorded + results in EVIDENCE.md; honest blocked status if the sandbox lacks network | 1–2 h |
| NEXT-12 | Decision replay (`inv_decision_replay`): re-run the archived ledger input through the loaded bundle and assert identical calibrated probability + action | P2 | frozen bundle (exists) | Replay endpoint/test asserting exact equality on N ledger records | 3 h |
| NEXT-13 | Artifact signing (`registry_signature_verification`): sign bundle payload with an ed25519 key, verify at load; document key governance | P2 | none | Tampered artifact rejected by signature test; unsigned artifact only in explicitly-flagged dev mode | 4 h |
| NEXT-07 | Remote repository + branch protection (CI config is prospective) | P3 | User decision on hosting | Required status checks: `release-gates`, `quality`, `frontend` | 1 h + user |
