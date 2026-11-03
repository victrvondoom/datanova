# Causal Simulation Model (Campaign 03, Tasks 09/28/33)

**Implementation:** `engines/causal.ts` (rules + propagation),
`engines/flightrecorder.ts` (recording/replay), `engines/orchestrator.ts`
(multi-fault plans). Tests: `__tests__/m2, m6, m7`.

## Rules (all explicit, all with confidence)

| Rule | Meaning |
|---|---|
| R-INIT-DOWN / R-INIT-SLOW | injected fault sets the target down / doubles its latency factor |
| R-SYNC-BLOCK | a sync dependency that is down with `blocks` takes its caller down |
| R-SYNC-DEGRADE | a dependency that is down with `degrades` (or async) degrades its caller |
| R-SYNC-DEP-DOWN-DEGRADES | a sync caller of a degraded dependency degrades |
| R-LATENCY-PROP | a degraded sync dependency multiplies the caller's modeled latency factor |
| R-QUEUE-GROW | a down worker with an upstream queue grows the queue depth |
| R-RETRY-AMP | a caller with retries facing a degraded dependency multiplies its load factor (1+retryMax) |
| R-ASYNC-NO-LOSS | isolated/asynchronous edges stop propagation (recorded once, transparently) |

## Algorithm

Deterministic fixpoint over monotone state variables (status up→degraded→down,
latency/load factors). Termination is guaranteed because (a) statuses only
escalate, and (b) latency and retry amplification are applied AT MOST ONCE per
edge per injected fault — cyclic graphs converge (tested with a cycle fixture).
Every state change is recorded as an event carrying the rule, cause, causal
path from the origin, and confidence.

## What it does NOT model

Real timings, provider-specific behavior, partial capacity degradation
provisioning, network partitions with quorum effects, or human response times.
Queue depth is expressed in "rounds with the worker down", not messages.

## Flight recorder

Events are append-only (`record` returns a NEW recording), imported from
propagation with causal links, and replayed by a pure fold (`stateAt`) — the
modeled state at any sequence number is always reproducible. Recordings that
reference unknown components are flagged by `integrityIssues` instead of
crashing replay.
