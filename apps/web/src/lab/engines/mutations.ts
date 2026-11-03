/**
 * Task 07 — Architecture Mutation Engine.
 *
 * Controlled, explainable transformations of the canonical model. Every
 * operator: checks preconditions, refuses invalid states, returns a NEW model
 * (the original is never mutated), and explains the problem addressed, the
 * structural change, the expected benefit, and the new trade-offs.
 */

import {
  type ArchitectureModel, type Component, cloneModel, validateModel, newId,
} from "../model";

export interface MutationExplanation {
  operator: string;
  problem: string;
  structuralChange: string;
  expectedBenefit: string;
  tradeoffs: string[];
}

export interface MutationResult {
  model: ArchitectureModel;
  explanation: MutationExplanation;
  /** non-fatal caveats discovered while applying the mutation */
  warnings: string[];
}

export class MutationPreconditionError extends Error {}

function must(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new MutationPreconditionError(msg);
}

function findComponent(m: ArchitectureModel, id: string): Component {
  const c = m.components.find((x) => x.id === id);
  must(!!c, `unknown component ${id}`);
  return c as Component;
}

/**
 * Insert a durable queue between a service and a slow/blocking dependency.
 * Preconditions: a sync service->worker/service connection must exist and no
 * queue may already sit on that path.
 */
export function addQueueBetween(m0: ArchitectureModel, connectionId: string): MutationResult {
  const m = cloneModel(m0);
  const cn = m.connections.find((c) => c.id === connectionId);
  must(!!cn, `unknown connection ${connectionId}`);
  must(cn.kind === "sync", "addQueueBetween requires a synchronous connection");
  const target = findComponent(m, cn.to);
  must(target.kind === "worker" || target.kind === "service",
    `a queue can buffer work toward workers/services, not ${target.kind}`);
  must(!m.components.some((c) => c.kind === "queue" && m.connections.some(
    (x) => x.from === cn.from && x.to === c.id)), "a queue already exists on this path");

  const queue: Component = {
    id: newId("queue"), kind: "queue", name: `${target.name} work queue`,
    purpose: `Buffers work from ${cn.from} to ${target.name} so the caller is not blocked`,
    config: { capacity: 10000 }, requirementIds: [...cn.requirementIds],
  };
  m.components.push(queue);
  cn.kind = "async";
  cn.failureBehavior = "degrades";
  m.connections.push({
    id: newId("cn"), from: queue.id, to: target.id, kind: "async",
    criticality: cn.criticality, failureBehavior: "isolated",
    dataDirection: cn.dataDirection, latencyMs: 5,
    operationIds: [...cn.operationIds], requirementIds: [...cn.requirementIds],
  });
  return {
    model: m,
    warnings: validateModel(m).map((e) => `${e.path}: ${e.message}`),
    explanation: {
      operator: "addQueueBetween",
      problem: `${cn.from} is blocked by ${target.name} for the whole work duration, coupling caller latency and availability to a slow dependency.`,
      structuralChange: `Inserted queue "${queue.name}" between ${cn.from} and ${target.id}; the original edge is now asynchronous and the queue->worker edge is failure-isolated.`,
      expectedBenefit: "Caller latency no longer includes processing time; worker outages buffer in the queue instead of failing requests.",
      tradeoffs: [
        "Completion becomes eventual — anything requiring the result synchronously needs a different mechanism (polling, status writes).",
        "The queue is a new stateful component: it needs capacity limits, monitoring of queue depth, and a poison-message story.",
      ],
    },
  };
}

/**
 * Insert a read-through cache between a reader and a database.
 * Preconditions: sync reader->database connection, no existing cache on that path.
 */
export function addCache(m0: ArchitectureModel, connectionId: string, ttlSeconds = 30): MutationResult {
  const m = cloneModel(m0);
  const cn = m.connections.find((c) => c.id === connectionId);
  must(!!cn, `unknown connection ${connectionId}`);
  must(cn.kind === "sync", "addCache requires a synchronous connection");
  const target = findComponent(m, cn.to);
  must(target.kind === "database", `a cache belongs in front of a database, not ${target.kind}`);
  must(!m.components.some((c) => c.kind === "cache" &&
    m.connections.some((x) => x.from === cn.from && x.to === c.id) &&
    m.connections.some((x) => x.from === c.id && x.to === target.id)),
    "a cache already fronts this database for this caller");

  const cache: Component = {
    id: newId("cache"), kind: "cache", name: `${target.name} cache`,
    purpose: `Read-through cache for ${target.name} hot reads`,
    config: { ttlSeconds, capacityMB: 512 }, requirementIds: [...cn.requirementIds],
  };
  m.components.push(cache);
  cn.to = cache.id;
  cn.failureBehavior = "degrades";
  m.connections.push({
    id: newId("cn"), from: cache.id, to: target.id, kind: "sync",
    criticality: cn.criticality, failureBehavior: "degrades",
    dataDirection: "cache misses", latencyMs: cn.latencyMs,
    operationIds: [...cn.operationIds], requirementIds: [...cn.requirementIds],
  });
  return {
    model: m,
    warnings: validateModel(m).map((e) => `${e.path}: ${e.message}`),
    explanation: {
      operator: "addCache",
      problem: `${cn.from} queries ${target.name} directly, so hot reads consume database capacity and add database latency.`,
      structuralChange: `Inserted cache "${cache.name}" (TTL ${ttlSeconds}s) between ${cn.from} and ${target.id}; cache misses fall through to the database.`,
      expectedBenefit: "Hot reads are served in single-digit milliseconds and database load drops with hit rate.",
      tradeoffs: [
        `Reads may be up to TTL (${ttlSeconds}s) stale — check consistency requirements before adopting.`,
        "The cache is shared state: invalidation, eviction, and stampede protection become design concerns.",
      ],
    },
  };
}

/** Convert a synchronous edge to asynchronous (fire-and-forget / ack-after-enqueue). */
export function makeAsync(m0: ArchitectureModel, connectionId: string): MutationResult {
  const m = cloneModel(m0);
  const cn = m.connections.find((c) => c.id === connectionId);
  must(!!cn, `unknown connection ${connectionId}`);
  must(cn.kind === "sync", "connection is already asynchronous");
  const target = findComponent(m, cn.to);
  must(target.kind !== "gateway" && target.kind !== "client", "cannot make a client-facing edge asynchronous");

  cn.kind = "async";
  cn.failureBehavior = "degrades";
  return {
    model: m,
    warnings: validateModel(m).map((e) => `${e.path}: ${e.message}`),
    explanation: {
      operator: "makeAsync",
      problem: `${cn.from} waits synchronously for ${target.name}, so its latency and availability are coupled.`,
      structuralChange: `Edge ${cn.id} (${cn.from} -> ${target.id}) became asynchronous with degraded failure behavior.`,
      expectedBenefit: `${cn.from} no longer blocks on ${target.name}; latency and outages of the dependency stop propagating synchronously.`,
      tradeoffs: [
        "Results/completions are no longer available in the same request — the operation needs a status model or events.",
        "Failures surface later; without idempotency or a retry/DLQ policy, work can be lost or duplicated.",
      ],
    },
  };
}

/** Make a mutating service idempotent. */
export function addIdempotency(m0: ArchitectureModel, componentId: string): MutationResult {
  const m = cloneModel(m0);
  const c = findComponent(m, componentId);
  must(c.kind === "service" || c.kind === "worker", "idempotency applies to services/workers");
  must(c.config.idempotent !== true, "component is already idempotent");
  c.config.idempotent = true;
  return {
    model: m,
    warnings: [],
    explanation: {
      operator: "addIdempotency",
      problem: `${c.name} can apply the same side effect twice when callers retry.`,
      structuralChange: `Set config.idempotent=true on ${c.id}; operation identity binds requests to stored results.`,
      expectedBenefit: "Duplicate requests (retries, double clicks, redeliveries) produce one side effect.",
      tradeoffs: [
        "Idempotency keys need a lifecycle: storage, expiration, and a policy for key reuse.",
        "Conflicting payloads with the same key must be rejected, which adds validation work.",
      ],
    },
  };
}

/** Add or change a retry strategy on a component calling dependencies. */
export function addRetryPolicy(m0: ArchitectureModel, componentId: string, retryMax: number, policy: "none" | "backoff" = "backoff"): MutationResult {
  const m = cloneModel(m0);
  const c = findComponent(m, componentId);
  must(retryMax >= 0 && retryMax <= 10, "retryMax must be 0..10");
  const prev = Number(c.config.retryMax ?? 0);
  must(prev !== retryMax || c.config.retryPolicy !== policy, "policy already configured");
  c.config.retryMax = retryMax;
  c.config.retryPolicy = policy;
  return {
    model: m,
    warnings: [],
    explanation: {
      operator: "addRetryPolicy",
      problem: `${c.name} fails on the first transient error from its dependencies.`,
      structuralChange: `Set retryMax=${retryMax}, retryPolicy=${policy} on ${c.id}.`,
      expectedBenefit: "Transient faults are masked; availability improves for short dependency hiccups.",
      tradeoffs: [
        `Each retry multiplies load on the failing dependency (up to ${1 + retryMax}x) — retry storms are a real failure mode.`,
        "Without idempotency, retries can duplicate side effects.",
        retryMax > 0 && policy === "none"
          ? "Retries without backoff concentrate load immediately after a failure."
          : "Backoff spreads retry load over time.",
      ],
    },
  };
}

/**
 * Split a service into two services that share its upstream callers, dividing
 * its outgoing dependencies. Preconditions: service with > 2 outgoing edges.
 */
export function splitService(m0: ArchitectureModel, componentId: string): MutationResult {
  const m = cloneModel(m0);
  const c = findComponent(m, componentId);
  must(c.kind === "service", "splitService applies to services");
  const out = m.connections.filter((cn) => cn.from === componentId);
  must(out.length > 2, `splitService requires more than 2 outgoing dependencies (found ${out.length})`);

  const half: Component = {
    ...c, id: newId("svc"), name: `${c.name} (B)`,
    purpose: `Split from ${c.id} to isolate ${out.slice(Math.ceil(out.length / 2)).map((cn) => cn.to).join(", ")}`,
    config: { ...c.config }, requirementIds: [...c.requirementIds],
  };
  m.components.push(half);
  const moved = out.slice(Math.ceil(out.length / 2));
  moved.forEach((cn) => { cn.from = half.id; });
  m.connections.forEach((cn) => {
    if (cn.to === componentId && cn.kind === "sync") {
      m.connections.push({ ...cn, id: newId("cn"), to: half.id });
    }
  });
  return {
    model: m,
    warnings: validateModel(m).map((e) => `${e.path}: ${e.message}`),
    explanation: {
      operator: "splitService",
      problem: `${c.name} owns ${out.length} dependencies; every dependency failure and every deployment affects all of them.`,
      structuralChange: `Created "${half.name}" owning ${moved.map((cn) => cn.to).join(", ")}; upstream callers now reach both services.`,
      expectedBenefit: "Dependency failures and deploys of one half no longer affect the other half's dependencies.",
      tradeoffs: [
        "Two deployables instead of one: more operational surface, duplicated auth/telemetry setup.",
        "Shared upstream callers now make two calls unless a router is introduced (another component).",
      ],
    },
  };
}

/**
 * Task 07.5 — regression proof helper: a mutation must preserve unrelated
 * requirements and must not silently remove existing protections.
 */
export function mutationRegressions(before: ArchitectureModel, after: ArchitectureModel): string[] {
  const problems: string[] = [];
  before.components.forEach((b) => {
    const a = after.components.find((c) => c.id === b.id);
    if (a) {
      if (a.requirementIds.length !== b.requirementIds.length && !before.connections.some((cn) => cn.from === b.id || cn.to === b.id)) {
        problems.push(`${b.id}: requirement mapping changed without connection involvement`);
      }
      for (const key of ["idempotent", "retryMax", "retryPolicy"] as const) {
        if (b.config[key] !== undefined && a.config[key] !== b.config[key]) {
          problems.push(`${b.id}: protection "${key}" was removed or changed by the mutation`);
        }
      }
    }
  });
  before.requirements.forEach((r) => {
    if (!after.requirements.some((x) => x.id === r.id)) {
      problems.push(`requirement ${r.id} disappeared`);
    }
  });
  return problems;
}
