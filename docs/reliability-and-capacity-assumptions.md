# Reliability and Capacity Assumptions (Campaign 03, Tasks 11–15)

**Implementation:** `engines/traffic.ts`, `latency.ts`, `slo.ts`, `resource.ts`,
`tradeoff.ts`; tests in `__tests__/m3.test.ts`.

ALL numbers in these engines are MODELED from declared assumptions — never
presented as production measurements or cloud pricing.

## Traffic / queueing (T11)

Seeded discrete-event simulation (mulberry32 PRNG; identical seed → identical
run). Poisson arrivals; steady, bursty (multiplier over a window), and periodic
(sin) profiles; fixed or exponential service times; FIFO queue with capacity
and drops. Saturation detection = depth still trending up over the last third
of the run. Assumptions are returned with every result.

## Latency budget (T12)

Hop latency from `connection.latencyMs`; processing from `latencyBudget`
allocations; the deadline applies to the slowest synchronous path (parallel
branches are not additive); retry overhead is the WORST case (retryMax × full
hop); async hops never block the sync deadline. Missing budgets are surfaced,
never invented.

## SLO / error budgets (T13)

Budget math is exact and shown: `allowedBad = (1 - target/100) × windowDays ×
expectedRequestsPerDay`. Downtime consumption assumes uniform traffic (stated).
Latency SLOs are honestly NOT-APPLICABLE for budget math: no request latency
distribution is modeled.

## Resources (T14)

Little's law is the core: required concurrency = rate × service time. The
bottleneck is the max utilization; `scaleResource` shows whether the
bottleneck MOVES — teaching that scaling slack does nothing. Queue backlog is a
crude documented proxy.

## Cost / risk / complexity (T15)

Cost comes from DECLARED assumption tables (default: $8/CPU, $0.08/GB storage,
$0.40/GB memory, $10/component — clearly labeled "modeled, not pricing").
Risk exposure = severity × likelihood, mitigated risks reduced by the
documented 0.4 factor. Complexity = deployables + 2×stateful + 0.1×edges +
externals. The frontier marks dominated points on four axes and deliberately
computes NO single score; sensitivity analysis re-ranks when assumptions change.
