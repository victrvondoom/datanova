/**
 * Failure Injection Lab — structural simulation.
 *
 * Nothing here is a canned outcome. Each run reads the learner's actual
 * architecture (timeouts, retry policies, breakers, queue settings, locks,
 * idempotency stores, instance counts) and the capacity assumptions, then
 * simulates a small deterministic scenario. If the architecture lacks a
 * mechanism, the simulation shows the failure unprotected.
 */
import type { SysState } from "../trail/ui";
import { Architecture, ArchNode, Kind, bool, incoming, num, nodesOfKind, outgoing, str } from "./model";
import {
  accessors,
  breakerFor,
  consumersOf,
  cronProtectionEffective,
  dlqsOf,
  effectiveTimeoutMs,
  healthCheckFor,
  isPaymentLike,
  publishersOf,
  retryFor,
  subscribersOf,
  syncCallers,
} from "./graph";
import { CapacityInputs, DEFAULT_CAPACITY, sanitize, simulateQueue } from "./capacity";

export type FailureId =
  | "instance-crash" | "db-slow" | "cache-down" | "api-503" | "api-timeout" | "consumer-crash"
  | "backlog-growth" | "poison-job" | "duplicate-payment" | "cron-multi" | "subscriber-down" | "dependency-unhealthy";

export interface FailureDef {
  id: FailureId;
  name: string;
  description: string;
  targetKinds: Kind[];
  topics: number[];
}

export const FAILURES: FailureDef[] = [
  { id: "instance-crash", name: "Application instance crashes", description: "One instance of a service dies.", targetKinds: ["app_service", "web_app", "auth_service"], topics: [3, 8, 9] },
  { id: "db-slow", name: "Database becomes slow", description: "Queries take seconds instead of milliseconds.", targetKinds: ["postgres"], topics: [11, 10, 2] },
  { id: "cache-down", name: "Cache becomes unavailable", description: "Every read now falls through to the database.", targetKinds: ["redis_cache"], topics: [2, 1] },
  { id: "api-503", name: "External API returns HTTP 503", description: "The provider answers immediately with an error.", targetKinds: ["external_service"], topics: [12, 13, 10] },
  { id: "api-timeout", name: "External API times out", description: "The provider accepts the call and never answers.", targetKinds: ["external_service"], topics: [11, 10] },
  { id: "consumer-crash", name: "Queue consumer crashes", description: "A worker dies while processing a job.", targetKinds: ["worker"], topics: [15, 14] },
  { id: "backlog-growth", name: "Queue backlog grows", description: "Jobs arrive several times faster than usual.", targetKinds: ["queue"], topics: [15, 1] },
  { id: "poison-job", name: "A job repeatedly fails and reaches the DLQ", description: "One message can never be processed successfully.", targetKinds: ["queue"], topics: [15, 12] },
  { id: "duplicate-payment", name: "Duplicate payment request arrives", description: "The same charge request is submitted twice at once.", targetKinds: ["app_service", "web_app", "worker"], topics: [14] },
  { id: "cron-multi", name: "Scheduled task runs on multiple instances", description: "Every scheduler instance fires the same schedule.", targetKinds: ["cron_runner"], topics: [20, 14] },
  { id: "subscriber-down", name: "Pub/Sub subscriber becomes unavailable", description: "A consumer of events is down while events keep coming.", targetKinds: ["app_service", "web_app", "worker"], topics: [16, 17] },
  { id: "dependency-unhealthy", name: "A downstream dependency stays unhealthy", description: "The dependency is down for a sustained period (60 s window).", targetKinds: ["external_service", "auth_service", "app_service"], topics: [10, 12, 13] },
];

export const getFailure = (id: FailureId): FailureDef => FAILURES.find((f) => f.id === id) as FailureDef;

export interface TraceStep {
  kind: "trigger" | "request" | "protection" | "failure" | "retry" | "degrade" | "outcome" | "note";
  text: string;
  nodeIds: string[];
  edgeIds: string[];
}
export type EdgeState = "ok" | "failed" | "degraded" | "retrying";
export type Outcome = "handled" | "degraded" | "failed" | "data_risk" | "not_applicable";

export interface Protection {
  name: string;
  active: boolean;
  detail: string;
}

export interface FailureStats {
  total: number;
  ok: number;
  slow: number;
  degraded: number;
  failed: number;
  retries: number;
  /** calls rejected instantly by an open circuit breaker */
  fastFailed: number;
  /** requests that never returned (no timeout) */
  hung: number;
  duplicatesExecuted: number;
  duplicatesPrevented: number;
  /** attempts sent to the dependency per user request (retry amplification) */
  amplification: number;
  unit: string;
}

export interface FailureResult {
  failureId: FailureId;
  targetId: string | null;
  applicable: boolean;
  steps: TraceStep[];
  nodeStates: Record<string, SysState>;
  edgeStates: Record<string, EdgeState>;
  stats: FailureStats;
  protections: Protection[];
  propagates: boolean;
  propagationNote: string;
  outcome: Outcome;
  explanation: string;
  /** work waiting to be recovered once the component is back */
  pending: { kind: "none" | "jobs" | "events"; count: number; durable: boolean; mechanism: string };
  /** queue depth over time when relevant */
  series: Array<[number, number]>;
  /** what would make this safer, derived from missing protections */
  missing: string[];
}

export interface FailureParams {
  targetId?: string;
  /** db-slow: query latency (ms) */
  latencyMs?: number;
  /** backlog-growth: arrival multiplier */
  multiplier?: number;
  /** duplicate-payment: number of identical requests */
  copies?: number;
  /** simulated request count */
  requests?: number;
}

const REQUESTS = 20;
const SUSTAINED = 60;
const DEADLINE_MS = 30000;
const SLOW_THRESHOLD_MS = 1000;

const emptyStats = (): FailureStats => ({ total: 0, ok: 0, slow: 0, degraded: 0, failed: 0, retries: 0, fastFailed: 0, hung: 0, duplicatesExecuted: 0, duplicatesPrevented: 0, amplification: 1, unit: "requests" });
const byId = (a: Architecture, id: string): ArchNode | undefined => a.nodes.find((n) => n.id === id);
const nm = (n: ArchNode): string => `“${n.name}”`;

function newResult(failureId: FailureId, a: Architecture, targetId: string | null): FailureResult {
  const nodeStates: Record<string, SysState> = {};
  for (const n of a.nodes) nodeStates[n.id] = "healthy";
  return {
    failureId, targetId, applicable: true, steps: [], nodeStates, edgeStates: {}, stats: emptyStats(), protections: [],
    propagates: false, propagationNote: "", outcome: "handled", explanation: "",
    pending: { kind: "none", count: 0, durable: false, mechanism: "" }, series: [], missing: [],
  };
}

function notApplicable(failureId: FailureId, a: Architecture, def: FailureDef, why?: string): FailureResult {
  const r = newResult(failureId, a, null);
  r.applicable = false;
  r.outcome = "not_applicable";
  r.explanation = why ?? `Your architecture has no ${def.targetKinds.join(" / ").replace(/_/g, " ")} for this failure to hit, so it cannot be injected. That is not the same as being protected.`;
  r.steps.push({ kind: "note", text: r.explanation, nodeIds: [], edgeIds: [] });
  return r;
}

const step = (r: FailureResult, kind: TraceStep["kind"], text: string, nodeIds: string[] = [], edgeIds: string[] = []): void => {
  r.steps.push({ kind, text, nodeIds, edgeIds });
};

/** shortest sync/data path from a client (or entry node) to the target, for highlighting */
export function requestPath(a: Architecture, targetId: string): { nodeIds: string[]; edgeIds: string[] } | null {
  const starts = a.nodes.filter((n) => n.kind === "client").map((n) => n.id);
  const entry = starts.length ? starts : a.nodes.filter((n) => incoming(a, n.id, "sync", "async", "event", "data", "schedule").length === 0).map((n) => n.id);
  const prev = new Map<string, { from: string; edge: string } | null>();
  const queue: string[] = [];
  for (const s of entry) { prev.set(s, null); queue.push(s); }
  while (queue.length) {
    const cur = queue.shift() as string;
    if (cur === targetId) break;
    for (const c of outgoing(a, cur, "sync", "data")) {
      if (prev.has(c.to)) continue;
      prev.set(c.to, { from: cur, edge: c.id });
      queue.push(c.to);
    }
  }
  if (!prev.has(targetId)) return null;
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  let cur: string | undefined = targetId;
  while (cur) {
    nodeIds.unshift(cur);
    const p: { from: string; edge: string } | null | undefined = prev.get(cur);
    if (!p) break;
    edgeIds.unshift(p.edge);
    cur = p.from;
  }
  return { nodeIds, edgeIds };
}

// ------------------------------------------------------------- call engine

interface CallSim {
  outcomes: Array<"ok" | "slow" | "degraded" | "failed" | "hung">;
  retries: number;
  attempts: number;
  fastFailed: number;
  breakerOpened: boolean;
  breakerHalfOpenProbes: number;
  avgLatencyMs: number;
}

type Mode = "down" | "hang" | "slow";

function simulateCalls(a: Architecture, caller: ArchNode, callee: ArchNode, mode: Mode, requests: number, slowMs: number): CallSim {
  const timeout = effectiveTimeoutMs(a, caller, callee);
  const retry = retryFor(a, callee.id);
  const breaker = breakerFor(a, callee.id);
  const maxAtt = retry ? (num(retry, "maxAttempts") === 0 ? 10 : num(retry, "maxAttempts")) : 1;
  const backoff = retry ? str(retry, "backoff") : "none";
  const threshold = breaker ? num(breaker, "failureThreshold", 5) : Infinity;
  const openSec = breaker ? num(breaker, "openSeconds", 30) : 0;
  const fallback = breaker ? str(breaker, "fallback") : "none";
  const delay = (k: number): number => (backoff === "none" ? 0 : backoff === "fixed" ? 1000 : (1000 * 2 ** (k - 1)) * (backoff === "exponential_jitter" ? 0.5 : 1));
  let consec = 0;
  let openUntil = -1;
  let wasOpen = false;
  const sim: CallSim = { outcomes: [], retries: 0, attempts: 0, fastFailed: 0, breakerOpened: false, breakerHalfOpenProbes: 0, avgLatencyMs: 0 };
  let latSum = 0;
  let latN = 0;
  for (let t = 0; t < requests; t++) {
    if (breaker && t < openUntil) {
      sim.fastFailed++;
      sim.outcomes.push(fallback !== "none" ? "degraded" : "failed");
      continue;
    }
    if (breaker && wasOpen && t >= openUntil) sim.breakerHalfOpenProbes++;
    let latency = 0;
    let outcome: CallSim["outcomes"][number] = "failed";
    let opened = false;
    for (let att = 1; att <= maxAtt; att++) {
      sim.attempts++;
      let ok = false;
      let ms = 20;
      if (mode === "hang") {
        if (timeout > 0) ms = timeout;
        else { outcome = "hung"; latency = Infinity; break; }
      } else if (mode === "slow") {
        if (timeout > 0 && slowMs > timeout) ms = timeout;
        else { ok = true; ms = slowMs; }
      }
      latency += ms;
      if (ok) { consec = 0; outcome = ms >= SLOW_THRESHOLD_MS ? "slow" : "ok"; break; }
      consec++;
      if (breaker && consec >= threshold) { openUntil = t + openSec; wasOpen = true; sim.breakerOpened = true; consec = threshold - 1; opened = true; outcome = "failed"; break; }
      if (att < maxAtt) { sim.retries++; latency += delay(att); } else outcome = "failed";
      if (latency > DEADLINE_MS) break;
    }
    if (outcome !== "hung" && latency > DEADLINE_MS) outcome = "failed";
    if (outcome === "failed" && opened && fallback !== "none") outcome = "degraded";
    sim.outcomes.push(outcome);
    if (Number.isFinite(latency)) { latSum += latency; latN++; }
  }
  sim.avgLatencyMs = latN ? Math.round(latSum / latN) : 0;
  return sim;
}

function tally(outcomes: CallSim["outcomes"], stats: FailureStats): void {
  for (const o of outcomes) {
    stats.total++;
    if (o === "ok") stats.ok++;
    else if (o === "slow") { stats.ok++; stats.slow++; }
    else if (o === "degraded") stats.degraded++;
    else if (o === "hung") { stats.failed++; stats.hung++; }
    else stats.failed++;
  }
}

function slotsOf(n: ArchNode, cap: CapacityInputs): number {
  const inst = Math.max(1, num(n, "instances", 1));
  return n.kind === "worker" ? inst : inst * Math.max(1, cap.concurrencyPerInstance);
}

/** Little's-law style check: do hung/slow calls pin every concurrency slot? */
function saturation(lambda: number, holdMs: number, slots: number): { held: number; saturated: boolean; secondsToExhaust: number } {
  const held = lambda * (holdMs / 1000);
  return { held, saturated: lambda > 0 && held > slots, secondsToExhaust: lambda > 0 ? slots / lambda : Infinity };
}

function protectionsFor(a: Architecture, caller: ArchNode, callee: ArchNode, r: FailureResult, sim: CallSim): void {
  const timeout = effectiveTimeoutMs(a, caller, callee);
  const retry = retryFor(a, callee.id);
  const breaker = breakerFor(a, callee.id);
  r.protections.push({ name: "Timeout", active: timeout > 0, detail: timeout > 0 ? `${nm(caller)} gives up after ${timeout} ms.` : `${nm(caller)} has no timeout for ${nm(callee)}.` });
  r.protections.push({ name: "Retry policy", active: !!retry && sim.retries > 0, detail: retry ? `Up to ${num(retry, "maxAttempts") === 0 ? "10 (unbounded; capped in the model)" : num(retry, "maxAttempts")} attempts, backoff ${str(retry, "backoff")}; ${sim.retries} retries happened.` : "No retry policy targets this dependency." });
  r.protections.push({ name: "Circuit breaker", active: sim.breakerOpened, detail: breaker ? (sim.breakerOpened ? `Opened after ${num(breaker, "failureThreshold")} failures; ${sim.fastFailed} calls rejected instantly; fallback ‘${str(breaker, "fallback")}’.` : "Present but never reached its threshold in this window.") : "No circuit breaker targets this dependency." });
  if (!(timeout > 0)) r.missing.push("A timeout on the call");
  if (!retry) r.missing.push("A bounded retry policy with backoff (for transient failures)");
  if (!breaker) r.missing.push("A circuit breaker (to stop hammering a dependency that is down)");
}

// ------------------------------------------------------------- finalising

/** A run is a user-visible failure when more than this share of requests fail. */
export const FAILED_SHARE = 0.25;

function classify(r: FailureResult): void {
  const s = r.stats;
  if (r.outcome === "data_risk") return;
  if (s.total > 0 && s.failed / s.total > FAILED_SHARE) r.outcome = "failed";
  else if (s.failed > 0 || s.degraded > 0 || s.slow > 0) r.outcome = "degraded";
  else r.outcome = "handled";
  if (r.propagates && r.outcome === "handled") r.outcome = "degraded";
}

const pct = (n: number, d: number): string => (d > 0 ? `${Math.round((n / d) * 100)}%` : "0%");

// ------------------------------------------------------------- the failures

export function runFailure(a: Architecture, failureId: FailureId, params: FailureParams = {}, capIn: CapacityInputs = DEFAULT_CAPACITY): FailureResult {
  const def = getFailure(failureId);
  const cap = sanitize(capIn);
  const pick = (pred?: (n: ArchNode) => boolean): ArchNode | undefined => {
    const forced = params.targetId ? byId(a, params.targetId) : undefined;
    if (forced && def.targetKinds.includes(forced.kind)) return forced;
    // honour the failure's preferred kind order (e.g. an external dependency before an internal service)
    for (const k of def.targetKinds) {
      const hit = a.nodes.find((n) => n.kind === k && (!pred || pred(n)));
      if (hit) return hit;
    }
    return undefined;
  };
  const result = dispatch(a, def, failureId, params, cap, pick);
  if (result.applicable) {
    result.steps.push({
      kind: "outcome",
      text: `Outcome: ${OUTCOME_LABEL[result.outcome]}. ${result.explanation}`.trim(),
      nodeIds: result.targetId ? [result.targetId] : [],
      edgeIds: [],
    });
  }
  return result;
}

function dispatch(a: Architecture, def: FailureDef, failureId: FailureId, params: FailureParams, cap: CapacityInputs, pick: (pred?: (n: ArchNode) => boolean) => ArchNode | undefined): FailureResult {
  switch (failureId) {
    case "instance-crash": return instanceCrash(a, def, pick(), cap, params);
    case "db-slow": return dbSlow(a, def, pick(), cap, params);
    case "cache-down": return cacheDown(a, def, pick(), cap);
    case "api-503": return externalFailure(a, def, pick(), cap, "down", params.requests ?? REQUESTS);
    case "api-timeout": return externalFailure(a, def, pick(), cap, "hang", params.requests ?? REQUESTS);
    case "dependency-unhealthy": return externalFailure(a, def, pick((n) => syncCallers(a, n).length > 0) ?? pick(), cap, "down", SUSTAINED);
    case "consumer-crash": return consumerCrash(a, def, pick((n) => incoming(a, n.id, "async").length > 0) ?? pick(), cap);
    case "backlog-growth": return backlogGrowth(a, def, pick(), cap, params);
    case "poison-job": return poisonJob(a, def, pick());
    case "duplicate-payment": return duplicatePayment(a, def, params.targetId ? pick() : pick(isPaymentLike), params);
    case "cron-multi": return cronMulti(a, def, pick());
    case "subscriber-down": return subscriberDown(a, def, pick((n) => incoming(a, n.id, "event").length > 0), cap);
  }
}

// 1 ------------------------------------------------------------------
function instanceCrash(a: Architecture, def: FailureDef, target: ArchNode | undefined, cap: CapacityInputs, p: FailureParams): FailureResult {
  if (!target) return notApplicable(def.id, a, def);
  const r = newResult(def.id, a, target.id);
  const n = Math.max(1, num(target, "instances", 1));
  const dist = incoming(a, target.id, "sync").map((c) => byId(a, c.from)).find((x) => x && ["load_balancer", "api_gateway", "reverse_proxy"].includes(x.kind));
  const hc = healthCheckFor(a, target.id) ?? (dist ? healthCheckFor(a, dist.id) : undefined);
  const hcActs = !!hc && str(hc, "action") !== "alert_only";
  const selfHc = str(target, "healthCheck") !== "none" && !!dist && bool(dist, "ejectsUnhealthy");
  const detected = n > 1 && !!dist && (hcActs || selfHc);
  const retry = retryFor(a, target.id);
  const path = requestPath(a, target.id);
  r.nodeStates[target.id] = "failed";
  step(r, "trigger", `One of ${n} instance(s) of ${nm(target)} crashes.`, [target.id]);
  if (path) step(r, "request", `Requests normally flow ${path.nodeIds.map((id) => nm(byId(a, id) as ArchNode)).join(" → ")}.`, path.nodeIds, path.edgeIds);
  const total = p.requests ?? REQUESTS;
  let failedReq = 0;
  let retried = 0;
  const outcomes: CallSim["outcomes"] = [];
  let ejected = false;
  for (let i = 0; i < total; i++) {
    const instance = i % n;
    if (instance !== 0) { outcomes.push("ok"); continue; }
    if (ejected) { outcomes.push("ok"); continue; }
    if (n > 1 && retry && num(retry, "maxAttempts") !== 1) { outcomes.push("ok"); retried++; if (detected) ejected = true; continue; }
    failedReq++;
    outcomes.push("failed");
    if (detected) ejected = true;
  }
  tally(outcomes, r.stats);
  r.stats.retries = retried;
  r.protections.push({ name: "More than one instance", active: n > 1, detail: n > 1 ? `${n - 1} of ${n} instances survive.` : "Single instance: nothing is left to serve traffic." });
  r.protections.push({ name: "Traffic distributor", active: !!dist, detail: dist ? `${nm(dist)} spreads requests across instances.` : "No load balancer / gateway / proxy in front of this service." });
  r.protections.push({ name: "Health check removes dead instance", active: detected, detail: detected ? "Failed instance is detected and ejected after the first failed request." : n > 1 ? "Nothing detects the dead instance, so its share of requests keeps failing until it is restored." : "Not applicable to a single instance." });
  r.protections.push({ name: "Client retry", active: n > 1 && !!retry, detail: retry ? "A retry policy re-sends failed requests to another instance." : "No retry policy: failed requests are not re-sent." });
  if (n === 1) r.missing.push("A second instance behind a load balancer");
  if (n > 1 && !dist) r.missing.push("A load balancer / gateway to spread traffic");
  if (n > 1 && !detected) r.missing.push("A health check that removes unhealthy instances");
  // capacity headroom after losing one instance
  const surviving = n - 1;
  const cp = Math.max(0, surviving) * cap.perInstanceRps;
  const util = cp > 0 ? cap.peakRps / cp : Infinity;
  if (n > 1) {
    step(r, util > 1 ? "failure" : "protection", util > 1 ? `Survivors can absorb only ${Math.round(cp)} req/s against a ${cap.peakRps} req/s peak — overload (${Number.isFinite(util) ? Math.round(util * 100) : "∞"}%).` : `Survivors have ${Math.round(cp)} req/s of capacity for a ${cap.peakRps} req/s peak (${Math.round(util * 100)}% utilization).`, [target.id]);
  }
  if (n === 1) { step(r, "failure", `No instance remains: all ${total} requests fail until ${nm(target)} is restored.`, [target.id], path?.edgeIds ?? []); }
  else if (failedReq > 0) step(r, "failure", `${failedReq} of ${total} requests were routed to the dead instance and failed.`, [target.id], path?.edgeIds ?? []);
  else step(r, "protection", `All ${total} requests succeeded: ${retried > 0 ? "the retry policy re-sent the request that hit the dead instance" : "the dead instance was ejected before any request failed"}.`, [target.id]);
  for (const e of path?.edgeIds ?? []) r.edgeStates[e] = failedReq > 0 ? "failed" : "degraded";
  r.propagates = n === 1 || util > 1;
  r.propagationNote = n === 1 ? "Callers of this service see errors: the failure propagates upstream." : util > 1 ? "Surviving instances are overloaded; the failure spreads to them." : "Contained: surviving instances absorb the load.";
  if (r.propagates) for (const up of syncCallers(a, target)) r.nodeStates[up.id] = "degraded";
  classify(r);
  if (n === 1) r.outcome = "failed";
  else if (util > 1 && r.outcome !== "failed") r.outcome = "degraded";
  r.explanation = n === 1
    ? `${nm(target)} runs as a single instance, so its crash is a full outage until it is restarted.`
    : `${failedReq} request(s) failed. ${detected ? "A health check ejected the dead instance quickly." : retry ? "A retry policy masked the failure." : "Nothing detects or masks the dead instance, so a share of requests keeps failing."} ${util > 1 ? "After the crash the survivors are overloaded at peak." : ""}`.trim();
  return r;
}

// 2 ------------------------------------------------------------------
function dbSlow(a: Architecture, def: FailureDef, target: ArchNode | undefined, cap: CapacityInputs, p: FailureParams): FailureResult {
  if (!target) return notApplicable(def.id, a, def);
  const r = newResult(def.id, a, target.id);
  const L = p.latencyMs ?? 4000;
  r.nodeStates[target.id] = "degraded";
  step(r, "trigger", `${nm(target)} slows to ${L} ms per operation.`, [target.id]);
  const callers = accessors(a, target.id);
  if (callers.length === 0) return notApplicable(def.id, a, def, `${nm(target)} is not connected to any service, so nothing is affected.`);
  const caller = callers[0];
  const cacheNode = outgoing(a, caller.id, "data").map((c) => byId(a, c.to)).find((n) => n?.kind === "redis_cache");
  const frac = cacheNode ? cap.readShare * cap.cacheHitRate : 0;
  const sim = simulateCalls(a, caller, target, "slow", REQUESTS, L);
  // requests absorbed by the cache never touch the database
  const outcomes: CallSim["outcomes"] = [];
  let dbIdx = 0;
  for (let i = 0; i < REQUESTS; i++) {
    const cached = Math.floor((i + 1) * frac) > Math.floor(i * frac);
    outcomes.push(cached ? "ok" : sim.outcomes[dbIdx++ % sim.outcomes.length]);
  }
  tally(outcomes, r.stats);
  r.stats.retries = sim.retries;
  r.stats.fastFailed = sim.fastFailed;
  r.stats.amplification = REQUESTS ? sim.attempts / Math.max(1, REQUESTS - Math.round(REQUESTS * frac)) : 1;
  r.protections.push({ name: "Cache absorbs reads", active: !!cacheNode, detail: cacheNode ? `${Math.round(frac * 100)}% of requests are served from ${nm(cacheNode)} and skip the database.` : "No cache between the service and the database." });
  protectionsFor(a, caller, target, r, sim);
  if (!cacheNode) r.missing.push("A cache for reads (keeps the database off the hot path)");
  const timeout = effectiveTimeoutMs(a, caller, target);
  const sat = saturation(cap.peakRps * (1 - frac), timeout > 0 ? Math.min(L, timeout) : L, slotsOf(caller, cap));
  step(r, "request", `${nm(caller)} → ${nm(target)}: each uncached request now holds a connection for ${timeout > 0 ? Math.min(L, timeout) : L} ms.`, [caller.id, target.id], outgoing(a, caller.id, "data").filter((c) => c.to === target.id).map((c) => c.id));
  for (const c of outgoing(a, caller.id, "data").filter((c) => c.to === target.id)) r.edgeStates[c.id] = "degraded";
  if (sim.outcomes.filter((o) => o === "failed").length) step(r, "failure", `${r.stats.failed} of ${REQUESTS} requests failed (${timeout > 0 && L > timeout ? `timeout at ${timeout} ms fired` : "dependency errors"}).`, [caller.id]);
  if (r.stats.slow) step(r, "degrade", `${r.stats.slow} of ${REQUESTS} requests succeeded but took ~${L} ms.`, [caller.id]);
  r.propagates = sat.saturated;
  r.propagationNote = sat.saturated
    ? `At the ${cap.peakRps} req/s peak about ${Math.round(sat.held)} requests are in flight against ${slotsOf(caller, cap)} concurrency slots: ${nm(caller)} runs out of slots and every endpoint slows down, even ones that do not use the database.`
    : `About ${Math.round(sat.held)} requests in flight at peak fit within ${slotsOf(caller, cap)} slots: contained.`;
  if (sat.saturated) r.nodeStates[caller.id] = "failed"; else r.nodeStates[caller.id] = r.stats.failed ? "degraded" : "healthy";
  classify(r);
  r.explanation = `With the cache ${cacheNode ? "serving part of the reads" : "absent"}, a ${timeout > 0 ? `${timeout} ms timeout` : "missing timeout"} and ${retryFor(a, target.id) ? "retries" : "no retries"}: ${r.stats.failed} failed, ${r.stats.slow} slow, ${r.stats.ok - r.stats.slow} fast. ${timeout > 0 && L > timeout ? "The timeout protects the caller's slots but turns slow responses into errors — a trade-off, not a fix." : ""}`.trim();
  return r;
}

// 3 ------------------------------------------------------------------
function cacheDown(a: Architecture, def: FailureDef, target: ArchNode | undefined, cap: CapacityInputs): FailureResult {
  if (!target) return notApplicable(def.id, a, def);
  const r = newResult(def.id, a, target.id);
  r.nodeStates[target.id] = "failed";
  step(r, "trigger", `${nm(target)} becomes unavailable.`, [target.id]);
  const readers = accessors(a, target.id);
  const db = nodesOfKind(a, "postgres")[0];
  const dbCap = db ? num(db, "capacityOps", cap.dbCapacityOps) : cap.dbCapacityOps;
  const writes = cap.peakRps * (1 - cap.readShare);
  const before = writes + cap.peakRps * cap.readShare * (1 - cap.cacheHitRate);
  const after = cap.peakRps;
  const uBefore = dbCap > 0 ? before / dbCap : Infinity;
  const uAfter = dbCap > 0 ? after / dbCap : Infinity;
  step(r, "request", `Reads that used to hit the cache (${Math.round(cap.readShare * cap.cacheHitRate * 100)}% of traffic) now go to ${db ? nm(db) : "the origin"}: load rises from ${Math.round(before)} to ${Math.round(after)} ops/s against ${dbCap} ops/s capacity.`, [target.id, ...(db ? [db.id] : [])], []);
  for (const rd of readers) for (const c of outgoing(a, rd.id, "data").filter((c) => c.to === target.id)) r.edgeStates[c.id] = "failed";
  const limiter = nodesOfKind(a, "rate_limiter")[0] ?? nodesOfKind(a, "api_gateway").find((g) => bool(g, "builtInRateLimit"));
  const brk = db ? breakerFor(a, db.id) : undefined;
  const fb = !!brk && str(brk, "fallback") !== "none";
  const total = REQUESTS;
  const servedFrac = uAfter > 1 ? 1 / uAfter : 1;
  const okN = Math.round(total * servedFrac);
  r.stats.total = total;
  r.stats.ok = okN;
  if (uAfter > 1) {
    const rest = total - okN;
    if (limiter || fb) r.stats.degraded = rest; else r.stats.failed = rest;
  } else if (uAfter > 0.7) { r.stats.slow = Math.round(total * 0.3); }
  r.protections.push({ name: "Database headroom", active: uAfter <= 1, detail: `Database utilization ${Math.round(uBefore * 100)}% → ${Number.isFinite(uAfter) ? Math.round(uAfter * 100) : "∞"}% without the cache.` });
  r.protections.push({ name: "Load shedding (rate limiter)", active: !!limiter && uAfter > 1, detail: limiter ? `${nm(limiter)} can reject excess requests instead of letting the database collapse.` : "No rate limiter or gateway limit to shed load." });
  r.protections.push({ name: "Circuit breaker with fallback", active: fb && uAfter > 1, detail: fb ? `Breaker falls back to ‘${str(brk as ArchNode, "fallback")}’.` : "No breaker with a fallback on the database." });
  if (uAfter > 1 && !limiter) r.missing.push("A rate limiter to shed load when the cache is gone");
  if (uAfter > 1 && !fb) r.missing.push("A circuit breaker with a fallback on the database");
  if (uAfter > 0.7) r.missing.push("More database capacity or read replicas");
  r.propagates = uAfter > 1;
  r.propagationNote = uAfter > 1 ? "The database becomes the bottleneck for all traffic: the cache failure cascades into a database overload." : "The database absorbs the extra reads.";
  if (db) r.nodeStates[db.id] = uAfter > 1 ? "failed" : uAfter > 0.7 ? "degraded" : "healthy";
  if (uAfter > 1) step(r, "failure", `Modelled database demand is ${Math.round(uAfter * 100)}% of capacity: ${total - okN} of ${total} requests cannot be served.`, db ? [db.id] : []);
  else step(r, "protection", `Database stays under capacity (${Math.round(uAfter * 100)}%): latency rises but requests are served.`, db ? [db.id] : []);
  classify(r);
  if (uAfter <= 0.7 && r.stats.failed === 0) r.outcome = "degraded";
  r.explanation = `Without the cache the database sees ${Math.round(after)} ops/s instead of ${Math.round(before)}. ${uAfter > 1 ? (limiter || fb ? "Excess load is shed deliberately." : "Nothing sheds load, so requests fail.") : "Capacity assumptions say it copes (an assumption, not a measurement)."}`;
  return r;
}

// 4/5/12 -------------------------------------------------------------
function externalFailure(a: Architecture, def: FailureDef, target: ArchNode | undefined, cap: CapacityInputs, mode: Mode, requests: number): FailureResult {
  if (!target) return notApplicable(def.id, a, def);
  const callers = syncCallers(a, target);
  if (callers.length === 0) return notApplicable(def.id, a, def, `${nm(target)} is not called by anything, so its failure cannot affect the system.`);
  const r = newResult(def.id, a, target.id);
  r.nodeStates[target.id] = "failed";
  const what = mode === "hang" ? "stops answering (calls hang)" : "returns HTTP 503 immediately";
  step(r, "trigger", `${nm(target)} ${what}${def.id === "dependency-unhealthy" ? " and stays unhealthy for the whole 60-request window" : ""}.`, [target.id]);
  let first = true;
  let anyBuffered = false;
  let totalAttempts = 0;
  for (const caller of callers) {
    const buffered = caller.kind === "worker" && incoming(a, caller.id, "async").length > 0;
    const sim = simulateCalls(a, caller, target, mode, requests, 0);
    const edgeIds = outgoing(a, caller.id, "sync").filter((c) => c.to === target.id).map((c) => c.id);
    totalAttempts += sim.attempts;
    if (buffered) {
      anyBuffered = true;
      const q = incoming(a, caller.id, "async").map((c) => byId(a, c.from)).find((x) => x?.kind === "queue");
      const jobs: CallSim["outcomes"] = sim.outcomes;
      const failedJobs = jobs.filter((o) => o === "failed" || o === "hung").length;
      r.stats.unit = "jobs";
      tally(jobs, r.stats);
      step(r, "request", `${nm(caller)} processes jobs from ${q ? nm(q) : "its queue"}; each job calls ${nm(target)}. Users who submitted jobs were already answered.`, [caller.id, ...(q ? [q.id] : [])], edgeIds);
      if (failedJobs > 0) {
        const durable = !!q && bool(q, "durable");
        const redeliver = !!q && num(q, "visibilityTimeoutSec") > 0;
        r.pending = { kind: "jobs", count: failedJobs, durable: durable && redeliver, mechanism: q ? `${q.name} (durable, visibility timeout)` : "queue" };
        step(r, "degrade", `${failedJobs} job(s) failed; ${durable && redeliver ? "they return to the queue and will be redelivered" : "the queue cannot redeliver them"} .`, [caller.id], []);
        if (!(durable && redeliver)) r.outcome = "data_risk";
      }
      for (const e of edgeIds) r.edgeStates[e] = failedJobs ? "failed" : "ok";
      r.nodeStates[caller.id] = failedJobs ? "degraded" : "healthy";
    } else {
      tally(sim.outcomes, r.stats);
      step(r, "request", `${nm(caller)} → ${nm(target)}: ${requests} requests simulated at 1 per second.`, [caller.id, target.id], edgeIds);
      r.nodeStates[caller.id] = sim.outcomes.some((o) => o === "failed" || o === "hung") ? "degraded" : "healthy";
      for (const e of edgeIds) r.edgeStates[e] = sim.outcomes.every((o) => o === "ok") ? "ok" : "failed";
    }
    r.stats.retries += sim.retries;
    r.stats.fastFailed += sim.fastFailed;
    if (first) {
      protectionsFor(a, caller, target, r, sim);
      first = false;
      if (sim.retries > 0) step(r, "retry", `${sim.retries} retries were sent (${sim.attempts} attempts for ${requests} requests).`, [caller.id, target.id], edgeIds);
      if (sim.breakerOpened) step(r, "protection", `Circuit breaker opened: ${sim.fastFailed} calls were rejected instantly${sim.breakerHalfOpenProbes ? `, with ${sim.breakerHalfOpenProbes} half-open probe(s) testing recovery` : ""}.`, [target.id], []);
      const timeout = effectiveTimeoutMs(a, caller, target);
      const lambda = caller.kind === "worker" ? cap.jobArrivalRate : cap.peakRps;
      const sat = saturation(lambda, mode === "hang" ? (timeout > 0 ? timeout : Infinity) : 20, slotsOf(caller, cap));
      if (mode === "hang") {
        r.propagates = sat.saturated;
        r.propagationNote = sat.saturated
          ? (timeout > 0
            ? `Each hung call is held for ${timeout} ms; at ${lambda} req/s that is ${Math.round(sat.held)} in flight against ${slotsOf(caller, cap)} slots — ${nm(caller)} saturates.`
            : `With no timeout, hung calls are never released: all ${slotsOf(caller, cap)} slots of ${nm(caller)} are pinned after ~${Math.max(1, Math.round(sat.secondsToExhaust))} s at ${lambda} req/s. Everything ${nm(caller)} serves stops, not just this feature.`)
          : `Held calls (${Math.round(sat.held)}) fit within ${slotsOf(caller, cap)} slots: contained.`;
        if (sat.saturated) { r.nodeStates[caller.id] = "failed"; step(r, "failure", r.propagationNote, [caller.id]); }
      } else {
        const retry = retryFor(a, target.id);
        const amp = sim.attempts / Math.max(1, requests - sim.fastFailed);
        r.stats.amplification = Math.round(amp * 10) / 10;
        r.propagates = false;
        r.propagationNote = retry && amp >= 3 && str(retry, "backoff") === "none"
          ? `Retries without backoff multiply the load on the failing dependency by ${r.stats.amplification}× — a retry storm.`
          : "Failures are returned quickly; no resource is held, so they do not spread upstream.";
        if (retry && amp >= 3 && str(retry, "backoff") === "none") r.propagates = true;
      }
      const hc = healthCheckFor(a, target.id);
      r.protections.push({ name: "Health check", active: !!hc, detail: hc ? `${nm(hc)} detects the unhealthy dependency (action: ${str(hc, "action")}).` : "No health check targets this dependency; nobody is told it is down." });
      if (!hc && def.id === "dependency-unhealthy") r.missing.push("A health check / alert for the dependency");
    }
  }
  if (anyBuffered && r.stats.failed === 0) r.outcome = r.outcome === "data_risk" ? "data_risk" : "handled";
  r.stats.amplification = r.stats.amplification || Math.round((totalAttempts / Math.max(1, requests)) * 10) / 10;
  classify(r);
  if (r.stats.total > 0) {
    r.explanation = `${r.stats.failed} of ${r.stats.total} ${r.stats.unit} failed, ${r.stats.degraded} were degraded by a fallback, ${r.stats.ok} succeeded. ${r.stats.fastFailed ? `${r.stats.fastFailed} were short-circuited by the breaker. ` : ""}${r.propagates ? "The failure propagates. " : ""}${anyBuffered ? "Work behind a queue is delayed, not lost, only if the queue redelivers. " : ""}`.trim();
  }
  return r;
}

// 6 ------------------------------------------------------------------
function consumerCrash(a: Architecture, def: FailureDef, target: ArchNode | undefined, cap: CapacityInputs): FailureResult {
  if (!target) return notApplicable(def.id, a, def);
  const queues = incoming(a, target.id, "async").map((c) => byId(a, c.from)).filter((x): x is ArchNode => !!x && x.kind === "queue");
  if (queues.length === 0) return notApplicable(def.id, a, def, `${nm(target)} does not consume from a queue, so there is no backlog or redelivery to observe.`);
  const q = queues[0];
  const r = newResult(def.id, a, target.id);
  const inst = Math.max(1, num(target, "instances", 1));
  const allWorkers = consumersOf(a, q.id).filter((w) => w.kind === "worker");
  const otherInstances = allWorkers.filter((w) => w.id !== target.id).reduce((s, w) => s + Math.max(1, num(w, "instances", 1)), 0);
  const remaining = inst - 1 + otherInstances;
  const rate = num(target, "processingRatePerSec", cap.workerRatePerSec);
  r.nodeStates[target.id] = "failed";
  step(r, "trigger", `One instance of ${nm(target)} crashes mid-job (${remaining} consumer instance(s) left).`, [target.id]);
  const sim = simulateQueue({ ...cap, workers: remaining, workerRatePerSec: rate, avgRps: 1, peakRps: 1, peakDurationSec: 0 });
  r.series = sim.series;
  const horizon = 300;
  const depthAt = (t: number): number => (sim.series.filter(([s]) => s <= t).pop() ?? [0, 0])[1];
  const backlog = Math.round(depthAt(horizon));
  const redelivered = num(q, "visibilityTimeoutSec") > 0;
  const durable = bool(q, "durable");
  const hcRestart = healthCheckFor(a, target.id);
  step(r, "request", `Arrivals continue at ${cap.jobArrivalRate} jobs/s; remaining capacity is ${(remaining * rate).toFixed(2)} jobs/s.`, [q.id, target.id], outgoing(a, q.id, "async").map((c) => c.id));
  for (const c of outgoing(a, q.id, "async")) if (c.to === target.id) r.edgeStates[c.id] = "failed";
  r.protections.push({ name: "Other consumers", active: remaining > 0, detail: remaining > 0 ? `${remaining} instance(s) keep draining the queue.` : "No consumer remains." });
  r.protections.push({ name: "Visibility timeout redelivery", active: redelivered, detail: redelivered ? `The in-flight job reappears after ${num(q, "visibilityTimeoutSec")} s and is redelivered.` : "No visibility timeout: the in-flight job is not redelivered." });
  r.protections.push({ name: "Durable queue", active: durable, detail: durable ? "Queued jobs survive broker restarts." : "Queue is not durable." });
  r.protections.push({ name: "Autoscaling / auto-restart", active: bool(target, "autoscale") || (!!hcRestart && str(hcRestart, "action") === "restart"), detail: bool(target, "autoscale") || hcRestart ? "Declared on the architecture, but this model does not simulate scale-up/restart delay: the numbers shown are the unassisted case." : "None declared." });
  if (!redelivered) { r.outcome = "data_risk"; r.missing.push("A visibility timeout so the in-flight job is redelivered"); step(r, "failure", "The job being processed is never redelivered: it is silently lost.", [q.id]); }
  if (!durable) r.missing.push("A durable queue");
  if (remaining === 0) { r.missing.push("A second worker instance or autoscaling"); r.stats.failed = 1; r.propagationNote = "Nothing consumes the queue: the backlog only grows until the worker is restored."; r.propagates = true; }
  else if (remaining * rate < cap.jobArrivalRate) { r.stats.degraded = 1; r.propagationNote = "Remaining workers are slower than arrivals: the backlog grows."; }
  else { r.stats.ok = 1; r.propagationNote = "Remaining workers keep up."; }
  r.stats.total = 1; r.stats.unit = "consumer pool";
  step(r, remaining === 0 ? "failure" : "degrade", `After ${horizon}s the backlog is about ${backlog} job(s).`, [q.id]);
  r.pending = { kind: "jobs", count: backlog + (redelivered ? 1 : 0), durable: durable && redelivered, mechanism: `${q.name}` };
  if (r.outcome !== "data_risk") classify(r);
  r.explanation = `${remaining === 0 ? "No consumer is left" : `${remaining} consumer(s) remain`}; backlog ≈ ${backlog} after ${horizon}s. ${redelivered ? "The in-flight job is redelivered." : "The in-flight job is lost."} ${durable ? "" : "The queue itself is not durable."}`.trim();
  return r;
}

// 7 ------------------------------------------------------------------
function backlogGrowth(a: Architecture, def: FailureDef, target: ArchNode | undefined, cap: CapacityInputs, p: FailureParams): FailureResult {
  if (!target) return notApplicable(def.id, a, def);
  const r = newResult(def.id, a, target.id);
  const mult = p.multiplier ?? 5;
  const cons = consumersOf(a, target.id).filter((w) => w.kind === "worker");
  const workers = cons.reduce((s, w) => s + Math.max(1, num(w, "instances", 1)), 0);
  const rate = cons.length ? cons.reduce((s, w) => s + num(w, "processingRatePerSec", cap.workerRatePerSec), 0) / cons.length : cap.workerRatePerSec;
  r.nodeStates[target.id] = "degraded";
  step(r, "trigger", `Jobs arrive at ${mult}× the usual rate (${(cap.jobArrivalRate * mult).toFixed(1)} jobs/s) for ${cap.peakDurationSec}s.`, [target.id]);
  const sim = simulateQueue({ ...cap, workers, workerRatePerSec: rate, avgRps: 1, peakRps: mult });
  r.series = sim.series;
  const maxDepthCfg = num(target, "maxDepth");
  const limiter = nodesOfKind(a, "rate_limiter")[0] ?? nodesOfKind(a, "api_gateway").find((g) => bool(g, "builtInRateLimit"));
  const growing = sim.arrivalPeak > sim.drainRate;
  step(r, "request", `Drain rate ${sim.drainRate.toFixed(2)} jobs/s vs peak arrival ${sim.arrivalPeak.toFixed(2)} jobs/s → backlog reaches ≈ ${Math.round(sim.depthAtPeakEnd)} jobs.`, [target.id, ...cons.map((w) => w.id)], outgoing(a, target.id, "async").map((c) => c.id));
  r.protections.push({ name: "Workers keep up", active: !growing, detail: growing ? "Workers are slower than peak arrivals." : "Worker capacity exceeds peak arrivals." });
  r.protections.push({ name: "Bounded queue (backpressure)", active: maxDepthCfg > 0, detail: maxDepthCfg > 0 ? `Queue holds at most ${maxDepthCfg} jobs; excess producers are rejected.` : "Queue depth is unbounded: memory/storage grows with the backlog." });
  r.protections.push({ name: "Upstream rate limit", active: !!limiter, detail: limiter ? `${nm(limiter)} caps submissions upstream.` : "No upstream limiter caps submissions." });
  r.protections.push({ name: "Worker autoscaling", active: cons.some((w) => bool(w, "autoscale")), detail: cons.some((w) => bool(w, "autoscale")) ? "Declared but not simulated; shown numbers are the unscaled case." : "Not declared." });
  const total = 20;
  r.stats.total = total; r.stats.unit = "job-seconds sampled";
  if (!growing) { r.stats.ok = total; }
  else if (maxDepthCfg > 0 && sim.maxDepth > maxDepthCfg) { const shed = Math.round(total * (1 - maxDepthCfg / sim.maxDepth)); r.stats.degraded = Math.max(1, shed); r.stats.ok = total - r.stats.degraded; step(r, "degrade", `The bounded queue rejects roughly ${pct(r.stats.degraded, total)} of submissions at the peak.`, [target.id]); }
  else if (sim.secondsToDrainAfterPeak === null) { r.stats.failed = total; step(r, "failure", "Workers never catch up: the backlog grows without end.", [target.id]); }
  else { r.stats.slow = total; r.stats.ok = total; step(r, "degrade", `Jobs wait; the backlog clears about ${Math.round(sim.secondsToDrainAfterPeak)}s after the peak ends.`, [target.id]); }
  if (growing) r.missing.push("More worker capacity, autoscaling or an upstream rate limit");
  if (growing && maxDepthCfg === 0) r.missing.push("A bounded queue (backpressure) so the backlog cannot grow without limit");
  r.propagates = growing && maxDepthCfg === 0 && sim.secondsToDrainAfterPeak === null;
  r.propagationNote = growing ? "Latency of every queued job grows; users waiting on job results see delays." : "No backlog forms.";
  r.pending = { kind: "jobs", count: Math.round(sim.depthAtPeakEnd), durable: bool(target, "durable"), mechanism: target.name };
  classify(r);
  r.explanation = growing ? `Peak backlog ≈ ${Math.round(sim.maxDepth)} jobs. ${sim.secondsToDrainAfterPeak === null ? "At the current worker rate it never drains." : `It drains about ${Math.round(sim.secondsToDrainAfterPeak)}s after the peak.`}` : "Workers out-pace the burst, so no backlog forms (per the capacity assumptions).";
  return r;
}

// 8 ------------------------------------------------------------------
function poisonJob(a: Architecture, def: FailureDef, target: ArchNode | undefined): FailureResult {
  if (!target) return notApplicable(def.id, a, def);
  const consumers = consumersOf(a, target.id);
  if (consumers.length === 0) return notApplicable(def.id, a, def, `${nm(target)} has no consumer, so no job is ever attempted.`);
  const r = newResult(def.id, a, target.id);
  const R = num(target, "retryLimit");
  const dlqs = dlqsOf(a, target.id);
  const declared = str(target, "deadLetterPolicy") === "dlq";
  const dlq = dlqs[0];
  const works = !!dlq && declared;
  const workers = consumers.reduce((s, w) => s + Math.max(1, num(w, "instances", 1)), 0);
  r.stats.total = 1; r.stats.unit = "poison job";
  r.nodeStates[target.id] = "degraded";
  step(r, "trigger", `One message on ${nm(target)} can never be processed successfully.`, [target.id]);
  const edges = outgoing(a, target.id, "async").map((c) => c.id);
  if (R === 0) {
    step(r, "failure", `Delivery attempts are unlimited: the job is redelivered forever, occupying ${Math.min(1, 1 / workers) * 100 >= 100 ? "the only worker" : `1 of ${workers} worker slot(s)`} each time.`, [target.id, ...consumers.map((c) => c.id)], edges);
    r.stats.failed = 1;
    r.propagates = workers === 1;
    r.propagationNote = workers === 1 ? "With one worker the poison job blocks all other work." : "It wastes capacity on a loop but other workers continue.";
    r.missing.push("A finite delivery-attempt limit", "A DLQ to park the poison message");
    for (const c of consumers) r.nodeStates[c.id] = workers === 1 ? "failed" : "degraded";
    r.pending = { kind: "none", count: 0, durable: false, mechanism: "" };
  } else {
    step(r, "retry", `The job is attempted ${R} time(s), then the queue stops redelivering it.`, [target.id], edges);
    r.stats.retries = R - 1;
    if (works) {
      step(r, "protection", `After attempt ${R} the message moves to ${nm(dlq)}; healthy work continues.`, [dlq.id], outgoing(a, target.id, "async").filter((c) => c.to === dlq.id).map((c) => c.id));
      r.stats.ok = 1; r.nodeStates[dlq.id] = "recovered";
      r.pending = { kind: "jobs", count: 1, durable: true, mechanism: dlq.name };
      if (!bool(dlq, "alerting")) { r.stats.ok = 0; r.stats.degraded = 1; step(r, "degrade", `${nm(dlq)} has no alerting: the parked message sits unnoticed.`, [dlq.id]); r.missing.push("Alerting on the DLQ"); }
      r.propagationNote = "Contained: the poison job leaves the main queue.";
    } else {
      step(r, "failure", declared && !dlq ? "The queue declares a DLQ policy but no DLQ is connected: the message has nowhere to go and is dropped." : `After ${R} attempts the message is discarded — there is no DLQ, so no trace remains.`, [target.id]);
      r.outcome = "data_risk";
      r.missing.push("A connected Dead Letter Queue and dead-letter policy");
    }
  }
  r.protections.push({ name: "Bounded delivery attempts", active: R > 0, detail: R > 0 ? `${R} attempts.` : "Unlimited." });
  r.protections.push({ name: "Dead Letter Queue wired", active: works, detail: works ? `${nm(dlq)} receives the message.` : dlq ? "DLQ connected but dead-letter policy is ‘none’." : "No DLQ connected." });
  r.protections.push({ name: "DLQ alerting", active: !!dlq && bool(dlq, "alerting"), detail: dlq ? (bool(dlq, "alerting") ? "Operators are alerted." : "No alert configured.") : "n/a" });
  classify(r);
  r.explanation = R === 0 ? "Unlimited redelivery turns one bad message into a permanent loop." : works ? `The message is parked after ${R} attempts${bool(dlq as ArchNode, "alerting") ? " and operators are alerted" : " but nobody is told"}.` : "Without a wired DLQ the failing message is discarded silently.";
  return r;
}

// 9 ------------------------------------------------------------------
function duplicatePayment(a: Architecture, def: FailureDef, target: ArchNode | undefined, p: FailureParams): FailureResult {
  if (!target) return notApplicable(def.id, a, def, "No component is payment-like (flagged ‘Performs charge / billing-like operations’ or named like checkout/payment/billing). Flag the service that charges, or pick a target manually. Not being applicable is not the same as being protected.");
  const r = newResult(def.id, a, target.id);
  const copies = Math.max(2, Math.floor(p.copies ?? 2));
  const store = outgoing(a, target.id, "data").map((c) => byId(a, c.to)).find((n) => n?.kind === "idempotency_store");
  const atomic = !!store && bool(store, "atomicClaim");
  const replay = !!store && bool(store, "storesResult");
  r.stats.total = copies; r.stats.unit = "identical requests";
  step(r, "trigger", `${copies} identical charge requests reach ${nm(target)} at the same time (e.g. a double-click or client retry).`, [target.id], requestPath(a, target.id)?.edgeIds ?? []);
  if (store && atomic) {
    r.stats.duplicatesExecuted = 0; r.stats.duplicatesPrevented = copies - 1; r.stats.ok = copies;
    step(r, "protection", `The first request atomically claims its key in ${nm(store)}; the other ${copies - 1} find it claimed${replay ? " and receive the stored result" : " and are rejected"}.`, [store.id], outgoing(a, target.id, "data").filter((c) => c.to === store.id).map((c) => c.id));
    r.outcome = "handled";
    r.explanation = `1 charge executed, ${copies - 1} duplicate(s) prevented.`;
  } else if (store) {
    r.stats.duplicatesExecuted = copies - 1; r.stats.failed = copies - 1; r.stats.ok = 1;
    step(r, "failure", `${nm(store)} does not claim keys atomically: all ${copies} requests pass the check before any records its key, so ${copies} charges execute.`, [store.id]);
    r.outcome = "data_risk"; r.missing.push("Atomic claim on the idempotency store (set-if-absent)");
    r.explanation = `A check-then-write idempotency store races under concurrency: ${copies} charges executed.`;
  } else {
    r.stats.duplicatesExecuted = copies - 1; r.stats.failed = copies - 1; r.stats.ok = 1;
    step(r, "failure", `${nm(target)} has no idempotency protection: every one of the ${copies} requests executes the charge.`, [target.id]);
    r.outcome = "data_risk"; r.missing.push("An Idempotency Store connected to this service");
    r.explanation = `No idempotency store: ${copies} charges executed instead of 1. (This is simulated; no real payment occurs.)`;
  }
  r.protections.push({ name: "Idempotency store connected", active: !!store, detail: store ? `${nm(store)}` : "None connected by data access." });
  r.protections.push({ name: "Atomic claim", active: atomic, detail: atomic ? "Concurrent duplicates cannot both pass." : "Not guaranteed." });
  r.protections.push({ name: "Stored result replay", active: !!store && replay, detail: replay ? "Duplicates get the original response." : "Duplicates cannot be answered with the original result." });
  r.nodeStates[target.id] = r.outcome === "handled" ? "healthy" : "failed";
  r.propagationNote = r.outcome === "handled" ? "Contained." : "The duplicate side effect is already committed downstream.";
  r.propagates = r.outcome !== "handled";
  return r;
}

// 10 -----------------------------------------------------------------
function cronMulti(a: Architecture, def: FailureDef, target: ArchNode | undefined): FailureResult {
  if (!target) return notApplicable(def.id, a, def);
  const r = newResult(def.id, a, target.id);
  const n = Math.max(1, num(target, "instances", 1));
  const prot = cronProtectionEffective(a, target);
  const execs = prot.effective ? 1 : n;
  r.stats.total = n; r.stats.unit = "scheduler instances";
  r.stats.duplicatesExecuted = execs - 1; r.stats.duplicatesPrevented = prot.effective ? n - 1 : 0;
  r.stats.ok = prot.effective ? n : 1; r.stats.failed = execs - 1;
  step(r, "trigger", `The schedule “${str(target, "schedule")}” fires on all ${n} instance(s) of ${nm(target)}.`, [target.id], outgoing(a, target.id).map((c) => c.id));
  if (prot.effective) step(r, "protection", `${prot.reason} Exactly one instance runs the job; ${n - 1} skip.`, [target.id]);
  else if (n > 1) step(r, "failure", `${prot.reason} All ${n} instances run the job: the work is executed ${n} times.`, [target.id]);
  else step(r, "note", `${prot.reason} With a single instance only one run happens now, but a restart or overlapping deploy can still double-run it.`, [target.id]);
  r.protections.push({ name: "Duplicate-run protection", active: prot.effective, detail: prot.reason });
  if (!prot.effective) r.missing.push("A lock / lease / idempotent job backed by a shared store");
  r.outcome = execs > 1 ? "data_risk" : "handled";
  r.nodeStates[target.id] = execs > 1 ? "failed" : "healthy";
  r.propagates = execs > 1;
  r.propagationNote = execs > 1 ? "Downstream services receive the work multiple times." : "Contained.";
  for (const c of outgoing(a, target.id)) r.edgeStates[c.id] = execs > 1 ? "failed" : "ok";
  r.explanation = execs > 1 ? `${execs} executions instead of 1.` : `1 execution${n > 1 ? " (protection works)" : " (single instance)"}.`;
  return r;
}

// 11 -----------------------------------------------------------------
function subscriberDown(a: Architecture, def: FailureDef, target: ArchNode | undefined, cap: CapacityInputs): FailureResult {
  if (!target) return notApplicable(def.id, a, def, "No service subscribes to a topic or event bus, so there is no subscriber to take down.");
  const topics = incoming(a, target.id, "event").map((c) => byId(a, c.from)).filter((x): x is ArchNode => !!x);
  const r = newResult(def.id, a, target.id);
  const t = topics[0];
  const retention = num(t, "retentionHours");
  const outageSec = 60;
  const events = Math.round(cap.jobArrivalRate * outageSec);
  const others = subscribersOf(a, t.id).filter((s) => s.id !== target.id);
  const pubs = publishersOf(a, t.id);
  const coupled = pubs.filter((pb) => outgoing(a, pb.id, "sync").some((c) => c.to === target.id));
  r.nodeStates[target.id] = "failed";
  step(r, "trigger", `Subscriber ${nm(target)} is down for ${outageSec}s while ${nm(t)} keeps receiving ~${cap.jobArrivalRate} events/s.`, [target.id, t.id]);
  for (const c of outgoing(a, t.id, "event").filter((c) => c.to === target.id)) r.edgeStates[c.id] = "failed";
  step(r, "request", `Publishers (${pubs.map(nm).join(", ") || "none"}) keep publishing: publishing is asynchronous, so they are not blocked.`, pubs.map((x) => x.id), incoming(a, t.id, "event").map((c) => c.id));
  r.stats.total = events; r.stats.unit = "events";
  if (retention > 0) {
    r.stats.degraded = events; step(r, "degrade", `${nm(t)} retains events for ${retention}h: ${events} event(s) wait and are replayed when ${nm(target)} returns.`, [t.id]);
    r.pending = { kind: "events", count: events, durable: true, mechanism: `${t.name} retention` };
  } else {
    r.stats.failed = events; step(r, "failure", `${nm(t)} retains nothing (retention 0): the ${events} event(s) delivered during the outage are lost for this subscriber.`, [t.id]);
    r.outcome = "data_risk"; r.missing.push("Event retention / durable subscription on the topic");
    r.pending = { kind: "events", count: events, durable: false, mechanism: "" };
  }
  r.protections.push({ name: "Event retention", active: retention > 0, detail: retention > 0 ? `${retention}h retention allows replay.` : "No retention." });
  r.protections.push({ name: "Publisher isolation", active: coupled.length === 0, detail: coupled.length === 0 ? "Publishers only publish; they never call the subscriber directly." : `${coupled.map(nm).join(", ")} also call ${nm(target)} synchronously and will be blocked.` });
  r.protections.push({ name: "Other subscribers unaffected", active: others.length > 0, detail: others.length ? `${others.map(nm).join(", ")} keep receiving events.` : "This was the only subscriber." });
  if (coupled.length) { r.propagates = true; for (const c of coupled) r.nodeStates[c.id] = "degraded"; r.missing.push("Remove the direct synchronous call to the subscriber"); }
  r.propagationNote = coupled.length ? "A direct synchronous call couples the publisher to the failed subscriber." : "Contained to this subscriber.";
  if (r.outcome !== "data_risk") classify(r);
  r.explanation = retention > 0 ? "The outage delays this subscriber's work; nothing is lost because the topic retains events." : "Events published during the outage are lost for this subscriber.";
  return r;
}

// ------------------------------------------------------------- aggregate

export function runAllFailures(a: Architecture, capIn: CapacityInputs = DEFAULT_CAPACITY): FailureResult[] {
  return FAILURES.map((f) => runFailure(a, f.id, {}, capIn));
}

export const SURVIVED: Outcome[] = ["handled", "degraded"];

export function summarizeFailures(results: FailureResult[]): { survived: FailureId[]; notHandled: FailureId[]; notApplicable: FailureId[] } {
  return {
    survived: results.filter((r) => r.applicable && SURVIVED.includes(r.outcome)).map((r) => r.failureId),
    notHandled: results.filter((r) => r.applicable && !SURVIVED.includes(r.outcome)).map((r) => r.failureId),
    notApplicable: results.filter((r) => !r.applicable).map((r) => r.failureId),
  };
}

// ------------------------------------------------------------- recovery

export interface RecoveryResult {
  restored: boolean;
  nodeStates: Record<string, SysState>;
  steps: TraceStep[];
  recovered: number;
  lost: number;
  remaining: number;
  note: string;
}

/** Restore the failed component. Sync requests that already failed are NOT replayed. */
export function restoreComponent(a: Architecture, res: FailureResult): RecoveryResult {
  const nodeStates: Record<string, SysState> = {};
  for (const n of a.nodes) nodeStates[n.id] = "healthy";
  if (!res.applicable || !res.targetId) return { restored: false, nodeStates, steps: [], recovered: 0, lost: 0, remaining: 0, note: "Nothing to restore: the failure did not apply." };
  nodeStates[res.targetId] = "recovered";
  const sync = res.stats.failed > 0 && res.pending.kind === "none";
  return {
    restored: true, nodeStates,
    steps: [{ kind: "protection", text: `Restored ${nm(byId(a, res.targetId) as ArchNode)}. New requests succeed again.`, nodeIds: [res.targetId], edgeIds: [] }],
    recovered: 0, lost: 0, remaining: res.pending.count,
    note: sync ? "Requests that failed while it was down are gone: this architecture keeps no durable record of them to replay." : res.pending.count > 0 ? "Pending work is waiting. Use ‘Recover queued work’." : "Back to normal; nothing was pending.",
  };
}

/** Recover queued jobs/events — only possible when a durable mechanism exists AND the component was restored. */
export function recoverPending(res: FailureResult, restored: boolean): RecoveryResult {
  const base: RecoveryResult = { restored, nodeStates: {}, steps: [], recovered: 0, lost: 0, remaining: res.pending.count, note: "" };
  if (!restored) return { ...base, note: "Restore the failed component first; pending work cannot drain into something that is still down." };
  if (res.pending.count === 0 || res.pending.kind === "none") return { ...base, remaining: 0, note: "No queued work exists to recover. Synchronous requests that failed are not replayed — the architecture has no queue, topic retention or DLQ holding them." };
  if (!res.pending.durable) return { ...base, lost: res.pending.count, remaining: 0, note: `${res.pending.count} ${res.pending.kind} cannot be recovered: ${res.failureId === "poison-job" ? "" : "the queue/topic is not durable or does not redeliver."}`.trim() };
  if (res.failureId === "poison-job") return { ...base, remaining: res.pending.count, note: "Redriving the message from the DLQ: it fails again and returns to the DLQ, because the cause (a bad payload or handler bug) has not been fixed. Fix the handler first, then redrive." };
  return { ...base, recovered: res.pending.count, remaining: 0, note: `${res.pending.count} ${res.pending.kind} recovered via ${res.pending.mechanism}.` };
}

// ------------------------------------------------------------- comparison

export interface FailureComparisonRow {
  failureId: FailureId;
  name: string;
  before: Outcome;
  after: Outcome;
  changed: boolean;
}

export function compareFailureRuns(before: Architecture, after: Architecture, capIn: CapacityInputs = DEFAULT_CAPACITY): FailureComparisonRow[] {
  return FAILURES.map((f) => {
    const b = runFailure(before, f.id, {}, capIn).outcome;
    const x = runFailure(after, f.id, {}, capIn).outcome;
    return { failureId: f.id, name: f.name, before: b, after: x, changed: b !== x };
  });
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  handled: "Handled", degraded: "Degraded but served", failed: "User-visible failure", data_risk: "Data at risk", not_applicable: "Not applicable",
};
