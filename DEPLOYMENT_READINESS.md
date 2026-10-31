# AEGIS-Fraud X — Deployment Readiness

Status legend: **Completed & verified** / **Implemented, not fully verified** /
**Blocked** / **Not started**.

| Capability | Status | Evidence |
|:---|:---|:---|
| Reproducible local env (Python 3.12, pinned deps) | Completed & verified | `pyproject.toml`; full suite green on clean run 2026-10-31 |
| Frontend reproducible build | Completed & verified | `npm ci && npm run build` (tsc + vite), build time ~1.6s |
| API container image (`infra/Dockerfile.api`) | Implemented, **not fully verified** | Image built successfully once; container startup initially crashed on missing `libgomp.so.1` (LightGBM OpenMP) — **fix applied** (`apt-get install libgomp1`) but the post-fix build + smoke test could NOT be completed: Docker Desktop became unresponsive mid-session. Re-verify with `docker compose -f infra/docker-compose.yml up --build` then `curl :8000/api/health`. |
| docker-compose dev environment | Implemented, not fully verified | `infra/docker-compose.yml` (API + artifact volume mounts + env config); same blocker as above |
| Health / readiness | Completed & verified | `/api/health` returns artifact_status, artifact_run_id, calibration_source; Docker HEALTHCHECK defined |
| Model artifact integrity at startup | Completed & verified | Bundle checksum + manifest validation; corrupt bundles refused (tests: unit + release gate 2) |
| CORS security | Completed & verified | Explicit allowlist (`AEGIS_CORS_ORIGINS`); wildcard+credentials disallowed; integration tested |
| Secrets | Partially completed | `AEGIS_RECEIPT_SECRET` env var supported; compose passes it through. **Not** integrated with a secret manager (out of scope locally) |
| Frontend containerization | Not started | The web client auto-detects API on 127.0.0.1 ports; needs an env-configurable API base URL first |
| Observability (structured logs, correlation IDs) | Not started | Current logging is uvicorn default |
| Load/failure testing, graceful shutdown drills | Not started | |
| Kubernetes | Not started (deliberate) | Docker Compose is sufficient for the current stage; no evidence of scaling requirements that justify k8s |

## Operational risks

- The API is a single stateful process (in-memory graph + policy state);
  horizontal scaling is untested and would need externalized state.
- Scored transactions mutate the in-memory graph (forward-chaining); restarts
  lose that state (demonstration behavior, documented).
- `datasets/external` and `experiments` are volume-mounted, never baked into
  images — deployments must provision them.
