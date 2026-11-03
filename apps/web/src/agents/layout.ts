/**
 * Deterministic canvas layout — column per dependency depth (longest path from
 * a root), parallel-group members side by side within a column. Layout is a
 * VIEW concern: stored overrides never change workflow semantics.
 */

import type { WorkflowDef, WfNode } from "./types";

export interface NodePos { x: number; y: number }

const COLUMN_W = 230;
const ROW_H = 130;

export const layoutNodes = (def: WorkflowDef, overrides: Record<string, NodePos> = {}): Record<string, NodePos> => {
  const depth = new Map<string, number>();
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const computeDepth = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0; // cycle guard (validation rejects these anyway)
    seen.add(id);
    const incoming = def.edges.filter((e) => e.to === id);
    const d = incoming.length === 0 ? 0 : Math.max(...incoming.map((e) => computeDepth(e.from, seen) + 1));
    depth.set(id, d);
    return d;
  };
  def.nodes.forEach((n) => computeDepth(n.id));

  const columns = new Map<number, WfNode[]>();
  for (const n of def.nodes) {
    const d = depth.get(n.id) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), n]);
  }
  const positions: Record<string, NodePos> = {};
  for (const [d, nodes] of columns) {
    // order within column: groups together, then label for determinism
    const sorted = [...nodes].sort((a, b) =>
      (a.group ?? "zz").localeCompare(b.group ?? "zz") || a.label.localeCompare(b.label));
    const span = (sorted.length - 1) * ROW_H;
    sorted.forEach((n, i) => {
      positions[n.id] = { x: 60 + d * COLUMN_W, y: 60 + i * ROW_H - span / 2 + 220 };
    });
  }
  // user overrides (dragged nodes) win over the computed layout
  for (const [id, pos] of Object.entries(overrides)) {
    if (byId.has(id)) positions[id] = pos;
  }
  return positions;
};

export const canvasBounds = (positions: Record<string, NodePos>): { w: number; h: number } => {
  const xs = Object.values(positions).map((p) => p.x);
  const ys = Object.values(positions).map((p) => p.y);
  return {
    w: Math.max(...xs, 0) + 220,
    h: Math.max(...ys, 0) + 120,
  };
};
