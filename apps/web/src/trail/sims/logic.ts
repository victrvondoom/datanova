/**
 * Pure simulation logic for the 20 topic simulations.
 *
 * Every function here is deterministic and free of DOM/timers, so the
 * automated test suite can verify real behavior: token consumption, cache
 * hit/miss transitions, LB failover, pipeline gating, kube reconciliation,
 * breaker trips, timeout math, retry limits, backoff + jitter, idempotent
 * payments, queue/DLQ movement, pub/sub fan-out, trace propagation, 2PC
 * outcomes, saga compensation, and cron duplicate prevention.
 */

// ---------------------------------------------------------------- Topic 01

export interface TokenBucket {
  capacity: number;
  refillPerSecond: number;
  tokens: number;
  accepted: number;
  rejected: number;
}

export function makeBucket(capacity = 100, refillPerSecond = 10): TokenBucket {
  return { capacity, refillPerSecond, tokens: capacity, accepted: 0, rejected: 0 };
}

export function refillBucket(b: TokenBucket, elapsedSeconds: number): TokenBucket {
  const tokens = Math.min(b.capacity, b.tokens + elapsedSeconds * b.refillPerSecond);
  return { ...b, tokens };
}

export interface BucketResult {
  bucket: TokenBucket;
  allowed: boolean;
  status: 200 | 429;
  retryAfterSeconds: number;
}

export function bucketRequest(b: TokenBucket, cost = 1): BucketResult {
  if (b.tokens >= cost) {
    return {
      bucket: { ...b, tokens: b.tokens - cost, accepted: b.accepted + 1 },
      allowed: true,
      status: 200,
      retryAfterSeconds: 0,
    };
  }
  const missing = cost - b.tokens;
  return {
    bucket: { ...b, rejected: b.rejected + 1 },
    allowed: false,
    status: 429,
    retryAfterSeconds: missing / b.refillPerSecond,
  };
}

// ---------------------------------------------------------------- Topic 02

export interface CacheState {
  cache: Record<string, { value: string; version: number; ttlRemaining: number }>;
  db: Record<string, { value: string; version: number }>;
  hits: number;
  misses: number;
  dbQueries: number;
  lastAction: string;
}

export function makeCacheState(): CacheState {
  return {
    cache: {},
    db: { "user:123": { value: "Alice — bio v1", version: 1 } },
    hits: 0,
    misses: 0,
    dbQueries: 0,
    lastAction: "",
  };
}

/** Cache-aside read. ttlElapsed seconds age the key first. */
export function cacheRead(s: CacheState, key: string, ttlElapsed = 0): CacheState {
  const entry = s.cache[key];
  const live = entry && entry.ttlRemaining > ttlElapsed ? entry : undefined;
  if (live) {
    return { ...s, hits: s.hits + 1, lastAction: `CACHE HIT  ${key} (v${live.version}) → ~1ms` };
  }
  const dbRow = s.db[key];
  const dbQueries = s.dbQueries + 1;
  if (!dbRow) {
    return { ...s, misses: s.misses + 1, dbQueries, lastAction: `MISS → DB MISS ${key} (no such row)` };
  }
  return {
    ...s,
    misses: s.misses + 1,
    dbQueries,
    cache: {
      ...s.cache,
      [key]: { value: dbRow.value, version: dbRow.version, ttlRemaining: 60 },
    },
    lastAction: `CACHE MISS → DB QUERY ${key} (200ms) → cache populated (TTL 60s)`,
  };
}

export function dbUpdate(s: CacheState, key: string, value: string): CacheState {
  const version = (s.db[key]?.version ?? 0) + 1;
  const stale = s.cache[key] !== undefined;
  return {
    ...s,
    db: { ...s.db, [key]: { value, version } },
    lastAction: stale
      ? `DB updated ${key} → v${version}. ⚠ Old value STILL in cache (stale until TTL/refresh)`
      : `DB updated ${key} → v${version}`,
  };
}

export function expireKey(s: CacheState, key: string): CacheState {
  const next = { ...s.cache };
  delete next[key];
  return { ...s, cache: next, lastAction: `TTL EXPIRED ${key} — next read is a miss` };
}

export function forceRefresh(s: CacheState, key: string): CacheState {
  const without = expireKey(s, key);
  return cacheRead(without, key);
}

export function tickCacheTtl(s: CacheState, seconds: number): CacheState {
  const cache: CacheState["cache"] = {};
  for (const [k, v] of Object.entries(s.cache)) {
    const remaining = v.ttlRemaining - seconds;
    if (remaining > 0) cache[k] = { ...v, ttlRemaining: remaining };
  }
  return { ...s, cache };
}

// ---------------------------------------------------------------- Topics 03/04

export interface LbServer {
  name: string;
  healthy: boolean;
  requests: number;
}

export const makeLbServers = (): LbServer[] => [
  { name: "Node 1", healthy: true, requests: 0 },
  { name: "Node 2", healthy: true, requests: 0 },
  { name: "Node 3", healthy: true, requests: 0 },
];

export interface LbRouteResult {
  servers: LbServer[];
  target: LbServer | null;
  status: 200 | 503;
}

/** Round-robin across healthy servers. */
export function lbRoute(servers: LbServer[], rrIndex: number): LbRouteResult {
  const healthy = servers.map((s, i) => ({ s, i })).filter((x) => x.s.healthy);
  if (healthy.length === 0) return { servers, target: null, status: 503 };
  const pick = healthy[rrIndex % healthy.length];
  const next = servers.map((s) => (s === pick.s ? { ...s, requests: s.requests + 1 } : s));
  return { servers: next, target: pick.s, status: 200 };
}

export function toggleServer(servers: LbServer[], name: string): LbServer[] {
  return servers.map((s) => (s.name === name ? { ...s, healthy: !s.healthy } : s));
}

// --------------------------------------------------------------- Topic 05

export type GatewayFailure =
  | "none"
  | "invalid-jwt"
  | "rate-limited"
  | "service-down"
  | "gateway-down";

export interface GatewayRoute {
  path: string;
  service: string;
}

export const GATEWAY_ROUTES: GatewayRoute[] = [
  { path: "/api/user", service: "User Service" },
  { path: "/api/billing", service: "Billing Service" },
  { path: "/api/search", service: "Search Service" },
];

export interface GatewayResult {
  status: number;
  route?: GatewayRoute;
  message: string;
  reachedService: boolean;
}

export function gatewayHandle(
  route: GatewayRoute,
  jwtValid: boolean,
  rateExceeded: boolean,
  serviceDown: boolean,
  gatewayDown: boolean
): GatewayResult {
  if (gatewayDown) {
    return { status: 502, message: "502 Bad Gateway — the gateway itself is down (SPOF)", reachedService: false };
  }
  if (!jwtValid) {
    return { status: 401, message: "401 Unauthorized — JWT invalid. Rejected AT the gateway; no service call made.", reachedService: false };
  }
  if (rateExceeded) {
    return { status: 429, message: "429 Too Many Requests — rate limit at the gateway", reachedService: false };
  }
  if (serviceDown) {
    return { status: 503, message: `503 Service Unavailable — ${route.service} is down`, reachedService: false };
  }
  return { status: 200, message: `200 OK — routed to ${route.service} with a trusted identity context`, route, reachedService: true };
}

// --------------------------------------------------------------- Topic 06

export type PipelineStage = "idle" | "push" | "build" | "test" | "package" | "deploy" | "deploy-skipped" | "failed";
export interface PipelineState {
  stage: PipelineStage;
  injectFailingTest: boolean;
  injectBuildError: boolean;
  log: string[];
  runs: number;
  deploys: number;
}

export function makePipeline(): PipelineState {
  return { stage: "idle", injectFailingTest: false, injectBuildError: false, log: [], runs: 0, deploys: 0 };
}

export function runPipeline(s: PipelineState): PipelineState {
  const log: string[] = [];
  const runs = s.runs + 1;
  if (s.injectBuildError) {
    log.push("▶ Push code", "✗ Build failed (missing dependency)");
    return { ...s, stage: "failed", log, runs, deploys: s.deploys };
  }
  log.push("▶ Push code", "✓ Build passed");
  if (s.injectFailingTest) {
    log.push("✗ Tests FAILED (1 failing test)", "⏭ Deployment SKIPPED — bad code cannot reach users");
    return { ...s, stage: "deploy-skipped", log, runs, deploys: s.deploys };
  }
  log.push("✓ Tests passed", "✓ Docker image built", "✓ Deployed to production");
  return { ...s, stage: "deploy", log, runs, deploys: s.deploys + 1 };
}

// --------------------------------------------------------------- Topic 07

export interface DockerState {
  images: number;
  containers: { id: string; running: boolean }[];
  built: number;
  started: number;
  stopped: number;
}

export const makeDockerState = (): DockerState => ({ images: 0, containers: [], built: 0, started: 0, stopped: 0 });

export function dockerBuild(s: DockerState): DockerState {
  return { ...s, images: s.images + 1, built: s.built + 1 };
}

export function dockerRun(s: DockerState): DockerState {
  if (s.images === 0) return s;
  const id = `c${s.containers.length + 1}`;
  return {
    ...s,
    containers: [...s.containers, { id, running: true }],
    started: s.started + 1,
  };
}

export function dockerStop(s: DockerState, id: string): DockerState {
  let stopped = s.stopped;
  const containers = s.containers.map((c) => {
    if (c.id === id && c.running) {
      stopped += 1;
      return { ...c, running: false };
    }
    return c;
  });
  return { ...s, containers, stopped };
}

// --------------------------------------------------------------- Topic 08

export interface KubeState {
  desired: number;
  pods: { id: string; phase: "Running" | "Crashed" }[];
  events: string[];
  reconciliations: number;
}

export const makeKubeState = (desired = 3): KubeState => ({
  desired,
  pods: Array.from({ length: desired }, (_, i) => ({ id: `pod-${i + 1}`, phase: "Running" as const })),
  events: [],
  reconciliations: 0,
});

export function kubeCrashRandomPod(s: KubeState, podId?: string): KubeState {
  const target = podId ?? s.pods[0]?.id;
  if (!target) return s;
  const pods = s.pods.map((p) => (p.id === target ? { ...p, phase: "Crashed" as const } : p));
  return { ...s, pods, events: [...s.events, `⚠ ${target} CRASHED`] };
}

/** The reconciler: if actual running count < desired, start replacements. */
export function kubeReconcile(s: KubeState): KubeState {
  const running = s.pods.filter((p) => p.phase === "Running").length;
  if (running === s.desired) return s;
  const events = [...s.events];
  let pods = [...s.pods];
  if (pods.length > s.desired) {
    pods = pods.slice(0, s.desired);
    events.push(`↧ scaled down to ${s.desired} pods`);
  }
  const toStart = s.desired - pods.filter((p) => p.phase === "Running").length;
  const replacements = Array.from({ length: Math.max(0, toStart) }, (_, i) => ({
    id: `pod-${pods.length + i + 1}`,
    phase: "Running" as const,
  }));
  if (replacements.length) {
    pods = [...pods.filter((p) => p.phase === "Running"), ...replacements];
    events.push(`↧ detected ${toStart} missing pod(s) → started replacements → desired state restored`);
  }
  return { ...s, pods, events, reconciliations: s.reconciliations + 1 };
}

export function kubeSetDesired(s: KubeState, desired: number): KubeState {
  return { ...s, desired: Math.max(1, Math.min(8, desired)) };
}

// --------------------------------------------------------------- Topic 09

export interface DiscoveryState {
  currentIp: string;
  ipHistory: string[];
  directCallResult: "ok" | "stale-ip-fail" | null;
  serviceCallResult: "ok" | null;
  resolvedIp: string | null;
}

export const makeDiscoveryState = (): DiscoveryState => ({
  currentIp: "10.0.1.17",
  ipHistory: ["10.0.1.17"],
  directCallResult: null,
  serviceCallResult: null,
  resolvedIp: null,
});

export function discoveryRestartPod(s: DiscoveryState, nextIp: string): DiscoveryState {
  return { ...s, currentIp: nextIp, ipHistory: [...s.ipHistory, nextIp] };
}

export function discoveryCallDirectIp(s: DiscoveryState, ip: string): DiscoveryState {
  const ok = ip === s.currentIp;
  return {
    ...s,
    directCallResult: ok ? "ok" : "stale-ip-fail",
    resolvedIp: null,
    serviceCallResult: null,
  };
}

export function discoveryCallServiceName(s: DiscoveryState): DiscoveryState {
  return { ...s, serviceCallResult: "ok", resolvedIp: s.currentIp, directCallResult: null };
}

// --------------------------------------------------------------- Topic 10

export type BreakerState = "closed" | "open" | "half-open";
export interface CircuitBreaker {
  state: BreakerState;
  consecutiveFailures: number;
  threshold: number;
  cooldownRemaining: number;
  successCount: number;
  failCount: number;
  fastFails: number;
}

export const makeBreaker = (threshold = 5, _cooldown = 5): CircuitBreaker => ({
  state: "closed",
  consecutiveFailures: 0,
  threshold,
  cooldownRemaining: 0,
  successCount: 0,
  failCount: 0,
  fastFails: 0,
});

export type BreakerOutcome = "success" | "slow-fail" | "fast-fail";

export function breakerCall(b: CircuitBreaker, downstreamSucceeds: boolean): { breaker: CircuitBreaker; outcome: BreakerOutcome } {
  if (b.state === "open") {
    return {
      breaker: { ...b, fastFails: b.fastFails + 1 },
      outcome: "fast-fail",
    };
  }
  if (downstreamSucceeds) {
    return {
      breaker: { ...b, state: "closed", consecutiveFailures: 0, successCount: b.successCount + 1 },
      outcome: "success",
    };
  }
  const consecutiveFailures = b.consecutiveFailures + 1;
  const failCount = b.failCount + 1;
  if (consecutiveFailures >= b.threshold) {
    return {
      breaker: { ...b, state: "open", consecutiveFailures, failCount, cooldownRemaining: b.cooldownRemaining || 5 },
      outcome: "slow-fail",
    };
  }
  return { breaker: { ...b, consecutiveFailures, failCount }, outcome: "slow-fail" };
}

export function breakerTickCooldown(b: CircuitBreaker, seconds: number): CircuitBreaker {
  if (b.state !== "open") return b;
  const remaining = b.cooldownRemaining - seconds;
  if (remaining <= 0) {
    return { ...b, cooldownRemaining: 0, state: "half-open" };
  }
  return { ...b, cooldownRemaining: remaining };
}

// --------------------------------------------------------------- Topic 11

export interface TimeoutResult {
  ok: boolean;
  waitedMs: number;
  message: string;
}

export function timeoutCall(timeoutMs: number, responseMs: number): TimeoutResult {
  if (responseMs <= timeoutMs) {
    return { ok: true, waitedMs: responseMs, message: `200 OK after ${responseMs}ms — inside the ${timeoutMs}ms deadline` };
  }
  return {
    ok: false,
    waitedMs: timeoutMs,
    message: `⏱ TIMEOUT at ${timeoutMs}ms — downstream would have answered at ${responseMs}ms. Fail fast instead of piling up connections.`,
  };
}

// --------------------------------------------------------------- Topic 12

export type RetryDecision = { action: "retry" | "fail"; reason: string };

export function isRetryable(status: number): boolean {
  return status >= 500 || status === -1; // -1 = network error
}

export function retryStep(attempt: number, maxAttempts: number, status: number): RetryDecision {
  if (!isRetryable(status)) {
    return { action: "fail", reason: `HTTP ${status} is a client error — NOT retryable (resending the same bad request can't succeed)` };
  }
  if (attempt >= maxAttempts) {
    return { action: "fail", reason: `Max attempts (${maxAttempts}) reached — surface a clear error to the user` };
  }
  return { action: "retry", reason: `HTTP ${status} is transient — retrying (attempt ${attempt + 1} of ${maxAttempts})` };
}

// --------------------------------------------------------------- Topic 13

export function backoffDelay(attempt: number, baseMs = 1000, jitterFraction = 0.25, rand: () => number = Math.random): number {
  const exp = baseMs * Math.pow(2, attempt - 1);
  const jitter = exp * jitterFraction * (rand() * 2 - 1); // ±jitterFraction
  return Math.max(0, Math.round(exp + jitter));
}

export interface RetryWave {
  t: number;
  clients: number;
}

/** Without jitter, every client that failed at t=0 retries at fixed offsets. */
export function synchronizedWaves(attempts: number, clients: number): RetryWave[] {
  const waves: RetryWave[] = [];
  let t = 0;
  for (let n = 1; n <= attempts; n++) {
    waves.push({ t, clients });
    t += Math.pow(2, n - 1);
  }
  return waves;
}

/** With jitter, each client's retry time is decorrelated. */
export function jitteredWave(attempt: number, clients: number, rand: () => number = Math.random): RetryWave[] {
  const base = Math.pow(2, attempt - 1);
  const spread = base * 0.5;
  return Array.from({ length: clients }, () => ({
    t: base + (rand() - 0.5) * 2 * spread,
    clients: 1,
  }));
}

// --------------------------------------------------------------- Topic 14

export interface LedgerEntry {
  key: string | null;
  result: string;
}

export interface IdempotencyState {
  balance: number;
  ledger: LedgerEntry[];
  processedKeys: Map<string, string>;
  charges: number;
  lastAction: string;
}

export const makeIdempotencyState = (startBalance = 250): IdempotencyState => ({
  balance: startBalance,
  ledger: [],
  processedKeys: new Map(),
  charges: 0,
  lastAction: "",
});

export interface ChargeRequest {
  amount: number;
  idempotencyKey?: string;
}

export function charge(state: IdempotencyState, req: ChargeRequest, responseDelivered = true): IdempotencyState {
  const key = req.idempotencyKey ?? null;
  if (key && state.processedKeys.has(key)) {
    return {
      ...state,
      lastAction: `RETRY with key ${key}: recognized as processed → returned recorded result, NO second deduction`,
    };
  }
  const balance = state.balance - req.amount;
  const result = `charged $${req.amount}`;
  const processedKeys = new Map(state.processedKeys);
  if (key) processedKeys.set(key, result);
  return {
    ...state,
    balance,
    charges: state.charges + 1,
    ledger: [...state.ledger, { key, result: `${result}${responseDelivered ? "" : " (response lost — client will retry)"}` }],
    processedKeys,
    lastAction: responseDelivered
      ? `Charged $${req.amount}${key ? ` (key ${key} recorded)` : " (⚠ NO idempotency key)"}`
      : `Charged $${req.amount} but the response was LOST — the client thinks it failed and will retry`,
  };
}

// --------------------------------------------------------------- Topic 15

export interface QueueJob {
  id: string;
  label: string;
  attempts: number;
  state: "queued" | "processing" | "done" | "dlq";
}

export interface QueueSystem {
  jobs: QueueJob[];
  workersOnline: number;
  emailApiUp: boolean;
  processed: number;
  dlqCount: number;
}

export const makeQueueSystem = (): QueueSystem => ({
  jobs: [],
  workersOnline: 1,
  emailApiUp: true,
  processed: 0,
  dlqCount: 0,
});

export function enqueueJob(s: QueueSystem, label: string): QueueSystem {
  const id = `job-${s.jobs.length + 1}`;
  return { ...s, jobs: [...s.jobs, { id, label, attempts: 0, state: "queued" }] };
}

export const DLQ_THRESHOLD = 3;

/** One worker tick: process the first queued job (respect retries + DLQ). */
export function queueTick(s: QueueSystem): QueueSystem {
  const idx = s.jobs.findIndex((j) => j.state === "queued");
  if (idx === -1 || s.workersOnline === 0) return s;
  const job = s.jobs[idx];
  const attempts = job.attempts + 1;
  if (s.emailApiUp) {
    const jobs = [...s.jobs];
    jobs[idx] = { ...job, attempts, state: "done" };
    return { ...s, jobs, processed: s.processed + 1 };
  }
  const jobs = [...s.jobs];
  if (attempts >= DLQ_THRESHOLD) {
    jobs[idx] = { ...job, attempts, state: "dlq" };
    return { ...s, jobs, dlqCount: s.dlqCount + 1 };
  }
  // failed attempt: returns to the queue
  jobs[idx] = { ...job, attempts, state: "queued" };
  return { ...s, jobs };
}

// --------------------------------------------------------------- Topic 16

export interface PubSubSystem {
  subscribers: { name: string; online: boolean; received: number; backlog: number }[];
  published: number;
  history: string[];
}

export const makePubSub = (): PubSubSystem => ({
  subscribers: [
    { name: "Inventory", online: true, received: 0, backlog: 0 },
    { name: "Billing", online: true, received: 0, backlog: 0 },
    { name: "Analytics", online: true, received: 0, backlog: 0 },
  ],
  published: 0,
  history: [],
});

export function publishEvent(s: PubSubSystem, event: string): PubSubSystem {
  const subscribers = s.subscribers.map((sub) =>
    sub.online
      ? { ...sub, received: sub.received + 1 }
      : { ...sub, backlog: sub.backlog + 1 }
  );
  const history = [
    ...s.history,
    `📤 Order Service published "${event}" to the topic`,
    ...s.subscribers
      .filter((sub) => sub.online)
      .map((sub) => `   ✉ ${sub.name} received "${event}"`),
    ...s.subscribers.filter((sub) => !sub.online).map((sub) => `   💤 ${sub.name} offline — event held in topic (backlog +1)`),
  ];
  return { ...s, subscribers, published: s.published + 1, history };
}

export function toggleSubscriber(s: PubSubSystem, name: string): PubSubSystem {
  const subscribers = s.subscribers.map((sub) => (sub.name === name ? { ...sub, online: !sub.online } : sub));
  return { ...s, subscribers };
}

export function bringSubscriberOnline(s: PubSubSystem, name: string): PubSubSystem {
  const sub = s.subscribers.find((x) => x.name === name);
  if (!sub || sub.online) return s;
  const drained = Math.min(sub.backlog, sub.backlog); // processes entire backlog
  const subscribers = s.subscribers.map((x) =>
    x.name === name ? { ...x, online: true, backlog: 0, received: x.received + drained } : x
  );
  const history = [...s.history, `🔌 ${name} back online → processed backlog of ${drained} event(s)`];
  return { ...s, subscribers, history };
}

// --------------------------------------------------------------- Topic 17

export interface TraceEvent {
  service: string;
  event: string;
  traceId: string;
}

export interface EdaSystem {
  events: TraceEvent[];
  consumedBy: Record<string, string[]>;
}

export const EDA_CONSUMERS: Record<string, string[]> = {
  UserCreated: ["Email Service", "Analytics Data Lake"],
  ItemAdded: ["Analytics Data Lake", "Cart Service"],
};

export function edaPublish(s: EdaSystem, event: string, service: string, traceId: string): EdaSystem {
  const consumedBy = EDA_CONSUMERS[event] ?? [];
  return {
    events: [...s.events, { service, event, traceId }],
    consumedBy: { ...s.consumedBy, [event]: consumedBy },
  };
}

/** Event-sourcing bank account: balance is the FOLD of events, not a stored row. */
export interface BankEvent {
  type: "Deposit" | "Withdraw";
  amount: number;
}

export const foldBalance = (events: BankEvent[]): number =>
  events.reduce((bal, e) => (e.type === "Deposit" ? bal + e.amount : bal - e.amount), 0);

// --------------------------------------------------------------- Topic 18

export type TwoPCVote = "YES" | "NO" | "TIMEOUT";
export type TwoPCOutcome =
  | { kind: "committed"; detail: string }
  | { kind: "aborted"; detail: string }
  | { kind: "partial-failure"; detail: string };

export interface TwoPCParticipant {
  name: string;
  vote: TwoPCVote | null;
  committed: boolean | null;
}

export interface TwoPCState {
  participants: TwoPCParticipant[];
  phase: "idle" | "prepare" | "commit" | "outcome";
}

export function twoPCPrepare(votes: Record<string, TwoPCVote>): TwoPCState {
  return {
    participants: Object.entries(votes).map(([name, vote]) => ({ name, vote, committed: null })),
    phase: "prepare",
  };
}

/**
 * Commit if all vote YES. A participant crash during COMMIT is the classic
 * partial-failure window of 2PC.
 */
export function twoPCCommit(state: TwoPCState, crashDuringCommit?: string): TwoPCOutcome {
  const allYes = state.participants.every((p) => p.vote === "YES");
  if (!allYes) {
    const noVotes = state.participants.filter((p) => p.vote !== "YES").map((p) => p.name);
    return { kind: "aborted", detail: `ABORT — ${noVotes.join(", ")} voted NO/TIMEOUT in the prepare phase. No database changed anything.` };
  }
  if (crashDuringCommit) {
    return {
      kind: "partial-failure",
      detail: `PARTIAL FAILURE — ${crashDuringCommit} crashed between prepare and commit. ${
        state.participants.filter((p) => p.name !== crashDuringCommit).map((p) => p.name)
      } committed their part; ${crashDuringCommit} did not. Rows are LOCKED while the coordinator waits — this is why 2PC is rarely used.`,
    };
  }
  return { kind: "committed", detail: `COMMIT — ${state.participants.map((p) => p.name).join(" and ")} both committed atomically after voting YES.` };
}

// --------------------------------------------------------------- Topic 19

export type SagaStepState = "pending" | "done" | "failed" | "compensated";

export interface SagaStep {
  name: string;
  action: string;
  compensate: string;
  state: SagaStepState;
}

export const makeSaga = (): SagaStep[] => [
  { name: "Create Order", action: "order created in Orders DB", compensate: "order cancelled", state: "pending" },
  { name: "Charge Card", action: "$50 charged in Billing DB", compensate: "refund $50", state: "pending" },
  { name: "Ship Product", action: "shipment created in Shipping DB", compensate: "cancel shipment", state: "pending" },
];

export type SagaMode = "choreography" | "orchestration";

/**
 * Runs the saga forward up to `failAt` (1-based) or to completion when
 * undefined. On failure, runs compensating transactions backward.
 */
export function runSaga(steps: SagaStep[], failAt: number | undefined, mode: SagaMode): { steps: SagaStep[]; log: string[] } {
  const log: string[] = [];
  let current = steps.map((s) => ({ ...s, state: "pending" as SagaStepState }));
  const prefix = mode === "orchestration" ? "🎯 Saga Manager" : "🎵 Choreography";
  const failIdx = failAt !== undefined ? failAt - 1 : -1;
  for (let i = 0; i < current.length; i++) {
    if (i === failIdx) {
      current[i].state = "failed";
      log.push(`✗ ${prefix}: step ${i + 1} "${current[i].name}" FAILED → publishing failure event`);
      for (let j = i - 1; j >= 0; j--) {
        current[j].state = "compensated";
        log.push(`↩ ${prefix}: compensating "${current[j].name}" → ${current[j].compensate}`);
      }
      return { steps: current, log };
    }
    current[i].state = "done";
    log.push(`✓ ${prefix}: step ${i + 1} "${current[i].name}" → ${current[i].action}; event published`);
  }
  return { steps: current, log };
}

// --------------------------------------------------------------- Topic 20

export interface CronField {
  expr: string;
  label: string;
}

export const CRON_FIELDS: CronField[] = [
  { expr: "0", label: "Minute (0)" },
  { expr: "0", label: "Hour (0)" },
  { expr: "*", label: "Day (any)" },
  { expr: "*", label: "Month (any)" },
  { expr: "0", label: "Day of week (Sun = 0)" },
];

export interface CronRun {
  server: string;
  emailsSent: number;
}

export interface CronState {
  servers: CronRun[];
  distributedLock: boolean;
  runs: number;
}

export const makeCronState = (): CronState => ({
  servers: [
    { server: "Server 1", emailsSent: 0 },
    { server: "Server 2", emailsSent: 0 },
    { server: "Server 3", emailsSent: 0 },
  ],
  distributedLock: false,
  runs: 0,
});

/** One scheduled midnight tick. Without a lock, EVERY server fires. */
export function cronTick(s: CronState, jobEnqueued: boolean): { state: CronState; log: string[] } {
  const log: string[] = [];
  const runs = s.runs + 1;
  if (s.distributedLock) {
    const winner = `Server ${(runs % 3) + 1}`;
    log.push(`🔒 Distributed lock: only ${winner} claims the job`);
    const servers = s.servers.map((x) =>
      x.server === winner ? { ...x, emailsSent: x.emailsSent + 1 } : x
    );
    log.push(jobEnqueued ? `📥 ${winner} enqueues "weekly_digest" job → a worker pulls it from the queue (cron doesn't do heavy work)` : `✉ ${winner} sends 1 weekly digest email`);
    return { state: { ...s, servers, runs }, log };
  }
  log.push("⚠ No lock — every server independently fires the same schedule");
  const servers = s.servers.map((x) => ({ ...x, emailsSent: x.emailsSent + 1 }));
  log.push("✉✉✉ 3 identical weekly digest emails sent (users get triplicates)");
  return { state: { ...s, servers, runs }, log };
}

/** UTC timezone math: what a 00:00 UTC run looks like in New York. */
export function utcToLocalHour(utcHour: number, tzOffsetHours: number, dstOffsetHours = 0): number {
  return (utcHour + tzOffsetHours + dstOffsetHours + 24) % 24;
}
