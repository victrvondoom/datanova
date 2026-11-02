/**
 * Educational traffic & capacity model.
 *
 * NOT a load test. Every formula is listed in FORMULAS (rendered in the UI and
 * mirrored in docs/capacity-model-assumptions.md). Inputs are the learner's
 * assumptions; nothing here is measured or benchmarked.
 */
import { Architecture, num, nodesOfKind } from "./model";
import { totalInstances } from "./graph";

export interface CapacityInputs {
  /** requests/second, average */
  avgRps: number;
  /** requests/second, at peak */
  peakRps: number;
  /** average request duration, milliseconds */
  requestMs: number;
  /** application instances serving requests */
  instances: number;
  /** requests/second one instance can sustain (an ASSUMPTION; measure it) */
  perInstanceRps: number;
  /** simultaneous in-flight requests one instance can hold */
  concurrencyPerInstance: number;
  /** is a cache in the architecture? when false the hit rate is treated as 0 */
  hasCache: boolean;
  /** fraction (0..1) of cache lookups that hit */
  cacheHitRate: number;
  /** fraction (0..1) of requests that are cache-eligible reads */
  readShare: number;
  /** database operations/second the database can sustain (assumption) */
  dbCapacityOps: number;
  /** background jobs/second arriving at average load */
  jobArrivalRate: number;
  /** worker instances consuming the queue */
  workers: number;
  /** jobs/second one worker finishes */
  workerRatePerSec: number;
  /** jobs already waiting when the simulation starts */
  queueDepth: number;
  /** how long (s) the peak lasts */
  peakDurationSec: number;
}

export const DEFAULT_CAPACITY: CapacityInputs = {
  avgRps: 20, peakRps: 200, requestMs: 150, instances: 2, perInstanceRps: 80, concurrencyPerInstance: 50,
  hasCache: true, cacheHitRate: 0.6, readShare: 0.7, dbCapacityOps: 500,
  jobArrivalRate: 2, workers: 2, workerRatePerSec: 0.5, queueDepth: 0, peakDurationSec: 300,
};

export interface FormulaDoc {
  id: string;
  name: string;
  formula: string;
  units: string;
  note: string;
}

export const FORMULAS: FormulaDoc[] = [
  { id: "capacity", name: "Total processing capacity", formula: "capacity = instances × perInstanceRps", units: "requests/second", note: "perInstanceRps is the learner's assumption. Real capacity depends on CPU, I/O, payload size and dependencies." },
  { id: "utilization", name: "Request-rate utilization", formula: "utilization = incomingRps / capacity", units: "ratio (1.0 = 100%)", note: "Above 1.0 this model says demand exceeds capacity: queues/latency grow, requests fail or are shed." },
  { id: "concurrency", name: "Concurrent in-flight requests (Little's Law)", formula: "inFlight = incomingRps × (requestMs / 1000)", units: "requests", note: "Compared with instances × concurrencyPerInstance. Assumes a stable average duration; real durations vary and grow under load." },
  { id: "cache", name: "Cache hits and misses", formula: "hits = rps × readShare × hitRate;  misses = rps × readShare × (1 − hitRate)", units: "requests/second", note: "hitRate is forced to 0 when the architecture has no cache component. Cold caches and key skew make real hit rates differ." },
  { id: "db", name: "Database load", formula: "dbLoad = rps × (1 − readShare) + misses;  dbUtilization = dbLoad / dbCapacityOps", units: "operations/second; ratio", note: "Assumes one database operation per non-cached request and every write goes to the database." },
  { id: "queue", name: "Queue growth or drain", formula: "netRate = arrivalJobs − workers × workerRatePerSec;  depth(t+1) = max(0, depth(t) + netRate)", units: "jobs; seconds", note: "Simulated at 1-second steps. Arrival during the peak window = jobArrivalRate × (peakRps / avgRps), assuming jobs scale with request rate." },
  { id: "worker", name: "Worker utilization", formula: "workerUtilization = arrivalJobs / (workers × workerRatePerSec)", units: "ratio", note: "Above 1.0 the backlog grows without bound under that arrival rate." },
  { id: "drain", name: "Time to drain", formula: "drainSeconds = depth / (workers × workerRatePerSec − averageArrival)", units: "seconds", note: "Only defined when workers out-pace the post-peak arrival rate; otherwise the backlog never drains." },
];

export const UNRELIABLE_WHEN: string[] = [
  "Request cost varies widely (a few expensive requests dominate) — the average hides it.",
  "Traffic is bursty at sub-second scale — 1-second averages hide short overloads.",
  "Dependencies (database, external API) are the real limit but their capacity is unknown.",
  "Caches are cold, evicted, or keys are heavily skewed — hit rate will not be steady.",
  "Retries, timeouts, and slow dependencies change effective load; this model has no feedback loop.",
  "Autoscaling, connection pools, locks, garbage collection and network limits are not modelled.",
];

export const UNKNOWN_VARIABLES: string[] = [
  "True per-instance capacity (needs a real load test).",
  "Real cache hit rate and cacheable share of traffic.",
  "Real worker throughput per job type.",
  "Database capacity under your actual queries and indexes.",
];

export type LoadStatus = "comfortable" | "tight" | "overloaded" | "no_capacity";

export function statusOf(utilization: number): LoadStatus {
  if (!Number.isFinite(utilization)) return "no_capacity";
  if (utilization > 1) return "overloaded";
  if (utilization >= 0.7) return "tight";
  return "comfortable";
}

export interface LoadPoint {
  rps: number;
  capacity: number;
  utilization: number;
  status: LoadStatus;
  inFlight: number;
  concurrencySlots: number;
  concurrencyUtilization: number;
  cacheHits: number;
  cacheMisses: number;
  dbLoad: number;
  dbUtilization: number;
}

export interface QueueResult {
  arrivalAvg: number;
  arrivalPeak: number;
  drainRate: number;
  workerUtilizationAvg: number;
  workerUtilizationPeak: number;
  /** sampled depth over time: [second, depth] */
  series: Array<[number, number]>;
  depthAtPeakEnd: number;
  maxDepth: number;
  /** seconds after the peak ends until the queue empties; null = never drains, 0 = already empty */
  secondsToDrainAfterPeak: number | null;
  horizonSec: number;
}

export interface Bottleneck {
  component: string;
  utilization: number;
  note: string;
}

export interface CapacityResult {
  avg: LoadPoint;
  peak: LoadPoint;
  queue: QueueResult;
  bottlenecks: Bottleneck[];
  warnings: string[];
}

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const nonNeg = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

export function sanitize(i: CapacityInputs): CapacityInputs {
  return {
    avgRps: nonNeg(i.avgRps),
    peakRps: Math.max(nonNeg(i.peakRps), nonNeg(i.avgRps)),
    requestMs: nonNeg(i.requestMs),
    instances: Math.floor(nonNeg(i.instances)),
    perInstanceRps: nonNeg(i.perInstanceRps),
    concurrencyPerInstance: Math.floor(nonNeg(i.concurrencyPerInstance)),
    hasCache: i.hasCache === true,
    cacheHitRate: clamp01(i.cacheHitRate),
    readShare: clamp01(i.readShare),
    dbCapacityOps: nonNeg(i.dbCapacityOps),
    jobArrivalRate: nonNeg(i.jobArrivalRate),
    workers: Math.floor(nonNeg(i.workers)),
    workerRatePerSec: nonNeg(i.workerRatePerSec),
    queueDepth: Math.floor(nonNeg(i.queueDepth)),
    peakDurationSec: Math.floor(nonNeg(i.peakDurationSec)),
  };
}

const ratio = (load: number, cap: number): number => (cap > 0 ? load / cap : load > 0 ? Infinity : 0);

export function loadAt(i: CapacityInputs, rps: number): LoadPoint {
  const capacity = i.instances * i.perInstanceRps;
  const utilization = ratio(rps, capacity);
  const inFlight = rps * (i.requestMs / 1000);
  const slots = i.instances * i.concurrencyPerInstance;
  const hit = i.hasCache ? i.cacheHitRate : 0;
  const cacheHits = rps * i.readShare * hit;
  const cacheMisses = rps * i.readShare * (1 - hit);
  const dbLoad = rps * (1 - i.readShare) + cacheMisses;
  return {
    rps, capacity, utilization, status: statusOf(utilization), inFlight, concurrencySlots: slots,
    concurrencyUtilization: ratio(inFlight, slots), cacheHits, cacheMisses, dbLoad,
    dbUtilization: ratio(dbLoad, i.dbCapacityOps),
  };
}

export function simulateQueue(i: CapacityInputs): QueueResult {
  const drainRate = i.workers * i.workerRatePerSec;
  const multiplier = i.avgRps > 0 ? i.peakRps / i.avgRps : 1;
  const arrivalPeak = i.jobArrivalRate * multiplier;
  const horizon = Math.min(3600, Math.max(600, i.peakDurationSec * 2 + 300));
  let depth = i.queueDepth;
  let maxDepth = depth;
  let depthAtPeakEnd = depth;
  let drainedAt: number | null = depth === 0 ? 0 : null;
  const series: Array<[number, number]> = [[0, depth]];
  for (let t = 1; t <= horizon; t++) {
    const arrival = t <= i.peakDurationSec ? arrivalPeak : i.jobArrivalRate;
    depth = Math.max(0, depth + arrival - drainRate);
    if (depth > maxDepth) maxDepth = depth;
    if (t === i.peakDurationSec) depthAtPeakEnd = depth;
    if (t > i.peakDurationSec && depth <= 0 && drainedAt === null) drainedAt = t - i.peakDurationSec;
    if (t % Math.max(1, Math.floor(horizon / 120)) === 0) series.push([t, depth]);
  }
  if (i.peakDurationSec === 0) depthAtPeakEnd = i.queueDepth;
  let secondsToDrainAfterPeak: number | null;
  if (depthAtPeakEnd <= 0) secondsToDrainAfterPeak = 0;
  else secondsToDrainAfterPeak = drainRate > i.jobArrivalRate ? (drainedAt ?? Math.ceil(depthAtPeakEnd / (drainRate - i.jobArrivalRate))) : null;
  return {
    arrivalAvg: i.jobArrivalRate, arrivalPeak, drainRate,
    workerUtilizationAvg: ratio(i.jobArrivalRate, drainRate),
    workerUtilizationPeak: ratio(arrivalPeak, drainRate),
    series, depthAtPeakEnd, maxDepth, secondsToDrainAfterPeak, horizonSec: horizon,
  };
}

export function computeCapacity(raw: CapacityInputs): CapacityResult {
  const i = sanitize(raw);
  const avg = loadAt(i, i.avgRps);
  const peak = loadAt(i, i.peakRps);
  const queue = simulateQueue(i);
  const bottlenecks: Bottleneck[] = [];
  const consider = (component: string, u: number, note: string) => {
    if (u >= 0.85) bottlenecks.push({ component, utilization: u, note });
  };
  consider("Application instances (request rate)", peak.utilization, "Peak request rate is near or above total instance capacity.");
  consider("Application instances (concurrency)", peak.concurrencyUtilization, "In-flight requests approach the concurrency slots available.");
  consider("Database", peak.dbUtilization, i.hasCache ? "Cache misses and writes together approach database capacity." : "No cache: every read reaches the database.");
  consider("Workers (peak arrival)", queue.workerUtilizationPeak, "Jobs arrive faster than workers can finish them during the peak.");
  bottlenecks.sort((a, b) => (b.utilization === a.utilization ? 0 : b.utilization > a.utilization ? 1 : -1));

  const warnings: string[] = [];
  if (i.instances === 0) warnings.push("No application instances: nothing serves requests.");
  if (peak.status === "overloaded") warnings.push(`Peak demand is ${fmtRatio(peak.utilization)} of modelled capacity: requests would queue, time out, or be shed.`);
  if (peak.concurrencyUtilization > 1) warnings.push("Peak in-flight requests exceed concurrency slots: connections will wait or be refused.");
  if (peak.dbUtilization > 1) warnings.push("Peak database load exceeds modelled database capacity.");
  if (i.workers === 0 && i.jobArrivalRate > 0) warnings.push("Jobs arrive but there are no workers: the backlog only grows.");
  else if (queue.workerUtilizationAvg > 1) warnings.push("Workers cannot keep up even at average arrival: the backlog grows without bound.");
  else if (queue.secondsToDrainAfterPeak === null) warnings.push("After the peak the queue never drains at the current worker rate.");
  if (!i.hasCache && i.readShare > 0) warnings.push("No cache component: hit rate is treated as 0 and all reads reach the database.");
  return { avg, peak, queue, bottlenecks, warnings };
}

export function fmtRatio(v: number): string {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : "∞";
}

/** Derive instance/worker/cache/DB inputs from the learner's architecture. */
export function fromArchitecture(a: Architecture, base: CapacityInputs): CapacityInputs {
  const apps = nodesOfKind(a, "app_service", "web_app");
  const appInstances = totalInstances(a, "app_service", "web_app");
  const capTotal = apps.reduce((s, n) => s + Math.max(1, num(n, "instances", 1)) * (num(n, "capacityRps", base.perInstanceRps) || base.perInstanceRps), 0);
  const workers = nodesOfKind(a, "worker");
  const workerInstances = totalInstances(a, "worker");
  const rateTotal = workers.reduce((s, n) => s + Math.max(1, num(n, "instances", 1)) * num(n, "processingRatePerSec", base.workerRatePerSec), 0);
  const db = nodesOfKind(a, "postgres")[0];
  return {
    ...base,
    instances: appInstances,
    perInstanceRps: appInstances > 0 ? capTotal / appInstances : base.perInstanceRps,
    hasCache: nodesOfKind(a, "redis_cache").length > 0,
    workers: workerInstances,
    workerRatePerSec: workerInstances > 0 ? rateTotal / workerInstances : base.workerRatePerSec,
    dbCapacityOps: db ? num(db, "capacityOps", base.dbCapacityOps) : base.dbCapacityOps,
  };
}
