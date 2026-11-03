# Campaign 03 — Architecture Intelligence Lab: Execution Plan

**Project:** TRACEN — System Design Made Visual
**Campaign:** 03 — Architecture Intelligence, Causal Simulation & Verification Lab
**Status:** IN EXECUTION — see `docs/campaign-03-architecture-intelligence-checklist.md` for the
live work-package status. This document records the plan, decisions, and architecture.
It is updated as milestones complete; nothing is claimed here without a matching
verification record in the checklist.

## 0. Repository reality check (execution contract, performed first)

Findings from inspecting the actual repository before any code was written:

1. **Stack:** React 19 + Vite + TypeScript + Tailwind in `apps/web`; vitest + Playwright for
   tests; Python fraud platform in `packages/` (unrelated to this campaign but protected by
   repo AGENTS.md release gates).
2. **Existing learning product:** the Foundations trail (`apps/web/src/trail/`) — 20 topics,
   pure deterministic sim logic in `sims/logic.ts`, hash routing, localStorage progress,
   completion earned by sim interaction + correct quiz answer.
3. **Campaign 01 / 02 status:** the repo contains a single trail campaign ("Foundations:
   First 20 Topics"), verified in `docs/system-design-test-report.md` and
   `docs/system-design-build-evidence.md`. **No Architecture Studio, component canvas,
   scenario designer, requirements mapper, ADR system, failure injection workbench,
   architecture comparison, or guided design challenges exist yet.**
   The Campaign 03 briefing assumed these exist; they do not.
4. **Baseline verification (before any change):** `npm test` in `apps/web` →
   3 files / 61 tests passed. Working tree clean at commit `a72221b`.

**Consequence (documented limitation, per the campaign contract):** Campaign 03 cannot
"extend an existing Studio" — it must build the Architecture Intelligence Lab substrate
itself: the canonical architecture model, the design surface, and the intelligence layer.
The Lab is built **in the spirit of the trail conventions** (content/data separation,
pure deterministic logic, hash routing, localStorage, no new runtime dependencies),
because those conventions are the strongest verified engineering patterns in this repo.

## 1. Product objective

An **Architecture Intelligence Lab** where a learner can:

1. express architecture intent (requirements, constraints, assumptions, ADRs),
2. build/edit an architecture on a shared canonical model,
3. analyze causal failure propagation and blast radius,
4. generate explainable architecture alternatives and run counterfactual experiments,
5. reason about latency, reliability, capacity, cost/risk/complexity trade-offs,
6. check data consistency, ownership, event evolution, idempotency, and sagas,
7. review trust boundaries, data lineage, authorization, and tenant isolation,
8. replay modeled behavior through an Architecture Flight Recorder,
9. design chaos experiments and get evidence-backed recovery verdicts and scorecards,
10. generate explanations, critiques, challenges, and a final evidence package.

**Honesty contract (non-negotiable):** every analysis is a *modeled, educational* result.
Outputs carry their rule/assumption provenance; nothing is presented as a production
benchmark. Simulations are deterministic and seeded where stochastic.

## 2. Architecture

New module `apps/web/src/lab/`, mounted as a new dashboard view (like the trail):

```
apps/web/src/lab/
├── model.ts            # canonical Architecture IR: schema, validation, versioning,
│                       #   migration, serialize/parse, deep clone, diff, stable IDs
├── samples.ts          # seed architectures (docs SaaS, checkout, …) + campaign scenarios
├── store.ts            # localStorage persistence behind an injectable storage interface
├── engines/            # ALL intelligence logic: pure, deterministic, unit-tested
│   ├── intent.ts       # T01 intent coverage analyzer
│   ├── graph.ts        # T03 semantic dependency / operation / causal graph + cycles
│   ├── ledger.ts       # T04 versioned design ledger (snapshots, classification)
│   ├── constraints.ts  # T05 constraint taxonomy, missing context, conflicts
│   ├── genome.ts       # T06 architecture genome + fingerprint + comparison
│   ├── mutations.ts    # T07 mutation operators with preconditions + explanation
│   ├── counterfactual.ts# T08 controlled counterfactual experiments
│   ├── causal.ts       # T09 causal failure propagation engine
│   ├── blastradius.ts  # T10 criticality + reachability + isolation analysis
│   ├── traffic.ts      # T11 seeded traffic/queue dynamics
│   ├── latency.ts      # T12 end-to-end latency budget composer
│   ├── slo.ts          # T13 SLO + error budgets
│   ├── resource.ts     # T14 saturation & bottleneck explorer
│   ├── tradeoff.ts     # T15 cost/risk/complexity frontier + sensitivity
│   ├── consistency.ts  # T16 consistency contracts
│   ├── ownership.ts    # T17 transaction boundary / data ownership auditor
│   ├── eventschema.ts  # T18 event schema evolution lab
│   ├── idempotency.ts  # T19 idempotency lifecycle
│   ├── saga.ts         # T20 saga state-machine verifier
│   ├── trust.ts        # T21 trust boundaries
│   ├── lineage.ts      # T22 data lineage / privacy exposure
│   ├── authz.ts        # T23 authorization flow simulator
│   ├── tenant.ts       # T24 multi-tenant isolation analyzer
│   ├── adversarial.ts  # T25 adversarial path generator
│   ├── observability.ts# T26 telemetry coverage analyzer
│   ├── trace.ts        # T27 synthetic trace reconstruction
│   ├── flightrecorder.ts# T28 event recording + time-ordered replay
│   ├── drift.ts        # T29 architecture drift detector
│   ├── runbook.ts      # T30 recovery runbook generator
│   ├── chaos.ts        # T31 chaos experiment designer/reviewer
│   ├── testsynth.ts    # T32 resilience test synthesis
│   ├── orchestrator.ts # T33 fault-injection orchestrator
│   ├── recovery.ts     # T34 recovery evidence verdicts
│   ├── scorecard.ts    # T35 transparent multi-dimensional scorecard
│   ├── explain.ts      # T36 architecture explanation compiler
│   ├── challenges.ts   # T37 adaptive challenge generator
│   ├── critic.ts       # T38 evidence-grounded architecture critic
│   ├── debate.ts       # T39 decision debate workspace model
│   ├── mission.ts      # T40 design-under-constraints mission
│   ├── benchmark.ts    # T41 intelligence benchmark suite (corpus + metrics)
│   ├── package.ts       # T42 reproducible experiment packages
│   ├── extension.ts    # T43 component extension contract + registration
│   ├── modes.ts        # T44 expert/beginner presentation levels
│   └── capstone.ts     # T45 capstone evidence package
├── LabApp.tsx          # view shell: hash routes (#/lab/…), architecture picker, panels
├── panels/             # thin presentational panels per analysis group (render engine output)
└── __tests__/          # vitest suites per engine (one file per milestone batch)
```

**Core design decisions**

- **Single canonical model (Global Req. A).** Every engine consumes
  `ArchitectureModel` from `model.ts`. No engine keeps a private architecture format.
- **Findings as the universal analysis output.** Engines return typed findings
  `{id, severity, title, detail, evidence[]}` where evidence names the exact component,
  connection, requirement, rule, or assumption — enforcing "evidence before claims" (Req. C)
  and letting one generic renderer present any analysis.
- **Pure engines.** All engine code is deterministic, DOM-free, dependency-free, and
  unit-tested directly — mirroring the trail's `sims/logic.ts` pattern (its strongest
  verified convention). React panels only render results and dispatch actions.
- **Stable IDs, immutable snapshots.** IDs are assigned once; ledger snapshots deep-clone
  and never alias live state; restore returns a fresh clone (Req. D).
- **Versioned schema + migration.** `MODEL_VERSION` with `migrate()`; unknown versions
  are rejected loudly, never silently migrated (Req. D).
- **No new runtime dependencies; hash routing; localStorage behind an injected storage
  interface** — same rules as the trail (they are the repo's verified conventions).

## 3. Status bookkeeping

- The **master checklist** is `docs/campaign-03-architecture-intelligence-checklist.md`.
  Every work package has: stable ID, description, dependencies, acceptance criteria,
  expected evidence, status (`NOT_STARTED | IN_PROGRESS | BLOCKED | DONE`), and notes.
- The **single source of truth for statuses** is `docs/campaign-03-status.json`
  (machine-readable, one entry per work package). The checklist is *generated* from it by
  `python scripts/gen_campaign03_checklist.py`, which also computes the summary
  (totals, remaining, verified %) — no hand-invented percentages.
- A work package is `DONE` only after its behavior is verified (tests executed, output
  inspected) and the verification is recorded in the checklist.

## 4. Execution order

Milestones follow the campaign brief (M1 01–05, M2 06–10, …, M9 41–45), engines before UI:
within each milestone the vertical slice is *engine + tests first*, then panels once a
group of engines is verified. Commits checkpoint each milestone so the campaign can resume
from the first unfinished work package after any interruption.

## 5. Known limitations (honest, updated as work proceeds)

- There is no pre-existing Studio to extend; the Lab builds its own minimal design surface
  (structured editor + canvas rendering of the canonical model), which is intentionally
  simpler than a full diagram editor — the campaign's value is the intelligence layer.
- Simulations are educational, deterministic, closed-form or discrete-time models with
  explicit assumptions; they are **not** production load tests, and the UI labels them as
  modeled results.
- E2E (Playwright) is run for the primary user flow (open lab → analyze → experiment →
  evidence report) against `vite preview --port 4173`, matching the trail's approach.
