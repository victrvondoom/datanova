# Campaign 03 — Build & Execution Evidence

This file records what was actually built and how each claim was verified.
The machine-readable work-package status (with per-WP evidence notes) is
`docs/campaign-03-status.json`; the rendered checklist is
`docs/campaign-03-architecture-intelligence-checklist.md`
(regenerate: `python scripts/gen_campaign03_checklist.py`).

## Status summary (computed from the checklist state)

- Total major tasks: 45
- Total work packages: 225
- Completed work packages: **225** (verified, not just written)
- Verified completion: **100%**
- Execution: 10 commits on `master`, one checkpoint per milestone.

## What shipped

**Canonical model + engines** (`apps/web/src/lab/`, ~5,300 lines of engine/model code,
all pure and unit-tested):

- `model.ts` — typed Architecture IR, validation, versioning/migration,
  round-trip serialization, classified diffs, shared evidence-linked Finding type.
- 40 engine modules implementing Tasks 01–45 (intent, graph, ledger,
  constraints, genome, mutations, counterfactual, causal, blast radius,
  traffic, latency, SLO, resources, trade-offs, consistency, ownership,
  event evolution, idempotency, saga, trust, lineage, authorization, tenant,
  adversarial, observability, trace, flight recorder, drift, runbook, chaos,
  test synthesis, orchestrator, recovery, scorecard, explain, challenges,
  critic, debate, mission, benchmark, packages, extensions, modes, capstone).

**UI** (`LabApp.tsx`, `ui.tsx`, `router.ts`, `store.ts`, 8 panels): the
Architecture Intelligence Lab view in the existing dashboard (sidebar item
"Architecture Lab", hash routes `#/lab/...`), with a zone-grouped SVG canvas,
failure injection, flight-recorder replay, chaos designer, mutation workspace,
package import/export, critic/scorecard/debate/mission, and the capstone
evidence package + benchmark report.

**Fixtures:** `samples.ts` — DocFlow reference SaaS (complete intent: 10
requirements, 4 assumptions, 2 ADRs, 5 operations, 3 data entities, events,
SLOs, latency budget, consistency contracts, policies) and the intentionally
flawed checkout used by the benchmark corpus.

**Tooling:** `scripts/gen_campaign03_checklist.py` — statuses are data
(`docs/campaign-03-status.json`), the checklist and its summary are generated,
never hand-written.

## Verification record (commands and outcomes)

See `docs/campaign-03-test-report.md` for the full table. Headlines:

- Frontend: `npm test` 253/253; `oxlint` 0 findings; `npm run build` OK;
  `npx playwright test e2e/lab.spec.ts` 6/6 against `vite preview --port 4173`.
- Platform (repo gates, unaffected but re-run per AGENTS.md): `pytest` 141/141
  incl. release gates; `mypy` clean (59 files); `ruff` clean.

## Honesty statement

- Every simulation declares its assumptions in its output and UI ("modeled,
  not measured"; traces are "illustrative"; costs are "declared assumptions,
  not pricing").
- No aggregate architecture score exists anywhere in the product.
- The benchmark report renders only executed runs; the latest executed result
  (precision 1.000 / recall 1.000 / unsupported-claim rate 0.000) is from this
  session's code.
- Known verification gaps (pre-existing journey e2e environment failures, a
  flaky visual baseline under concurrency, no automated SR-only pass) are
  recorded in the test report rather than hidden.
