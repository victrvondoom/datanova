# Workflow Studio — UI / Backend Coverage

How each visible UI capability maps to engine behavior and its verification.
The UI never invents execution state: every rendered state is derived from
persisted run records.

## Canvas

| UI capability | Engine source | Verified by |
|---|---|---|
| Workflow selector (11) | `WORKFLOWS` registry (persisted definitions) | e2e "11 named workflows" |
| Run Workflow | `createRun` (validates def; binds dataset; mode enforced) | e2e GPU billing run |
| Pause / Resume / Stop | `pauseRun` / `resumeRun` / `cancelRun` (persisted events) | unit tests: pause/resume, cancel |
| Pan / zoom / fit / minimap / node drag | view-layer transforms (`layout.ts` overrides are visual only, never semantic) | visual capture 02/09 |
| Node status + counters (done/running/queued) | `task.status` per persisted task | e2e board/canvas |
| Flow animation | ONLY on edges whose source node is currently running (real events; disabled under prefers-reduced-motion) | CSS `wf-flow-edge` |
| Node selection → inspector (18 sections) | catalog spec + run records (artifacts, evidence, handoffs, findings) | e2e inspector on Cost Allocator |
| Edge selection → connection inspector | edge kind, condition spec, live edge state (`delivered`/`inactive`) | unit: branch routing |
| Replay run (read-only) | `replayRun` — engine refuses to mutate | unit: replay test |
| Reset demo | deletes persisted runs for the demo tenant only | e2e (localStorage cleared per test) |

Not implemented (honest): graph editing is deliberately NOT exposed in the
UI — the campaign's own rule is that frontend editing must never grant
privileges. Workflow configurations are versioned data; a future editor must
round-trip through `validateWorkflowDef` + backend policy (see Acceptance
doc).

## Board

Columns Pending / Queued / Running / Waiting for Human Approval / Recovering /
Completed / Failed / Blocked / Skipped — each card is a persisted
`TaskRecord` (status, wave, duration ticks, latest output, error, next
action). Clicking a card opens the node in the canvas (e2e-verified).
Drag-to-reassign is intentionally absent: no UI operation may silently change
execution dependencies.

## Audit Trail

Chronological, persisted `WorkflowEvent` list (per run) covering
`workflow.created/validated/started/paused/resumed/completed/failed/cancelled`,
`agent.started/output.created/handoff.created/failed`,
`task.queued/started/completed/retry/failed/blocked/skipped`,
`evidence.created`, `finding.created`, `branch.evaluated`,
`approval.requested/resolved`, `action.executed/withheld/rejected/reconciled`.
Events are idempotent by id (unit-verified).

## Infrastructure Map

Real HTTP probe of `/api/health`; connectors reported NOT CONNECTED by
configuration; run participation honestly limited to web app, orchestrator,
run store, evidence store. Both API states E2E-verified (healthy in the
online journey run; offline elsewhere).

## Backend/API boundary (honest statement)

This repository's backend is FastAPI (fraud scoring). The workflow engine is
a frontend-resident deterministic subsystem with localStorage persistence —
the same architecture pattern as the verified TRACEN trail and Atlas engines.
What that means:

- Runs, events, artifacts, evidence, handoffs and approvals ARE persisted
  (survive refresh; resume-after-restart unit-tested) — but in the browser's
  local store, not in server-side tables. There is no SSE/WebSocket stream:
  the UI re-derives from the store each tick and after refresh.
- "Tenant" is a logical scope on every record with store-level isolation
  checks; real multi-tenant authn/authz lives in the backend for fraud data
  only.
- Server-side execution (workflow_runs tables, event stream, backend policy
  gateway for workflow activation) is the main integration gap — recorded in
  the Acceptance document rather than claimed.
