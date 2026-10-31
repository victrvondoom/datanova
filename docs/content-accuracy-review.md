# Content Accuracy Review — TRACEN Vibe Coding Trail

**Scope:** statements from the *System Design Made Visual* handbook (the
authoritative content source) that are educational simplifications,
context-dependent, or need a production nuance. Each entry records the
original statement, its classification, why the distinction matters, the
recommended production nuance, and where the learner sees it.

Classifications: `accurate` · `simplified` · `context-dependent` ·
`requires clarification`.

**Rendering policy:** the handbook's original explanation is always shown
as-is. Production nuances appear in visually separate "Production nuance"
callouts (violet) or "warning" callouts (amber) — never silently merged
into the source text.

---

## 1. Docker portability guarantee — `requires clarification`

- **Original (T07):** "If the container runs on your laptop, it is
  mathematically guaranteed to run exactly the same way in the cloud."
- **Classification:** requires clarification.
- **Why it matters:** containers share the host kernel; behavior can differ
  across CPU architectures, kernel versions/seccomp policies, file systems,
  resource limits (ulimits, cgroups), and mounted-host paths. Treating the
  guarantee as absolute causes migration surprises.
- **Production nuance (shown on the T07 page as a callout):** consistency
  improves, not absolute portability.
- **Learner-facing page:** nuance callout present; no separate page needed.

## 2. Identity headers passed by an API Gateway — `requires clarification`

- **Original (T05):** "Validate the token once at the API Gateway, then pass
  the User ID downstream in an internal HTTP header that your internal
  services trust."
- **Classification:** requires clarification.
- **Why it matters:** taken naively, services trusting a client-supplied
  `X-User-Id` header are trivially spoofable. The trust must be established
  at the gateway (strip inbound identity headers from external traffic) and
  protected by internal network controls (mTLS, private networking).
- **Production nuance:** explicit callout on the T05 page: "downstream
  services must not blindly trust arbitrary client-supplied identity
  headers."
- **Learner-facing page:** dedicated security nuance callout present.

## 3. HTTP method idempotency — `context-dependent`

- **Original (T14):** "HTTP GET, PUT, and DELETE should be idempotent by
  definition… POST is usually NOT idempotent."
- **Classification:** context-dependent.
- **Why it matters:** the RFC describes method SEMANTICS (repeating the
  request has the same intended effect), not application behavior. A PUT
  that increments a counter is not idempotent in effect; a POST can be made
  safe with idempotency keys.
- **Production nuance:** callout on T14: method semantics ≠ application
  behavior; money endpoints need explicit keys regardless of verb.
- **Learner-facing page:** nuance callout present.

## 4. Cache invalidation / stale data — `simplified`

- **Original (T02):** "Fix: always set a TTL on cache keys."
- **Classification:** simplified.
- **Why it matters:** TTL alone leaves a staleness window equal to the TTL;
  the standard defense is delete-on-write + TTL as a safety net. Also,
  "never cache sensitive sessions on a public CDN" needs a threat-model
  framing (what is sensitive depends on the threat model).
- **Production nuance:** T02 callout covers delete-on-write + TTL; the
  CDN warning appears in the tradeoffs section.
- **Learner-facing page:** nuance callout present.

## 5. Circuit-breaker recovery behavior — `simplified`

- **Original (T10):** "For the next 30 seconds, Service A stops calling
  Service B entirely and instantly returns an error."
- **Classification:** simplified.
- **Why it matters:** real breakers (Polly, Resilience4j, Hystrix) use a
  half-open state that PROBES before closing — an open breaker that simply
  closes after a timer can slam a still-struggling service. Threshold
  choices (count vs. failure-rate) and reset semantics vary by
  implementation.
- **Production nuance:** T10 page simulates open → half-open → closed with
  an explicit cooldown tick; the technical section names all three states.
- **Learner-facing page:** behavior modeled; no separate page needed.

## 6. Edge vs application rate limiting — `context-dependent`

- **Original (T01):** "Rate limiting should happen at the Edge… not in your
  application code."
- **Classification:** context-dependent.
- **Why it matters:** edge limiting protects shared infrastructure, but
  application-level limits still matter: per-user business quotas,
  distributed deployments where each instance sees only its own traffic
  (needs Redis-backed shared counting), and differentiating authenticated
  users from IPs.
- **Production nuance:** T01 callout notes the shared-counter/Redis
  requirement for multi-instance deployments.
- **Learner-facing page:** nuance callout present.

## 7. Distributed transactions and 2PC — `accurate` (with scope note)

- **Original (T18):** "2PC… extremely slow and locks rows in all databases
  until the network resolves. Rarely used in modern microservices."
- **Classification:** accurate.
- **Note kept:** the trail adds that reducing cross-database writes is
  usually the better engineering answer — consistent with the handbook's
  own takeaway, not conflicting with it.

## 8. Saga compensation semantics — `requires clarification`

- **Original (T19):** "the Saga executes Compensating Transactions (undo
  steps) backward to restore the original state."
- **Classification:** requires clarification.
- **Why it matters:** "restore the original state" can be read as a
  database-level rollback. Compensation is a BUSINESS-level corrective
  action (refund, cancel) — the database rows change again; state is not
  time-traveled back. Money already moved through external systems may not
  be recoverable at all.
- **Production nuance:** explicit warning callout on the T19 page, per the
  master prompt.
- **Learner-facing page:** warning callout present.

## 9. Cron scheduling, missed executions, timezones — `simplified`

- **Original (T20):** "0 0 * * * runs at server time (usually UTC)…
   Always store and process dates in UTC."
- **Classification:** simplified.
- **Why it matters:** UTC storage is right, but production schedulers also
  need an explicit run TIMEZONE (a user-facing 09:00 local digest is
  neither UTC-stored-local-run contradiction-free nor DST-stable), a
  missed-run policy (catch-up vs. skip), and singleton execution (lock or
  orchestrator).
- **Production nuance:** T20 warning callout covers timezone configuration
  and missed-run handling; the distributed-lock and queue-first best
  practices are simulated directly.
- **Learner-facing page:** warning callout present.

## 10. Kubernetes advice — `accurate` (as stated)

- **Original (T08):** "Do not use Kubernetes for a simple MVP."
- **Classification:** accurate and preserved verbatim, including the
  operational-overhead framing. The trail adds an honesty note that the
  pod self-healing simulation is illustrative (no real containers run).

## 11. Case-study scale claim — `requires clarification`

- **Original (case study):** "10,000 users hit the site at once… see how the
  20 topics prevent the system from crashing."
- **Classification:** requires clarification.
- **Why it matters:** a visual simulation is not a load test.
- **Production nuance:** an amber disclaimer on the case-study page states
  that nothing real is running and no 10k-user capability is claimed.
- **Learner-facing page:** disclaimer banner present.

---

**Result:** no handbook statement contradicts production engineering
practice in a way that would mislead; every simplification that could
mislead has a visually separate nuance/warning callout on the exact page
where the simplified claim is made.
