/**
 * Task 12 — End-to-End Latency Budget Composer.
 *
 * Aggregates modeled per-hop latency along an operation's synchronous paths
 * (sequential and parallel), applies retry overhead in the worst case, and
 * identifies which component consumes the largest portion of the deadline.
 * All numbers come from declared model assumptions (connection.latencyMs and
 * latencyBudget allocations), never from measurements.
 */

import type { ArchitectureModel } from "../model";

export interface PathLatency {
  /** component ids along one synchronous path of the operation */
  nodes: string[];
  /** per-hop entries: component processing allocation + connection latency */
  hops: { from: string; to: string; connMs: number; procMs: number; retriesWorstCaseMs: number }[];
  modeledMs: number;
  parallelWith?: string[];
}

export interface LatencyAnalysis {
  operationId: string;
  deadlineMs: number | null;
  paths: PathLatency[];
  criticalPath: PathLatency | null;
  /** synchronous completion latency of the slowest path */
  modeledMs: number;
  remainingMs: number | null;
  missesDeadline: boolean | null;
  largestConsumer: { componentId: string; ms: number; share: number } | null;
  /** async hops inside the operation are excluded from the sync deadline */
  asyncHops: string[];
  assumptions: string[];
}

export function analyzeLatency(m: ArchitectureModel, operationId: string): LatencyAnalysis {
  const opConns = m.connections.filter((cn) => cn.operationIds.includes(operationId));
  const asyncHops = opConns.filter((cn) => cn.kind !== "sync").map((cn) => `${cn.from} -> ${cn.to}`);
  const budget = m.latencyBudget ?? null;
  const alloc = (id: string): number => budget?.allocations[id] ?? 0;

  // enumerate maximal synchronous paths starting at client components
  const starts = m.components.filter((c) =>
    c.kind === "client" && opConns.some((cn) => cn.from === c.id && cn.kind === "sync"));
  const paths: PathLatency[] = [];

  const walk = (node: string, nodes: string[], hops: PathLatency["hops"], total: number, seen: Set<string>): void => {
    const nexts = opConns.filter((cn) => cn.from === node && cn.kind === "sync" && !seen.has(cn.to));
    if (nexts.length === 0) {
      if (hops.length > 0) paths.push({ nodes: [...nodes], hops, modeledMs: Math.round(total) });
      return;
    }
    nexts.forEach((cn) => {
      const retryMax = Number(m.components.find((c) => c.id === node)?.config.retryMax ?? 0);
      const connMs = cn.latencyMs ?? 0;
      const procMs = alloc(cn.to);
      // worst case: the hop is retrried up to retryMax times
      const retriesWorstCaseMs = retryMax * (connMs + procMs);
      walk(cn.to, [...nodes, cn.to], [...hops, { from: node, to: cn.to, connMs, procMs, retriesWorstCaseMs }],
        total + connMs + procMs, new Set([...seen, cn.to]));
    });
  };

  starts.forEach((s) => walk(s.id, [s.id], [], alloc(s.id), new Set([s.id])));

  // mark paths that forked from the same node as parallel
  paths.forEach((p) => {
    const fork = p.nodes.find((n, idx) =>
      idx > 0 && paths.some((q) => q !== p && q.nodes[idx - 1] === p.nodes[idx - 1] && q.nodes[idx] !== n));
    if (fork) {
      p.parallelWith = paths.filter((q) => q !== p && q.nodes.includes(fork)).map((q) => q.nodes.join("->"));
    }
  });

  const criticalPath = paths.length > 0
    ? paths.reduce((a, b) => (b.modeledMs > a.modeledMs ? b : a))
    : null;
  const modeledMs = criticalPath?.modeledMs ?? 0;
  const deadlineMs = budget?.deadlineMs ?? null;
  const remainingMs = deadlineMs === null ? null : deadlineMs - modeledMs;

  // largest consumer: attribution of conn+proc per hop to the target component
  const consumer = new Map<string, number>();
  criticalPath?.hops.forEach((h) => {
    consumer.set(h.to, (consumer.get(h.to) ?? 0) + h.connMs + h.procMs);
  });
  let largestConsumer: LatencyAnalysis["largestConsumer"] = null;
  consumer.forEach((ms, componentId) => {
    if (!largestConsumer || ms > largestConsumer.ms) {
      largestConsumer = { componentId, ms, share: modeledMs === 0 ? 0 : ms / modeledMs };
    }
  });

  return {
    operationId,
    deadlineMs,
    paths,
    criticalPath,
    modeledMs,
    remainingMs,
    missesDeadline: deadlineMs === null ? null : modeledMs > deadlineMs,
    largestConsumer,
    asyncHops,
    assumptions: [
      "Hop latency uses the declared connection.latencyMs assumption; processing uses latencyBudget allocations.",
      "The deadline applies to the slowest synchronous path; parallel branches are not additive.",
      "Retry overhead is the worst case (retryMax retrries of the full hop), not an expectation.",
      "Async hops never block the synchronous deadline; their completion is eventual by design.",
    ],
  };
}
