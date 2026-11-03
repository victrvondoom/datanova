# Workflow Studio Architecture — Multi-Agent Orchestration

Campaign 07. This document describes the Multi-Agent Workflow Studio: 11 named
financial workflows, 110 specialized agents, and a deterministic DAG
orchestration engine — all executing real structured work, integrated as the
"Workflow Studio" section of the Datanova Atlas shell (`#/atlas/agents`).

## What was built (and what it is NOT)

**Built:** a real multi-agent orchestration product experience where agents
execute actual deterministic rule-based work, exchange structured artifacts
with evidence references through orchestrator-mediated handoffs, pause at
human checkpoints, and persist every transition before the UI renders it.

**NOT built (honestly):** there is no LLM inference. Every agent's
`model.kind` is `deterministic-rules` — executors are pure functions over the
case dataset and upstream artifacts. No live connector (Slack, Lambda billing,
Kubernetes, W&B, Ironclad, CoreWeave, Nebius, external disputes) is
configured; they are adapter targets reported as **NOT CONNECTED**. Runs
execute against clearly-labeled synthetic datasets in simulation-mode
semantics. See `docs/WORKFLOW_STUDIO_ACCEPTANCE.md` for the gap analysis
against the original assignment (which targeted a different stack: Fastify,
Vultr, PostgreSQL, SSE — none of which exist in this repository).

## Module map (`apps/web/src/agents/`)

| File | Responsibility |
|---|---|
| `types.ts` | Strict contracts: agents, workflows, runs, tasks, artifacts, evidence, handoffs, approvals, external actions, events |
| `catalog.ts` | 110 agent specs: role, capabilities, tools + permissions, input/output fields, evidence requirements, financial authority, timeout, retry policy, memory scope, guidance |
| `workflows.ts` | The 11 persisted workflow definitions: nodes, edges, parallel groups, conditional branches, approval checkpoints, completion conditions |
| `datasets.ts` | Seeded synthetic case datasets (one per workflow) |
| `executors.ts` / `executors2.ts` | The agents' actual work: pure deterministic executors per agent (workflows 01–04 / 05–11) |
| `engine.ts` | The orchestrator: validation, wave scheduling, join barriers, branch routing, retries, human approvals, idempotency, mode enforcement, injection defense |
| `store.ts` | Persisted run records (localStorage behind an injectable storage interface; tenant-scoped) |
| `benchmark.ts` | Executed multi-agent collaboration benchmark (all 11 workflows) |
| `infra.ts` | Infrastructure map with a REAL HTTP health probe |
| `layout.ts` | Deterministic canvas layout (columns = dependency depth) |
| `AgentStudio.tsx` | Canvas / Board / Audit Trail / Infrastructure views + agent inspector |

## Execution model

- **Workflow DAG** with node kinds: `data`, `agent`, `condition`, `approval`,
  `output`. Definitions are validated before activation: unique ids, no
  dangling edges, no cycles (bounded loops are rejected), every agent node
  references a catalog agent, every workflow has a human-approval checkpoint,
  every sensitive agent is preceded-or-followed by one, and every external
  output is downstream of a human approval.
- **Strict wave semantics**: `stepRun` computes the ready set at wave start;
  parallel-group members execute in the same wave; joins wait for all incoming
  edges on taken paths. A not-taken branch edge is *satisfied* for joins and
  skipped tasks cascade honestly (`task.skipped` events).
- **Structured collaboration**: every executed node creates one handoff per
  incoming delivered edge, carrying source/target agent, input artifact ids,
  **evidence ids** (never just the previous agent's summary), requested
  operation, required output fields, policy constraints, deadline, trace id.
- **Failure recovery**: executor failures persist the error, preserve inputs,
  retry only per the agent's bounded policy (`task.retry` events), then fail
  permanently — all transitive dependents become `blocked`, the run is
  `failed`, and **no fabricated downstream success exists**.
- **Human-in-the-loop**: `approval` nodes pause the run
  (`paused-approval`); `resolveApproval` records the human decision as an
  artifact and resumes from the checkpoint. Supervised mode additionally
  gates every sensitive agent behind a per-node human decision.
- **Idempotency**: events are applied by unique id (`applyEvent` no-ops
  duplicates); external actions are keyed
  (`runId:nodeIdempotencyKey`) — a duplicate application is reconciled, never
  re-executed.
- **Determinism**: seeded PRNG, logical ticks, no wall-clock in the engine.
  Identical runs produce identical task states, artifacts and events
  (asserted by the benchmark on every run).
- **Restart recovery**: runs (including their bound dataset and def
  snapshot) serialize to JSON; resume-after-restart is `JSON.parse` +
  `stepRun` (tested).
- **Red-team defense**: red-team runs carry an adversarial payload; the
  engine asserts no artifact leaks it (`assertNoInjectionLeak` → policy
  violation + run failure), and the procurement red-team agent quarantines
  instruction-override text in untrusted listings as data.

## Execution modes (engine-enforced, not UI decoration)

| Mode | Behavior |
|---|---|
| `simulation` | Synthetic adapters; external actions recorded in the action ledger as simulation-only |
| `investigation` | External output actions are **withheld** (`action.withheld`) and the outcome says so |
| `supervised` | Every sensitive agent requires a human decision before executing |
| `red-team` | Adversarial payload injection defense, verified by the engine |
| `standard` | **Refused** — requires configured live connector adapters; none exist here |

## Safety properties

- All 110 agents have `authorityLimit.max = 0` — propose-only; no agent can
  finalize a financial action. Human approval is the only authorization path.
- The engine never reads wall-clock time and never invents execution states;
  the UI renders only persisted run records.
- Tenant scoping: every task, artifact, evidence record, handoff, approval
  and event carries the run's tenant; the store rejects cross-tenant reads.

## Reproduction

```bash
cd apps/web
npx vitest run src/lab/__tests__/c07-agents.test.ts   # 36 engine/benchmark tests
npx playwright test e2e/agents.spec.ts                # 5 app-level E2E
npx playwright test e2e/agents-visual.spec.ts         # visual capture
```
