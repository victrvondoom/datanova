# Capacity Model — Assumptions, Formulas and Limits

Implemented in `apps/web/src/studio/capacity.ts`; tests in `__tests__/simulation.test.ts` ("capacity model").
Rendered interactively in **Architecture Studio → Capacity**, where the same `FORMULAS` list below is displayed.

> **This is an educational model, not a load test.** All inputs are the learner's assumptions. Nothing is measured or
> benchmarked, and no output may be read as "this design can serve N requests per second". Capacity claims require a real
> load test against the real system.

## Inputs (all editable, all persisted with the workspace)

| Input | Unit | Notes |
|---|---|---|
| Average / peak requests per second | req/s | peak is clamped to be ≥ average |
| Average request duration | ms | used for in-flight estimate |
| Application instance count | instances | integer ≥ 0 |
| Capacity per instance | req/s | an **assumption** — unknown until load-tested |
| Concurrent requests per instance | requests | concurrency slots |
| Architecture has a cache | yes/no | when off, hit rate is treated as 0 |
| Cache hit rate, cache-eligible read share | 0–1 | clamped |
| Database capacity | ops/s | an **assumption** |
| Background job arrival rate | jobs/s | at average load |
| Worker instances, worker rate | instances; jobs/s each | |
| Initial queue depth, peak duration | jobs; s | |

Invalid input (NaN, negative, out of range) is sanitised, never propagated (`sanitize`, tested).
"Sync from architecture" copies instance counts, per-instance capacity, cache presence, workers, worker rate and DB capacity
from the canvas (`fromArchitecture`).

## Formulas

1. **Total processing capacity** (`capacity`) — `capacity = instances × perInstanceRps`  
   Units: requests/second. perInstanceRps is the learner's assumption. Real capacity depends on CPU, I/O, payload size and dependencies.
2. **Request-rate utilization** (`utilization`) — `utilization = incomingRps / capacity`  
   Units: ratio (1.0 = 100%). Above 1.0 this model says demand exceeds capacity: queues/latency grow, requests fail or are shed.
3. **Concurrent in-flight requests (Little's Law)** (`concurrency`) — `inFlight = incomingRps × (requestMs / 1000)`  
   Units: requests. Compared with instances × concurrencyPerInstance. Assumes a stable average duration; real durations vary and grow under load.
4. **Cache hits and misses** (`cache`) — `hits = rps × readShare × hitRate;  misses = rps × readShare × (1 − hitRate)`  
   Units: requests/second. hitRate is forced to 0 when the architecture has no cache component. Cold caches and key skew make real hit rates differ.
5. **Database load** (`db`) — `dbLoad = rps × (1 − readShare) + misses;  dbUtilization = dbLoad / dbCapacityOps`  
   Units: operations/second; ratio. Assumes one database operation per non-cached request and every write goes to the database.
6. **Queue growth or drain** (`queue`) — `netRate = arrivalJobs − workers × workerRatePerSec;  depth(t+1) = max(0, depth(t) + netRate)`  
   Units: jobs; seconds. Simulated at 1-second steps. Arrival during the peak window = jobArrivalRate × (peakRps / avgRps), assuming jobs scale with request rate.
7. **Worker utilization** (`worker`) — `workerUtilization = arrivalJobs / (workers × workerRatePerSec)`  
   Units: ratio. Above 1.0 the backlog grows without bound under that arrival rate.
8. **Time to drain** (`drain`) — `drainSeconds = depth / (workers × workerRatePerSec − averageArrival)`  
   Units: seconds. Only defined when workers out-pace the post-peak arrival rate; otherwise the backlog never drains.

Utilization status thresholds (`statusOf`): below 70% *comfortable*; 70–100% *tight*; above 100% *overloaded*; zero
capacity with demand is *no capacity*. Bottlenecks are listed when a component's modelled peak utilization is ≥ 85%.

## Outputs

Estimated request load, request-rate utilization, concurrency utilization, cache hits and misses per second, database
load and utilization, queue growth or drain over time (sampled series plotted as a chart with axes and a text
description), worker utilization (average and peak), time to drain after the peak, ranked bottlenecks, and overload
warnings.

## Simplifications

- Steady averages; 1-second queue steps; no sub-second burstiness.
- One database operation per non-cached request; all writes go to the database.
- Jobs scale in proportion to request rate during the peak (`peakRps / avgRps`) — an assumption, stated on screen.
- No autoscaling, connection pools, lock contention, GC pauses, network limits or retries feeding back as load.
- Worker autoscaling declared on a Worker is *not* simulated; outputs are the unscaled case.

## Unknown variables

True per-instance capacity; real cache hit rate and cacheable share; real worker throughput per job type; database
capacity under real queries and indexes.

## The estimate is unreliable when…

Request cost varies widely; traffic is bursty at sub-second scale; the real limit is a dependency whose capacity is
unknown; caches are cold or keys are skewed; retries/timeouts/slow dependencies change effective load (no feedback loop);
autoscaling, pools, locks, GC and network limits matter. (Shown on the Capacity page as `UNRELIABLE_WHEN`.)

## How the other features use it

- **Failure Lab** reads peak rate, concurrency slots, read share, hit rate, job rate, DB capacity (via
  `fromArchitecture`) — e.g. cache-loss database load and survivor overload after an instance crash.
- **Compare** and **Review** report utilization from this model for each architecture and label it as such.
- **Cost assumptions** in Compare/Review use *illustrative relative cost units* (`KIND_DEFS.costUnits × instances`),
  explicitly **not prices**.
