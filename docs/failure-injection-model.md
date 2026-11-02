# Failure Injection Model

Implemented in `apps/web/src/studio/failures.ts`; tests in `__tests__/simulation.test.ts` (structural outcomes, recovery,
before/after). UI: **Architecture Studio → Failure Lab**.

## Principle

Nothing is a canned outcome. Each run reads the learner's **actual configuration** and simulates a small deterministic
scenario. If the architecture lacks a mechanism, the failure is shown **unprotected**; recovery only happens when a
mechanism exists. A failure that has nothing to hit returns **Not applicable** — which is explicitly *not* the same as
being protected.

This is a model, not fault injection against real systems. It does not claim a design will behave this way in production.

## The twelve failures

| # | Id | Failure | Hits | Topics |
|---|---|---|---|---|
| 1 | `instance-crash` | Application instance crashes | Application Service / Web Application / Authentication Service | 03, 08, 09 |
| 2 | `db-slow` | Database becomes slow | PostgreSQL Database | 11, 10, 02 |
| 3 | `cache-down` | Cache becomes unavailable | Redis Cache | 02, 01 |
| 4 | `api-503` | External API returns HTTP 503 | External Service | 12, 13, 10 |
| 5 | `api-timeout` | External API times out | External Service | 11, 10 |
| 6 | `consumer-crash` | Queue consumer crashes | Background Worker | 15, 14 |
| 7 | `backlog-growth` | Queue backlog grows | Message Queue | 15, 01 |
| 8 | `poison-job` | A job repeatedly fails and reaches the DLQ | Message Queue | 15, 12 |
| 9 | `duplicate-payment` | Duplicate payment request arrives | Application Service / Web Application / Background Worker | 14 |
| 10 | `cron-multi` | Scheduled task runs on multiple instances | Scheduled Job Runner | 20, 14 |
| 11 | `subscriber-down` | Pub/Sub subscriber becomes unavailable | Application Service / Web Application / Background Worker | 16, 17 |
| 12 | `dependency-unhealthy` | A downstream dependency stays unhealthy | External Service / Authentication Service / Application Service | 10, 12, 13 |

## Shared mechanics

| Constant | Value | Meaning |
|---|---|---|
| `REQUESTS` | 20 | simulated requests (1 per second) for single-event failures |
| `SUSTAINED` | 60 | requests in the sustained-outage window (`dependency-unhealthy`) |
| `DEADLINE_MS` | 30 000 | a user gives up after this; later success is counted as failure |
| `SLOW_THRESHOLD_MS` | 1 000 | a success slower than this counts as "slow" (degraded) |
| `FAILED_SHARE` | 0.25 | a run is a *user-visible failure* when more than 25% of requests fail |

**Call engine** (`simulateCalls`) for external/internal dependency failures. For each request, in order:

1. If a circuit breaker targeting the dependency is **open**, the call is rejected instantly (counted as *fast-failed*);
   with a fallback other than `none` the request is served as *degraded*, otherwise it fails fast.
2. Otherwise attempt up to the **Retry Policy's** `maxAttempts` (`0` = unbounded, capped at 10 in the model).
   Between attempts add backoff delay: none 0 ms; fixed 1 s; exponential `1 s × 2^(k-1)`; with jitter ×0.5 on average.
3. Each attempt's result depends on the failure mode: **down** (immediate error, 20 ms), **hang** (never answers: fails at
   the effective timeout, or never returns if there is none → *hung*), **slow** (succeeds after L ms unless the timeout is
   shorter, in which case it fails at the timeout).
4. The effective timeout is the caller's *Outbound request timeout* or a Timeout component targeting the callee.
5. Consecutive failed attempts open the breaker at `failureThreshold`; after `openSeconds` a half-open probe is allowed
   and one more failure re-opens it.
6. A request whose cumulative latency exceeds the 30 s deadline is a failure.

**Saturation** (`saturation`): Little's-law check `held = rate × holdTime` against the caller's concurrency slots
(`instances × concurrency` for services, `instances` for workers). A dependency that hangs with **no timeout** pins every
slot after `slots / rate` seconds, so *the failure propagates upstream* and takes down features that do not even use the
dependency. Retries with **no backoff** at ≥ 3 attempts per request are flagged as a retry storm that propagates load.

## Per-failure behaviour (what configuration changes the outcome)

- **Instance crash** — reads `instances`, a load balancer/gateway/proxy in front, a Health Check (or the service's health
  endpoint plus *removes unhealthy*), and any Retry Policy. One instance = outage. More than one without detection: the
  dead instance's share of requests keeps failing. With detection: one failed request, then ejection. Also checks whether
  survivors can carry the peak (`peakRps` vs `(n−1) × perInstanceRps`).
- **Database slow** — latency parameter; reads caller timeout, retries, breaker, and whether the caller has a **cache**
  connection (the cache absorbs `readShare × hitRate` of requests). A timeout protects slots but turns slow responses into
  errors — reported as a trade-off, not a fix.
- **Cache down** — database demand goes from `writes + misses` to the full request rate; compared with database capacity.
  A rate limiter / gateway limit or a breaker with a fallback converts overload into deliberate shedding (*degraded*).
- **External 503 / timeout / sustained unhealthy** — the call engine. A worker that consumes a queue is *buffered*: users
  were already answered, jobs are delayed and are redelivered only if the queue is durable **and** has a visibility timeout.
- **Queue consumer crash** — remaining consumer instances vs arrivals; the in-flight job is redelivered only with a
  visibility timeout (otherwise lost → *data at risk*). Autoscaling/auto-restart are declared but **not simulated**.
- **Queue backlog growth** — arrival multiplier vs drain rate via the capacity queue simulation; a bounded queue sheds
  instead of growing; an upstream rate limiter is noted.
- **Poison job** — `retryLimit` (0 = unlimited loop), whether a DLQ is **wired** and the dead-letter policy is set, and DLQ
  alerting. No DLQ after the limit → the job vanishes silently (*data at risk*).
- **Duplicate payment** — an Idempotency Store connected by data access with **atomic claim**. A non-atomic store races
  under concurrency; no store executes every copy. Targets only payment-like components unless a target is chosen.
- **Cron on multiple instances** — instances vs *effective* protection (see validation rules); declared-but-unbacked
  protection still duplicates.
- **Subscriber down** — topic retention (>0 → events wait and replay; 0 → lost for that subscriber), whether publishers also
  call the subscriber synchronously (couples and propagates), and whether other subscribers exist.

## Outcomes

`handled`, `degraded` (served via fallback/slow/some failures within the 25% share), `failed` (user-visible),
`data_risk` (duplicates executed or work lost), `not_applicable`. "Survived" = handled or degraded.
Each run shows the trigger, request path, retries, protections that activated, propagation, a final outcome step and
a plain-language explanation, plus *what would help*.

## Recovery

- **Restore failed component** returns the component to *recovered*. **Failed synchronous requests are not replayed** —
  the architecture keeps no durable record of them, and the UI says so.
- **Recover queued work** only succeeds when something durable holds the work (durable queue with redelivery, topic
  retention) **and** the component was restored first. Non-durable queues report the work as lost. Redriving a poison
  job from the DLQ fails again unless the cause is fixed — also stated.
- **Reset scenario** clears the run. **Before/after**: remember the current design, change it, and compare all twelve
  outcomes (also available as a saved version in Compare).

## Not modelled

Real timing, concurrency races beyond the stated checks, partial network partitions, clock skew, data corruption,
multi-region behaviour, autoscaling delays, saga/2PC execution (their configuration is validated and reviewed, but no
failure drives them).
