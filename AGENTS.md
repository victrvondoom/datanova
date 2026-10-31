# AEGIS-Fraud X — Engineering Instructions for AI Agents

1. Read `PROJECT_CONTEXT`-level docs (`README.md`, `AUDIT_FINDINGS.md`, `EVIDENCE.md`,
   `LIMITATIONS.md`) before changing code.
2. Never fabricate results. A claim without a reproduction command is not a result.
3. Never remove or weaken tests to make a build pass.
4. Never select models, tune thresholds, or fit any preprocessing on the held-out TEST
   partition. Selection and fitting belong on TRAIN/VALIDATION; TEST is evaluated once.
5. Never change public interfaces (`packages/data/schemas.py`, API routes) without
   assessing all callers (API, frontend `apps/web/src/api.ts`, tests).
6. Add a regression test for every corrected bug; reference its issue ID from
   `AUDIT_FINDINGS.md`.
7. Every benchmark must be reproducible: seeded inputs, versioned artifacts under
   `benchmarks/runs/`, regenerable via `python scripts/run_benchmarks.py`.
8. Every metric displayed in the frontend must originate from the API or be clearly
   marked `degraded: true` as an offline fallback. The presentation layer must not
   invent data.
9. Never claim completion without evidence: run `pytest`, `mypy`, `ruff` and (for UI
   changes) `npm run build` before reporting done.
10. Preserve the product's core purpose: cost-aware, explainable, real-time payment
    fraud prevention (DN-FN-01). Do not import unrelated product assumptions.

## Standard verification commands

```bash
python -m pytest tests/ -q -W ignore          # full suite (41 tests)
python -m mypy packages apps scripts --ignore-missing-imports
python -m ruff check .
python scripts/run_benchmarks.py              # regenerates benchmarks/runs + reports
cd apps/web && npm run build                  # frontend type-check + build
```
