# Infrastructure Map

The Infrastructure Map (Workflow Studio → Infrastructure tab) shows the ACTUAL
runtime topology of this repository's multi-agent workflow execution. Health
is measured or configuration-derived — never invented.

## Components and how their state is known

| Component | State | Probe | Detail |
|---|---|---|---|
| Datanova Web Application (Vite) | LOCAL | builtin | Browser app: Atlas shell + Workflow Studio |
| Agent Orchestrator | LOCAL | builtin | In-app deterministic DAG engine (`src/agents/engine.ts`) — no LLM calls |
| FastAPI Backend (/api/health) | HEALTHY / OFFLINE | **HTTP** (real fetch at view open) | The fraud-scoring API; probed live via `checkHealth()` |
| Run / Event Store | LOCAL | builtin | localStorage-backed persisted runs, events, artifacts, approvals |
| Evidence Store | LOCAL | builtin | In-run structured evidence records (claim + source per output) |
| Live LLM Inference | NOT CONNECTED | configuration | No inference endpoint configured — agents are deterministic rule executors |
| Slack | NOT CONNECTED | configuration | Connector target, no credentials |
| Lambda GPU Billing | NOT CONNECTED | configuration | Connector target, no credentials |
| Kubernetes Records | NOT CONNECTED | configuration | Connector target, no credentials |
| Weights & Biases | NOT CONNECTED | configuration | Connector target, no credentials |
| Ironclad Contracts | NOT CONNECTED | configuration | Connector target, no credentials |
| External Disputes | NOT CONNECTED | configuration | Connector target, no credentials |

## How a run travels through the platform

Case dataset → **Web App** → **Agent Orchestrator** (wave scheduling, branch
routing, retry/approval policy) → **Run/Event Store** (persisted state, the
single source of truth for the UI) + **Evidence Store** (claims with sources)
→ **Web App** (Canvas/Board/Audit views render only persisted records).

No other component participates. The FastAPI backend and fraud engines are
NOT involved in workflow runs (the studio is a self-contained deterministic
subsystem of the frontend); the backend's health is still shown because it is
part of the real runtime and its state is measured, not assumed.

## Honesty rules

- The API probe performs a real HTTP request on view open and reports
  HEALTHY or OFFLINE exactly as observed (E2E-verified in both states).
- Every connector is reported NOT CONNECTED because no credentials or adapter
  registrations exist. Standard execution mode is refused by the engine for
  the same reason.
- External actions in simulation mode are recorded in the action ledger with
  an explicit "simulation adapter only" note; in investigation mode they are
  withheld.
