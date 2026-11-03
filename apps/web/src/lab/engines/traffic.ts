/**
 * Task 11 — Probabilistic Traffic and Queueing Model.
 *
 * A discrete-event educational simulation with a SEEDED PRNG: identical inputs
 * always produce identical outputs. Models arrivals (steady/bursty/periodic),
 * work duration (fixed/exponential), queue depth, waiting time, worker
 * utilization, drops at capacity, and backlog growth.
 *
 * Honesty: this is a teaching model of queue behavior, not a load test.
 * Assumptions are returned with every result.
 */

export interface TrafficProfile {
  kind: "steady" | "bursty" | "periodic";
  baseRatePerSec: number;
  /** bursty: multiplies the base rate for burstDurationSec every burstEverySec */
  burstMultiplier?: number;
  burstEverySec?: number;
  burstDurationSec?: number;
  /** periodic: rate(t) = base + amplitude * sin(2*pi*t/periodSec) */
  amplitude?: number;
  periodSec?: number;
  durationSec: number;
  seed: number;
}

export interface WorkDuration {
  kind: "fixed" | "exponential";
  /** fixed: exact processing time; exponential: mean processing time */
  ms: number;
}

export interface QueueConfig {
  workers: number;
  /** each worker processes one job at a time */
  queueCapacity: number;
}

export interface TimelinePoint {
  t: number;
  arrived: number;
  processed: number;
  depth: number;
  utilization: number;
  dropped: number;
}

export interface QueueSimResult {
  timeline: TimelinePoint[];
  totalArrived: number;
  totalProcessed: number;
  totalDropped: number;
  maxDepth: number;
  meanDepth: number;
  meanWaitMs: number;
  p95WaitMs: number;
  /** true when the queue is still growing at the end of the run */
  saturated: boolean;
  assumptions: string[];
}

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(rand: () => number, lambda: number): number {
  // Knuth for small lambda (educational scale); fallback for large lambda
  if (lambda <= 30) {
    const L = Math.exp(-lambda);
    let k = 0; let p = 1;
    do { k += 1; p *= rand(); } while (p > L && k < 10000);
    return k - 1;
  }
  // normal approximation for large rates
  const u = rand() - 0.5;
  return Math.max(0, Math.round(lambda + u * Math.sqrt(lambda) * 2));
}

export function simulateQueue(profile: TrafficProfile, duration: WorkDuration, cfg: QueueConfig): QueueSimResult {
  const rand = mulberry32(profile.seed);
  const timeline: TimelinePoint[] = [];
  const queue: { arrivedAt: number }[] = [];
  const busyUntil: number[] = new Array(cfg.workers).fill(0);
  const waits: number[] = [];
  const completions: number[] = [];
  let totalArrived = 0; let totalDropped = 0;
  let maxDepth = 0; let depthSum = 0;

  const rateAt = (t: number): number => {
    if (profile.kind === "steady") return profile.baseRatePerSec;
    if (profile.kind === "bursty") {
      const every = profile.burstEverySec ?? 20;
      const dur = profile.burstDurationSec ?? 5;
      const inBurst = t % every < dur;
      return inBurst ? profile.baseRatePerSec * (profile.burstMultiplier ?? 2) : profile.baseRatePerSec;
    }
    const amp = profile.amplitude ?? profile.baseRatePerSec / 2;
    const period = profile.periodSec ?? 30;
    return Math.max(0, profile.baseRatePerSec + amp * Math.sin((2 * Math.PI * t) / period));
  };

  for (let t = 0; t < profile.durationSec; t++) {
    const arrivals = poisson(rand, rateAt(t));
    for (let i = 0; i < arrivals; i++) {
      totalArrived += 1;
      if (queue.length >= cfg.queueCapacity) totalDropped += 1;
      else queue.push({ arrivedAt: t });
    }
    // workers keep pulling work while free within the current second
    for (let w = 0; w < cfg.workers; w++) {
      while (busyUntil[w] <= t + 1 && queue.length > 0) {
        const job = queue.shift() as { arrivedAt: number };
        const start = Math.max(busyUntil[w], t);
        const procSec = duration.kind === "fixed"
          ? duration.ms / 1000
          : Math.max(0.001, (-Math.log(1 - rand()) * duration.ms) / 1000);
        busyUntil[w] = start + procSec;
        waits.push(Math.max(0, (start - job.arrivedAt) * 1000));
        const done = start + procSec;
        if (done <= profile.durationSec) completions.push(done);
        if (busyUntil[w] > t + 1) break;
      }
    }
    maxDepth = Math.max(maxDepth, queue.length);
    depthSum += queue.length;
    const busy = busyUntil.filter((b) => b > t).length;
    timeline.push({
      t, arrived: arrivals,
      processed: completions.filter((c) => c > t && c <= t + 1).length,
      depth: queue.length,
      utilization: cfg.workers === 0 ? 0 : busy / cfg.workers,
      dropped: totalDropped,
    });
  }

  const totalProcessed = completions.length;

  // saturation: is the depth still trending up over the last third of the run?
  const tail = timeline.slice(Math.floor(timeline.length * 2 / 3));
  const tailSlope = tail.length < 2 ? 0 : (tail[tail.length - 1].depth - tail[0].depth) / (tail.length - 1);
  const saturated = tailSlope > 0.05 || (timeline.length > 0 && timeline[timeline.length - 1].depth > cfg.queueCapacity * 0.5);

  const sorted = [...waits].sort((a, b) => a - b);
  const p95 = sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];

  return {
    timeline,
    totalArrived, totalProcessed, totalDropped,
    maxDepth,
    meanDepth: timeline.length === 0 ? 0 : depthSum / timeline.length,
    meanWaitMs: waits.length === 0 ? 0 : waits.reduce((a, b) => a + b, 0) / waits.length,
    p95WaitMs: p95,
    saturated,
    assumptions: [
      "Poisson arrivals with a per-second rate; bursts multiply the rate for a fixed window.",
      duration.kind === "exponential"
        ? "Exponential service times with the given mean (memoryless; higher variance than real systems with bimodal work)."
        : "Deterministic service times (no variance; real work varies more).",
      "Single FIFO queue, one job per worker, no priority classes, no retries inside the sim.",
      "Jobs beyond queue capacity are dropped (no backpressure model).",
    ],
  };
}
