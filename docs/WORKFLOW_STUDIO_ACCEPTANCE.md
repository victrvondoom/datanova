# Workflow Studio — Acceptance Report

Campaign 07 acceptance against the assignment, with the adaptation note and
the honest gap list. Build/test status at the end.

## Adaptation note (read first)

The assignment targeted "RESOLVE" — a Fastify + PostgreSQL + Vultr product
with a pre-existing agent orchestrator and FinancialCase state machine.
This repository (AEGIS-Fraud X / Datanova Atlas) has **none** of that stack:
it is a React/Vite frontend with a FastAPI fraud-scoring backend, no server
tables for workflows, no SSE infrastructure, no live connectors. Per the
assignment's own inspection rule, the studio was therefore built as a real
multi-agent orchestration experience over THIS repository's actual
architecture: 11 named financial workflows, 110 deterministic agents, a pure
DAG engine with all required collaboration semantics, persisted runs, and
Canvas/Board/Audit/Infrastructure views — with every unavailable external
dependency explicitly refused or reported NOT CONNECTED instead of faked.

## Acceptance tests A–G (executed)

### Test A — GPU billing workflow ✅ (executed)
Run in the app (`e2e/agents.spec.ts`): invoice ingestion, the three parallel
auditors (lifecycle · usage · contract, proven same-wave by unit test), real
handoffs (168 across the suite), billing reconciliation, independent
verifier, computed findings ($3,600 billed / $2,400 supported / $1,200
unsupported → "Dispute $1200.00, pay $2400.00"), and a real human-approval
checkpoint that pauses execution and resumes on decision. **Executed.**

### Test B — Invoice passport workflow ✅ (executed)
Suspicious supplier invoice: sender SPF/DMARC failures, lookalike domain,
bank-account change detected → conditional branch taken → insider-risk
signals → passport state **HELD** → payment decision HOLD → human approval
required; a rejection records `action.rejected` honestly (e2e-verified).
Duplicate + PO checks in the same run. **Executed.**

### Test C — Dispute workflow ✅ (executed)
Contradictory evidence (internal 91.3% error rate vs provider-claimed 99.98%
availability), parallel evidence agents, confidence/contradiction review,
policy decision with recorded policy version, deterministic credit
computation ($1,050 vs claimed $4,200), human escalation, corrected-evidence
handling and historical preservation (trust-accounting workflow: corrected
statement supersedes while the original is preserved as evidence).
**Executed.**

### Test D — Failure recovery ✅ (executed, unit + benchmark)
Sabotaged lifecycle records: persisted failure, bounded retry on transient
faults (attempt → retry → permanent fail), blocked dependents, **no
fabricated output**, run honestly `failed`. Downstream resumption only after
a successful retry. **Executed.**

### Test E — Workflow editing ⚠️ PARTIAL (honest gap)
Workflow definitions are versioned data validated by
`validateWorkflowDef` (cycles, dangling edges, unknown agents, unguarded
sensitive agents and external outputs all rejected — unit-verified), and
every run snapshots its exact definition version. **What is NOT
implemented:** an interactive canvas editor (add/connect/configure nodes)
and a server-side activation policy. Per the campaign's safety rules
("workflow editing must not be able to bypass financial policy"), editing is
deliberately not exposed until backend-side validation exists. Gap recorded,
not claimed.

### Test F — Infrastructure map ✅ (executed)
Real LOCAL/configured states shown; the API is probed over HTTP and reports
HEALTHY/OFFLINE as observed (E2E-verified in both states across the
two-phase procedure); disconnecting a service (stopping the API) accurately
changes its health state. Connectors honestly NOT CONNECTED. **Executed.**

### Test G — Tenant isolation ✅ (executed, unit)
Cross-tenant reads/deletes rejected by the store; createRun refuses
dataset/tenant mismatch; every record carries the run's tenant. **Executed**
at the engine/store level. NOTE: real multi-tenant authentication is a
backend concern that does not exist for this frontend-resident subsystem —
the honest boundary is documented in WORKFLOW_UI_BACKEND_COVERAGE.md.

## Named-workflow coverage

All 11 workflows execute end-to-end with their full agent teams (see
WORKFLOW_AGENT_MATRIX.md and the measured benchmark). Execution modes:
simulation, investigation-only, supervised and red-team are engine-enforced;
standard is refused (no configured connectors). Voice-fraud workflow refuses
the deposit-account change by design.

## Build and test status (executed commands)

| Check | Result |
|---|---|
| `npx tsc -b` (apps/web) | clean |
| `npm test` (vitest, apps/web) | **435/435** (19 files; 36 new engine/benchmark tests) |
| `npx oxlint src` | **0 warnings, 0 errors** |
| `npm run build` | ✓ built in ~3.3 s |
| `npx playwright test` (offline phase) | 43/43 |
| `npx playwright test e2e/journey.spec.ts --grep "live backend"` (online phase, API started with CORS for :4173) | 1/1 |
| **Playwright total (two-phase)** | **44/44** (5 new agents e2e + 1 visual capture) |
| `python -m pytest tests/` | **141/141** |
| `python -m pytest tests/release/` | **12/12** (release gates) |
| `python -m mypy packages apps scripts --ignore-missing-imports` | clean |
| `python -m ruff check .` | clean |

Visual review: 9 screenshots captured from the real app at 1440×900 and
1024×700 in `docs/workflow-studio/screens/` (empty state, canvas running,
human checkpoint, approved canvas, agent inspector, board, audit trail,
infrastructure map, responsive).

## Known limitations (nothing hidden)

1. **No LLM inference.** Agents are deterministic rule executors — the
   collaboration semantics (waves, joins, branches, evidence, approvals) are
   real and tested; the "intelligence" per agent is rule-based logic over
   synthetic datasets. An inference-backed executor interface is a drop-in
   future extension (`ExecContext` is model-agnostic).
2. **Frontend-resident persistence.** Runs persist in localStorage, not in
   server tables; no SSE stream. Server-side runs, event stream and an
   activation policy gateway are the main future integration work.
3. **No interactive workflow editor** (Test E gap, see above).
4. **No connector is live** (Slack, Lambda, Kubernetes, W&B, Ironclad,
   CoreWeave, Nebius, external disputes) — honestly NOT CONNECTED; external
   actions are simulation-ledger entries or withheld.
5. **Tenant model is logical**, not authenticated backend tenancy.
6. **One human role**: the operator in the browser is the "human
   controller"; no separate reviewer identities exist in this environment.
7. **Deterministic synthetic data only** — no real customer, vendor or
   financial data exists in this repository, by design.
