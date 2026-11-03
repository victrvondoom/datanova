/**
 * Task 03 — Semantic Dependency and Causal Graph.
 *
 * Physical connectivity is not the same as an operational dependency. This
 * module derives, from the canonical model, four inspectable views:
 * physical (who connects to whom), dependency (who blocks whom),
 * business-operation subgraphs, and causal relationships.
 */

import type { ArchitectureModel, Connection } from "../model";

export interface GraphEdge {
  from: string;
  to: string;
  connectionId: string;
  kind: Connection["kind"];
  criticality: number;
  failureBehavior: Connection["failureBehavior"];
  latencyMs?: number;
}

export interface GraphView {
  name: "physical" | "dependency" | "operation" | "causal";
  nodes: string[];
  edges: GraphEdge[];
}

export function physicalView(m: ArchitectureModel): GraphView {
  return {
    name: "physical",
    nodes: m.components.map((c) => c.id),
    edges: m.connections.map(toEdge),
  };
}

/** Logical dependency view: only edges that represent a runtime dependency. */
export function dependencyView(m: ArchitectureModel): GraphView {
  return {
    name: "dependency",
    nodes: m.components.map((c) => c.id),
    edges: m.connections.filter((cn) => cn.kind !== "event" || true).map(toEdge),
  };
}

export function operationView(m: ArchitectureModel, operationId: string): GraphView {
  const conns = m.connections.filter((cn) => cn.operationIds.includes(operationId));
  const nodeIds = new Set<string>();
  conns.forEach((cn) => { nodeIds.add(cn.from); nodeIds.add(cn.to); });
  return {
    name: "operation",
    nodes: [...nodeIds],
    edges: conns.map(toEdge),
  };
}

/**
 * Causal view (Task 03.3): which dependency, when degraded, affects which
 * upstream variable. Examples encoded by `causalLinks`:
 *  - database latency increases request duration,
 *  - worker failure increases queue depth,
 *  - missing idempotency permits duplicate side effects.
 */
export interface CausalLink {
  cause: string; // component id
  effect: string; // component id (upstream) or variable like "queue:work-queue.depth"
  relation: string; // human-readable relation
  connectionId: string;
}

export function causalView(m: ArchitectureModel): GraphView {
  const edges: GraphEdge[] = m.connections
    .filter((cn) => cn.kind === "sync" || cn.kind === "async")
    .map(toEdge);
  return { name: "causal", nodes: m.components.map((c) => c.id), edges };
}

export function causalLinks(m: ArchitectureModel): CausalLink[] {
  const links: CausalLink[] = [];
  m.connections.forEach((cn) => {
    const target = m.components.find((c) => c.id === cn.to);
    const source = m.components.find((c) => c.id === cn.from);
    if (!target || !source) return;
    if (cn.kind === "sync") {
      links.push({
        cause: cn.to,
        effect: cn.from,
        relation: `${target.name} latency/failure increases ${source.name} request duration`,
        connectionId: cn.id,
      });
    }
    if (target.kind === "queue") {
      links.push({
        cause: "worker-down",
        effect: `queue:${cn.to}.depth`,
        relation: `worker failure increases ${target.name} depth`,
        connectionId: cn.id,
      });
    }
  });
  m.components.forEach((c) => {
    if (c.config.idempotent === false) {
      links.push({
        cause: `component:${c.id}`,
        effect: `component:${c.id}.duplicateSideEffects`,
        relation: `missing idempotency in ${c.name} permits duplicate side effects under retries`,
        connectionId: m.connections.find((cn) => cn.from === c.id)?.id ?? "n/a",
      });
    }
  });
  return links;
}

function toEdge(cn: Connection): GraphEdge {
  return {
    from: cn.from, to: cn.to, connectionId: cn.id, kind: cn.kind,
    criticality: cn.criticality, failureBehavior: cn.failureBehavior, latencyMs: cn.latencyMs,
  };
}

// ---------------------------------------------------------------------------
// Traversal primitives
// ---------------------------------------------------------------------------

export function downstreamEdges(m: ArchitectureModel, componentId: string): GraphEdge[] {
  return m.connections.filter((cn) => cn.from === componentId).map(toEdge);
}

export function upstreamEdges(m: ArchitectureModel, componentId: string): GraphEdge[] {
  return m.connections.filter((cn) => cn.to === componentId).map(toEdge);
}

/** All components reachable downstream (what I depend on, transitively). */
export function downstreamClosure(m: ArchitectureModel, componentId: string): Set<string> {
  const seen = new Set<string>([componentId]);
  const queue = [componentId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    m.connections.filter((cn) => cn.from === cur).forEach((cn) => {
      if (!seen.has(cn.to)) { seen.add(cn.to); queue.push(cn.to); }
    });
  }
  return seen;
}

/** All components that (transitively) depend on me — reverse closure. */
export function upstreamClosure(m: ArchitectureModel, componentId: string): Set<string> {
  const seen = new Set<string>([componentId]);
  const queue = [componentId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    m.connections.filter((cn) => cn.to === cur).forEach((cn) => {
      if (!seen.has(cn.from)) { seen.add(cn.from); queue.push(cn.from); }
    });
  }
  return seen;
}

/** Tarjan-free simple cycle detection: DFS with a rec-stack. */
export function findCycle(m: ArchitectureModel): string[] | null {
  const state = new Map<string, 0 | 1 | 2>(); // 0 unvisited, 1 in-stack, 2 done
  const parent = new Map<string, string>();
  let cycle: string[] | null = null;

  const visit = (node: string): void => {
    if (cycle) return;
    state.set(node, 1);
    for (const cn of m.connections.filter((c) => c.from === node)) {
      const st = state.get(cn.to) ?? 0;
      if (st === 1) {
        // reconstruct cycle
        const path: string[] = [cn.to];
        let cur = node;
        while (cur !== cn.to) { path.push(cur); cur = parent.get(cur) as string; }
        cycle = path.reverse();
        return;
      }
      if (st === 0) { parent.set(cn.to, node); visit(cn.to); }
      if (cycle) return;
    }
    state.set(node, 2);
  };

  for (const c of m.components) {
    if ((state.get(c.id) ?? 0) === 0) visit(c.id);
    if (cycle) break;
  }
  return cycle;
}

/** Longest chain of synchronous dependencies from a component (sync depth). */
export function syncDepthFrom(m: ArchitectureModel, componentId: string, seen = new Set<string>()): number {
  if (seen.has(componentId)) return 0; // cycle guard
  seen.add(componentId);
  let best = 0;
  m.connections
    .filter((cn) => cn.from === componentId && cn.kind === "sync")
    .forEach((cn) => { best = Math.max(best, 1 + syncDepthFrom(m, cn.to, new Set(seen))); });
  return best;
}
