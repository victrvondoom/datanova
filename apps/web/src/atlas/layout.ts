/**
 * Datanova Atlas — deterministic spatial layout engine (Campaign 06, Task 11).
 *
 * Coordinate semantics (documented, consistent):
 *  - X axis: request/data-flow progression (flow depth 0 = leftmost).
 *  - Z axis: trust-zone lanes (zone order = zone index, deterministic).
 *  - Y axis: vertical stacking within a zone when multiple nodes share a
 *    (depth, zone) cell.
 * Layout metadata is stored SEPARATELY from architecture semantics: moving a
 * node never changes the canonical model (Task 11.4).
 */

import type { VisGraph } from "./graph";
import { flowDepths, graphStats } from "./graph";

export interface LayoutPosition {
  x: number;
  y: number;
  z: number;
}

export interface LayoutResult {
  positions: Record<string, LayoutPosition>;
  /** zone lane bounds for the translucent zone regions */
  zoneBounds: Record<string, { minX: number; maxX: number; minZ: number; maxZ: number }>;
  /** grid cell size used for spacing */
  cell: number;
}

export const LAYOUT_CELL = 14;

/**
 * Deterministic layered layout: no randomness, no floating-point drift —
 * the same graph always yields the same layout. Dense (depth, zone) cells
 * stack vertically with deterministic in-cell ordering (by node id).
 */
export function layeredLayout(g: VisGraph, cell = LAYOUT_CELL): LayoutResult {
  const depths = flowDepths(g);
  const byZone = new Map<string, string[]>();
  for (const z of g.zones) byZone.set(z.id, []);
  for (const n of g.nodes) {
    const zone = n.zoneId && byZone.has(n.zoneId) ? n.zoneId : "__unzoned";
    if (!byZone.has(zone)) byZone.set(zone, []);
    byZone.get(zone)!.push(n.id);
  }
  const zoneOrder = [...byZone.keys()].sort();
  const positions: Record<string, LayoutPosition> = {};
  const zoneBounds: Record<string, LayoutResult["zoneBounds"][string]> = {};

  for (const zoneId of zoneOrder) {
    const members = byZone.get(zoneId)!;
    const lane = zoneOrder.indexOf(zoneId);
    // deterministic in-lane ordering: by flow depth, then by id
    const sorted = [...members].sort((a, b) => depths[a] - depths[b] || a.localeCompare(b));
    const usedDepths = new Map<number, string[]>();
    for (const id of sorted) {
      const d = depths[id];
      if (!usedDepths.has(d)) usedDepths.set(d, []);
      usedDepths.get(d)!.push(id);
    }
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (const [d, ids] of [...usedDepths.entries()].sort((a, b) => a[0] - b[0])) {
      const colIdx = d;
      const x = colIdx * cell;
      minX = Math.min(minX, x - cell / 2);
      maxX = Math.max(maxX, x + cell / 2);
      ids.forEach((id, rowIdx) => {
        // center the vertical stack in the lane
        const z = (rowIdx - (ids.length - 1) / 2) * cell;
        minZ = Math.min(minZ, z - cell / 2);
        maxZ = Math.max(maxZ, z + cell / 2);
        positions[id] = { x, y: 0, z: z + lane * cell * 3 };
      });
    }
    if (members.length > 0) {
      zoneBounds[zoneId === "__unzoned" ? "" : zoneId] = {
        minX, maxX,
        minZ: minZ + lane * cell * 3,
        maxZ: maxZ + lane * cell * 3,
      };
    }
  }
  return { positions, zoneBounds, cell };
}

/** Scene bounding box — used by fit-to-view and the minimap. */
export function layoutBounds(layout: LayoutResult): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const xs = Object.values(layout.positions).map((p) => p.x);
  const zs = Object.values(layout.positions).map((p) => p.z);
  if (xs.length === 0) return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  return {
    minX: Math.min(...xs) - 10, maxX: Math.max(...xs) + 10,
    minZ: Math.min(...zs) - 10, maxZ: Math.max(...zs) + 10,
  };
}

/** User-arranged layout: applied on top of the deterministic base. */
export interface UserLayout {
  /** component id -> {x, z} overrides */
  moved: Record<string, { x: number; z: number }>;
}

export function applyUserLayout(base: LayoutResult, user: UserLayout | null): LayoutResult {
  if (!user) return base;
  const positions = { ...base.positions };
  for (const [id, pos] of Object.entries(user.moved)) {
    if (positions[id]) positions[id] = { x: pos.x, y: 0, z: pos.z };
  }
  return { ...base, positions };
}

/**
 * Layout integrity: every node has a position, positions are finite, and
 * the layout is reproducible byte-for-byte (called by tests).
 */
export function layoutIsSane(g: VisGraph, layout: LayoutResult): string[] {
  const problems: string[] = [];
  for (const n of g.nodes) {
    const p = layout.positions[n.id];
    if (!p) problems.push(`node ${n.id} has no position`);
    else if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) problems.push(`node ${n.id} has a non-finite position`);
  }
  const { isolated } = graphStats(g);
  for (const id of isolated) {
    if (!layout.positions[id]) problems.push(`isolated node ${id} missing from layout`);
  }
  return problems;
}
