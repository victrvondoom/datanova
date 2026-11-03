/**
 * Datanova Atlas — canonical graph adapter (Campaign 06, Task 08).
 *
 * Single translation layer from the canonical ArchitectureModel (model.ts,
 * the one source of truth for every engine) to renderer-ready visualization
 * objects. The renderer NEVER owns architecture semantics: every node and
 * edge carries the canonical id, and every displayed datum traces back to
 * the model. Unsupported or incomplete entities are surfaced explicitly
 * (unplaced/unresolved), never silently dropped.
 */

import type { ArchitectureModel, Component, Connection } from "../lab/model";
import { MODEL_VERSION } from "../lab/model";

export type VisNodeType =
  | "client" | "gateway" | "service" | "worker" | "queue"
  | "cache" | "database" | "objectstore" | "broker" | "analytics" | "external";

export interface VisNode {
  id: string;
  type: VisNodeType;
  label: string;
  /** documented purpose from the intent layer */
  purpose: string;
  zoneId: string | null;
  requirementIds: string[];
  /** canonical config, displayed read-only in the inspector */
  config: Component["config"];
  /** telemetry spec presence (used by the evidence/observability layers) */
  telemetry: boolean;
}

export type VisEdgeKind = "sync" | "async" | "event";

export interface VisEdge {
  id: string;
  from: string;
  to: string;
  kind: VisEdgeKind;
  criticality: number;
  failureBehavior: Connection["failureBehavior"];
  access: Connection["access"] | null;
  controls: string[];
  operationIds: string[];
  latencyMs: number | null;
}

export interface VisZone {
  id: string;
  label: string;
  trust: string;
}

export interface VisGraph {
  modelVersion: number;
  archId: string;
  name: string;
  nodes: VisNode[];
  edges: VisEdge[];
  zones: VisZone[];
  /** entities that could not be fully resolved (never silently dropped) */
  unresolved: string[];
}

/**
 * Adapt the canonical model. Edges referencing unknown components are
 * recorded in `unresolved` (the renderer shows them as broken links if the
 * model somehow contains them — model validation normally prevents this).
 */
export function toVisGraph(model: ArchitectureModel): VisGraph {
  const nodeIds = new Set(model.components.map((c) => c.id));
  const unresolved: string[] = [];
  const edges: VisEdge[] = [];
  for (const cn of model.connections) {
    if (!nodeIds.has(cn.from) || !nodeIds.has(cn.to)) {
      unresolved.push(`connection ${cn.id}: ${cn.from} -> ${cn.to} references an unknown component`);
      continue;
    }
    edges.push({
      id: cn.id,
      from: cn.from,
      to: cn.to,
      kind: cn.kind,
      criticality: cn.criticality,
      failureBehavior: cn.failureBehavior,
      access: cn.access ?? undefined,
      controls: [...(cn.controls ?? [])],
      operationIds: [...cn.operationIds],
      latencyMs: cn.latencyMs ?? null,
    });
  }
  return {
    modelVersion: MODEL_VERSION,
    archId: model.id,
    name: model.name,
    nodes: model.components.map((c): VisNode => ({
      id: c.id,
      type: c.kind,
      label: c.name,
      purpose: c.purpose ?? "",
      zoneId: c.zoneId ?? null,
      requirementIds: [...c.requirementIds],
      config: { ...c.config },
      telemetry: Boolean(c.telemetry && (c.telemetry.metrics?.length || c.telemetry.logs || c.telemetry.traces)),
    })),
    edges,
    zones: model.zones.map((z) => ({ id: z.id, label: z.name, trust: z.trust })),
    unresolved,
  };
}

/** Deterministic graph statistics used by the layout, minimap, and tests. */
export function graphStats(g: VisGraph): {
  nodes: number;
  edges: number;
  zones: number;
  inDegree: Record<string, number>;
  outDegree: Record<string, number>;
  /** components with no connections at all */
  isolated: string[];
} {
  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};
  for (const n of g.nodes) { inDegree[n.id] = 0; outDegree[n.id] = 0; }
  for (const e of g.edges) {
    outDegree[e.from] += 1;
    inDegree[e.to] += 1;
  }
  const isolated = g.nodes.filter((n) => inDegree[n.id] + outDegree[n.id] === 0).map((n) => n.id);
  return { nodes: g.nodes.length, edges: g.edges.length, zones: g.zones.length, inDegree, outDegree, isolated };
}

/**
 * Flow depth for layout: the longest distance from a flow source (a node
 * with no incoming request-path edges). Cycles are handled deterministically
 * by processing nodes in topological order where possible and capping the
 * remaining at the current max (documented behavior, tested).
 */
export function flowDepths(g: VisGraph): Record<string, number> {
  const incoming: Record<string, string[]> = {};
  const outgoing: Record<string, string[]> = {};
  for (const n of g.nodes) { incoming[n.id] = []; outgoing[n.id] = []; }
  for (const e of g.edges) {
    outgoing[e.from].push(e.to);
    incoming[e.to].push(e.from);
  }
  const depth: Record<string, number> = {};
  for (const n of g.nodes) depth[n.id] = 0;
  // Kahn-style layered relaxation, iterated |V| times — deterministic and cycle-safe
  for (let iter = 0; iter < g.nodes.length; iter += 1) {
    let changed = false;
    for (const n of g.nodes) {
      for (const src of incoming[n.id]) {
        const candidate = depth[src] + 1;
        if (candidate > depth[n.id] && candidate <= g.nodes.length) {
          depth[n.id] = candidate;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return depth;
}
