# Campaign 04 — Architecture Intelligence & Counterfactual Systems Lab

**Repo:** `datanova` · **Branch:** `master` · **Baseline:** commit `d656038`
(Campaign 03 complete: all 225 C03 work packages verified; see
`docs/campaign-03-build-evidence.md`).

## What this campaign is

Campaign 04 continues the Architecture Intelligence Lab from its **verified
Campaign 03 state**. It is not a rebuild: an inspection pass mapped all 45
campaign tasks against the existing implementation, and 43 of them map onto
already-verified C03 capabilities (canonical IR, semantic/causal graphs,
ledger, genome, mutations, counterfactuals, traffic/latency/SLO/resources,
consistency/ownership/idempotency/saga, trust/lineage/authz/tenant/adversarial,
observability/traces/flight-recorder/drift/runbooks, chaos/orchestrator/
recovery/scorecard, explanations/challenges/critic/debate/mission, packages,
extension SDK, capstone).

Campaign 04 therefore concentrates its new engineering on the gaps the C03
report itself identified, plus the capabilities the C04 brief adds that do not
exist yet:

| New capability | Task(s) | Module |
|---|---|---|
| Screen-reader / accessibility-tree E2E + manual SR protocol | 01 | `e2e/lab-a11y.spec.ts`, `docs/campaign-04/screen-reader-protocol.md` |
| Multidimensional benchmark (beyond critic rules) with versioned runs and CI regression gates | 02, 44 | `engines/benchmark2.ts` |
| Campaign architecture & dependency inventory (verified, code-grounded) | 03 | `docs/campaign-04/architecture.md` |
| Determinism audit: serialization stability, replay proofs, controlled time | 04 | audit + `__tests__/c04.test.ts` |
| Evidence & provenance infrastructure (artifact schema, capture, kinds, export) | 05 | `engines/evidence.ts` |
| Intent compiler: structured intent → reviewable starter model with unresolved fields | 06 | `engines/intent-compiler.ts` + Intent tab |
| Scenario engine: versioned workload+fault scenarios bound to snapshots | 16 | `engines/scenario.ts` |
| Recovery timeline & state reconstruction | 20 | `engines/recovery-timeline.ts` |
| Sensitivity & uncertainty analysis | 25 | `engines/sensitivity.ts` |
| Tenant-isolation test matrix generator | 34 | `engines/tenantmatrix.ts` |
| Capstone journey extension (Intent → … → Evidence) | 45 | `engines/capstone.ts` + panels |

Everything else was **audited against the C03 implementation and re-verified
in this campaign's runs** — the task ledger records, per work package, whether
the capability exists from C03 (with its original evidence) or is new in C04.

## Documents

- `README.md` — this file.
- `task-ledger.md` — all 45 tasks × 5 work packages with statuses
  (`NOT STARTED` / `IN PROGRESS` / `BLOCKED` / `VERIFIED`), acceptance results,
  and evidence references.
- `architecture.md` — the code-grounded architecture and dependency inventory.
- `decision-log.md` — engineering decisions taken in this campaign.
- `test-and-evidence-report.md` — exact commands, results, and evidence index.
- `known-limitations.md` — honest gaps that remain.
- `screen-reader-protocol.md` — manual assistive-technology test protocol.

## Status convention

A work package is `VERIFIED` only when its acceptance condition passed in an
executed check. For capabilities inherited from Campaign 03, the ledger cites
the original C03 test evidence **and** the re-verification run performed in
this campaign (the full suite was re-run at campaign start and again at the
end). No score is fabricated, no synthetic result is presented as real-world
validation, and no simulation output is presented as production telemetry.

## Final status (computed from `task-ledger.md`)

- Major tasks: **45/45 VERIFIED** (0 in progress, 0 blocked, 0 not started).
- Work packages: **225/225 VERIFIED** — 100% verified completion.
- Final verification (all executed; exact commands in
  `test-and-evidence-report.md`): vitest **286/286** · oxlint **0** ·
  `npm run build` ✓ · Playwright **24/24** (phase A offline 23 + phase B
  online 1) · pytest **141/141** + release gates **12/12** · mypy clean ·
  ruff clean.
- Outstanding honest gaps (see `known-limitations.md`): manual
  screen-reader testing **NOT YET RUN** (protocol delivered); benchmark v2
  is a synthetic self-consistency instrument, not external validation.

