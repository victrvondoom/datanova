# Architecture Validation Rules

Implemented in `apps/web/src/studio/validation.ts` (rules) and `apps/web/src/studio/requirements.ts` (requirement evidence).
Unit tests: `apps/web/src/studio/__tests__/validation.test.ts` (both detection **and** non-detection cases) and
`scenarios.test.ts`. 32 rules are implemented. This file is checked against the code by `docs.test.ts`:
every rule id must appear below.

## What a finding is — and is not

A finding is a **context-dependent warning**, never an automatic defect. Every finding carries:

1. **What was detected** — specific components named from the learner's diagram.
2. **Why it may be a problem.**
3. **Which requirement or risk it affects.**
4. **Which Foundations topic teaches it** (links to `#/trail/topic/NN`; only the existing 20 topics are referenced).
5. **Ways to address it**, and
6. **the trade-off of each option.**
7. A **context note** saying when the finding is acceptable (for example a single-instance MVP behind a managed edge).

There is **no single "correct" architecture**. Rules inspect structure only; nothing compares a design to a reference
solution. The worked examples in `blueprints.ts` are one valid design among many and are deliberately imperfect.

## Severity

| Severity | Meaning |
|---|---|
| critical | Direct harm is likely under ordinary retries/failures (e.g. duplicate charge). |
| high | A realistic failure propagates to users or silently corrupts/loses work. |
| medium | Weakens reliability, recovery or clarity; common to accept consciously. |
| info | Worth knowing; often fine early on. |

A rule's base severity can be raised or lowered by the specific hit (for example an unprotected scheduled job is **high**
with several instances and **medium** with one). Severity is always shown with a label and an icon, never colour alone.

## Rules

| Rule id | Severity | Review category | Detects | Teaching topics |
|---|---|---|---|---|
| `exposed-direct` | high | security | Service reachable directly from clients | 04, 05, 01 |
| `missing-timeout-external` | high | reliability | No timeout on an external dependency | 11, 10 |
| `missing-timeout-internal` | medium | reliability | No timeout on an internal remote call | 11 |
| `retry-unbounded` | high | reliability | Retry policy without a maximum attempt count | 12, 13 |
| `retry-too-many` | medium | reliability | Very high retry count | 12 |
| `retry-no-backoff` | high | reliability | Retries without backoff | 13, 12 |
| `retry-fixed-backoff` | medium | reliability | Fixed-interval retries | 13 |
| `payment-no-idempotency` | critical | consistency | Payment-like operation without idempotency protection | 14, 12, 15 |
| `idempotency-not-atomic` | high | consistency | Idempotency store without atomic claim | 14 |
| `queue-no-consumer` | high | functional | Queue with no consumer | 15 |
| `queue-no-failure-path` | medium | recovery | Queue with no failure-handling path | 15 |
| `queue-unbounded-delivery` | high | recovery | Queue redelivers without a limit | 15, 12 |
| `queue-not-durable` | medium | recovery | Queue does not persist messages | 15 |
| `worker-not-idempotent` | medium | consistency | Queue consumer may repeat side effects | 14, 15 |
| `dlq-unwatched` | medium | recovery | Dead Letter Queue nobody watches | 15 |
| `cache-no-expiry` | high | consistency | Cache without expiration or invalidation | 02 |
| `cache-sensitive-key` | high | security | Sensitive cached data without a per-user key | 02 |
| `cron-duplicate` | high | consistency | Scheduled job may run more than once | 20, 14 |
| `critical-dependency-unhandled` | high | reliability | Critical dependency with no failure-handling strategy | 10, 12, 13, 15 |
| `unnecessary-infrastructure` | info | complexity | Infrastructure with no stated requirement | 08, 03 |
| `data-ownership-unclear` | medium | consistency | Data ownership unclear across services | 18, 19 |
| `lb-no-health-check` | medium | reliability | Load-balanced tier without health checking | 03, 09 |
| `topic-no-subscriber` | high | functional | Topic with no subscribers | 16, 17 |
| `topic-no-publisher` | medium | functional | Topic with no publisher | 16 |
| `saga-no-compensation` | high | consistency | Saga without compensating actions | 19 |
| `saga-state-volatile` | medium | recovery | Saga state is not persisted | 19 |
| `tx-coordinator-blocking` | high | reliability | Two-phase commit blocks on a silent participant | 18 |
| `realtime-queue` | medium | scalability | Queue in the real-time path | 15, 04 |
| `no-observability` | info | observability | No observability on request-handling services | 17 |
| `policy-no-target` | medium | reliability | Reliability policy protecting nothing | 10, 11, 12 |
| `orphan-component` | info | maintainability | Component not connected to anything | — |
| `real-provider-claimed` | info | security | External service marked as real | — |

"Review category" maps each rule to one of the ten review categories (functional, reliability, scalability, consistency,
security, recovery, observability, complexity, cost, maintainability).

## Design notes on specific rules

- **Payment-like** (`payment-no-idempotency`): an app/web/worker component is payment-like if its property *Performs
  charge / billing-like operations* is set **or** its name matches `pay|bill|charge|checkout|order|invoice`
  (`graph.ts::isPaymentLike`). This is a heuristic; if the operation is naturally idempotent the finding is a false
  positive and the context note says to record that in an ADR.
- **Timeouts** (`missing-timeout-*`): a call has a timeout if the caller's *Outbound request timeout* is above 0 **or** a
  Timeout component targets the callee (`graph.ts::effectiveTimeoutMs`).
- **Scheduled-job protection** (`cron-duplicate`): declaring *distributed lock / leader election / idempotent job* counts
  only if the runner has a **data-access connection to a shared store** (an Idempotency Store for `idempotent_job`).
  A declared-but-unbacked lock is reported as unprotected, with the reason.
- **Unnecessary infrastructure** (`unnecessary-infrastructure`): heavy component kinds are flagged only when the scenario
  has no requirement that can be satisfied by that kind **and** the component has no stated reason (the
  *Why is this here?* property, 8+ characters). Medium for stateful/costly kinds, informational otherwise.
- **Real-time queue** (`realtime-queue`): a queue with an incoming async edge from a WebSocket service and an outgoing
  edge to a WebSocket service. Queues for non-real-time work (exports, snapshots) are not flagged.
- **Policies protecting nothing** (`policy-no-target`): a Timeout/Retry/Breaker/Health Check with no target looks like
  protection on the diagram but does nothing, so it is flagged.

## Requirement evidence

Each scenario requirement lists `needs`, each a structural test over the diagram (`requirements.ts::Test`): a kind
exists, a connection chain exists, a path exists, a property condition holds, a reliability policy guards a kind, or one
of a few custom checks (cron protection really backed, no queue in the real-time path, DLQ alerting, an ADR linked to the
requirement, …). A requirement is **evidenced** only when all needs hold; otherwise **partial** or **missing**.

The learner's own *Mark addressed / Record concern* is stored separately. Marking something addressed with no structural
evidence shows an explicit warning; **marks never replace evidence** and never count toward challenge completion.

## Adding or changing a rule

1. Add the rule to `RULES` with all fields (the test "every finding explains…" enforces the contract).
2. Add a positive test (the problem is detected) **and** a negative test (a sound design is not flagged).
3. Add the rule id to the table above (the docs test fails otherwise) and, if it corrects a bug, record the issue in
   `AUDIT_FINDINGS.md`.
