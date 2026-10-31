# AEGIS-Fraud X — Threat Model

**Scope:** the AEGIS-Fraud X local deployment (FastAPI serving engine + React
dashboard + training/benchmark pipeline), as of Milestone 3. **Deployment
context:** single-process, single-user, localhost-bound, no Git remote. This is
a risk-management analysis, not a compliance claim. NIST AI RMF is used as a
voluntary structuring reference (Govern/Map/Measure/Manage); no conformance is
asserted.

## 1. Assets and trust boundaries

| Asset | Value | Boundary |
|:---|:---|:---|
| Champion artifact bundle (model/calibrator/policy) | Serving integrity depends on it | repo filesystem ↔ API process |
| Receipt signing key (`AEGIS_RECEIPT_SECRET`) | Receipt forgeability | env ↔ process |
| Decision ledger (JSONL) | Audit evidence | process ↔ filesystem |
| External datasets (ULB) | License/privacy obligations | datasets/external (gitignored) |
| API surfaces (score, admin/emergency-stop, optimize-policy) | Correct decisions, state integrity | localhost network ↔ process |
| Benchmark protocol + release gates | Evidence integrity | repo ↔ CI/local runner |

Actors: local operator (trusted), API client (untrusted input), dataset files
(trusted after checksum), future remote users (out of scope until a remote exists).

## 2. STRIDE analysis — mapped to ACTUAL implemented behavior

| # | Threat | Control implemented (file) | Verified by | Residual risk |
|:---|:---|:---|:---|:---|
| S1 | Spoofed ingest/decisions | Env-gated API-key auth (constant-time compare, probes exempt); local-open mode honestly reported via `/api/health` `auth_mode` (`apps/api/main.py`) | `test_batch_de.py` (both modes) | **Local-context mitigated**: without `AEGIS_API_KEY` the API is open by design; multi-user deployment MUST set the key (TLS/reverse proxy still out of scope) |
| S2 | Forged receipts | HMAC-SHA256 under server-held key; truthful `SIGNATURE_VERIFIED`/`INVALID` semantics; wrong-key test proves rejection (`receipts.py`, `main.py`) | `test_receipt_verification_edge_cases` | **Medium**: dev default key is public in source; production must set `AEGIS_RECEIPT_SECRET` (compose passthrough exists) |
| T1 | Tampered model artifacts | Bundle payload SHA-256 sidecar manifest; hard rejection, never silent substitution (`bundle.py`) | `test_artifact_bundle.py`, release gate 2 | Low for integrity; **note**: SHA-256 proves integrity, not origin (catalog `registry_signature_verification` open) |
| T2 | Tampered benchmark evidence | Adversarial test-label invariance gate; artifact regeneration; provenance hashes | `test_gate_benchmark_protocol.py`, `EVIDENCE.md` | Low |
| T3 | Silent test leakage reintroduced | Mandatory release gate runs the real pipeline with mutated test labels | Release gate 1 (falsified twice) | Low |
| R1 | Decisions repudiated | Append-only receipt-linked decision ledger + provenance-complete logs (`integrity.py`, `main.py`) | `test_serving_integrity.py`, `test_batch_b.py` | Medium: single-node JSONL, no log write-once controls (catalog `govern_log_immutability_controls`) |
| I1 | Transaction payload disclosure via logs | Redaction-by-construction: structured logs carry ids/provenance only; tests assert payload absence (`integrity.py`, `main.py`) | `test_batch_b.py` (caplog assertions) | Low |
| I2 | Raw dataset exposure | External data gitignored; anonymized (PCA) dataset documented; no dataset endpoints | `.gitignore`, `DATA_PROVENANCE.md` | Low |
| I3 | Error-detail disclosure | Some error paths return exception text (e.g., receipt schema validation) | `test_receipt_verification_edge_cases` | **Medium-low**: catalog `privacy_error_disclosure` open; no internals/paths leak observed |
| D1 | API abuse/DoS | Per-client token bucket with 429; `BodySizeLimitMiddleware` rejects declared bodies above `AEGIS_MAX_BODY_BYTES` (default 1 MiB) with 413 before reading (`apps/api/main.py`) | `test_serving_integrity.py`, `test_batch_f.py` (4 cases) | **Low**: chunked/streaming bodies without Content-Length bypass the size check (documented limitation); single process caps impact |
| D2 | Duplicate financial effects | Idempotent scoring: replay returns original decision without re-applying effects | `test_serving_integrity.py` | Low (cache is process-local; restart reprocesses — documented) |
| E1 | Elevation via policy mutation | `require_admin_key` on `optimize-policy` + `emergency-stop`; `AEGIS_ADMIN_API_KEY` is a superset credential, ordinary key never grants admin; `admin_auth_mode` reported in `/api/health` (`apps/api/main.py`) | `test_batch_f.py` (3 modes incl. privilege separation) | **Local-context mitigated**: admin surfaces stay open when no keys are configured (documented local-open mode) |
| E2 | Container privilege | Dedicated non-root user `aegis` (UID 10001, no shell) added to the image; slim base; no secrets baked; volumes for artifacts | `infra/Dockerfile.api` | **Medium-low**: change is UNVERIFIED — Docker daemon unavailable (NEXT-02); verify image build before any deployment claim |
| E3 | Supply chain (dependencies) | Pinned bounds; no lockfile/audit | — | **OPEN** (catalog `privacy_dependency_audit`) |

## 3. AI-specific risks (NIST AI RMF Map/Measure, voluntary reference)

- **Invalid metrics claims:** mitigated by the single-artifact evidence chain,
  validation-only selection, and honest-number syncing; residual: reports are
  regenerated manually (catalog `exp_repro_check`).
- **Hidden degraded states:** mitigated by `calibration_source`,
  `artifact_status`, `/api/ready`, degraded UX contract; verified by gates/E2E.
- **Unsafe automated decisions:** kill switch forces REVIEW; readiness
  reflects it; ledger records it. Residual: no challenge-capacity constraint
  (documented in OPTIMIZATION_METHODOLOGY.md).
- **Untraceable decisions:** per-decision provenance (model, policy, run id,
  calibration source, receipt) in responses, ledger, and logs.

## 4. Top open security items (tracked in the catalog)

1. `privacy_dependency_audit` (P1) — no CVE scanning today.
2. `privacy_container_hardening` (P2) — further image hardening beyond the
   non-root user (read-only fs, dropped capabilities).
3. `registry_signature_verification` (P2) — checksums prove integrity, not origin.

Closed in Milestone 3 batches D/F: `authn_apikeys`, `authz_admin_surface`,
`api_input_size_limits`, `deploy_nonroot_user` (code landed; container build
verification still pending NEXT-02).

## 5. Verdict

For its **declared deployment context** (localhost, single user, demonstration
system), the residual risk is acceptable and honestly documented. The open
items above are prerequisites before any multi-user or internet-exposed
deployment — they are catalog-tracked, not hand-waved.
