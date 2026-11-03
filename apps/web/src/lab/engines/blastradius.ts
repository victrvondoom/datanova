/**
 * Task 10 — Blast-Radius and Criticality Analyzer.
 *
 * Explains which user-visible capabilities are affected when a component
 * fails, why (direct vs indirect), which boundaries limit propagation, and
 * how the design compares to one without those boundaries.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";
import { propagate, type PropagationResult } from "./causal";
import { upstreamClosure } from "./graph";

export interface CriticalityFactors {
  componentId: string;
  maxOperationCriticality: number;
  dependents: number;
  ownsDataEntities: number;
  stateful: boolean;
  score: number; // 0..5
}

/** Task 10.1 — explicit-factor criticality (no opaque score: factors shown). */
export function criticality(m: ArchitectureModel, componentId: string): CriticalityFactors | null {
  const c = m.components.find((x) => x.id === componentId);
  if (!c) return null;
  const ops = m.operations.filter((o) =>
    m.connections.some((cn) => cn.operationIds.includes(o.id) && (cn.from === componentId || cn.to === componentId)));
  const maxOp = ops.length === 0 ? 1 : Math.max(...ops.map((o) => o.criticality));
  const dependents = upstreamClosure(m, componentId).size - 1;
  const owns = m.dataEntities.filter((d) => d.ownerComponentId === componentId).length;
  const stateful = ["database", "objectstore", "cache", "queue"].includes(c.kind);
  const score = Math.min(5,
    0.5 * maxOp + 0.5 * Math.min(dependents, 4) + 0.5 * Math.min(owns, 2) + (stateful ? 0.5 : 0));
  return { componentId, maxOperationCriticality: maxOp, dependents, ownsDataEntities: owns, stateful, score: Math.round(score * 10) / 10 };
}

export interface OperationImpact {
  operationId: string;
  operationName: string;
  criticality: number;
  impacted: boolean;
  directImpactedComponents: string[];
  indirectImpactedComponents: string[];
}

export interface BlastRadius {
  componentId: string;
  fault: "down" | "slow";
  propagation: PropagationResult;
  affectedComponents: { id: string; status: string; direct: boolean }[];
  impactedOperations: OperationImpact[];
  protectedByBoundaries: string[];
  /** comparison: same architecture with every edge forced to blocking sync */
  withoutIsolation: { affectedCount: number; impactedOperationIds: string[] };
}

export function blastRadius(m: ArchitectureModel, componentId: string, fault: "down" | "slow" = "down"): BlastRadius {
  const prop = propagate(m, { componentId, fault });
  const affected = Object.entries(prop.finalStatus)
    .filter(([id, s]) => s !== "up" && id !== componentId)
    .map(([id, s]) => ({
      id, status: s,
      direct: m.connections.some((cn) =>
        (cn.from === componentId && cn.to === id) || (cn.to === componentId && cn.from === id)),
    }));

  const impactedOperations: OperationImpact[] = m.operations.map((o) => {
    const opConnections = m.connections.filter((cn) => cn.operationIds.includes(o.id));
    const impactedIds = new Set<string>();
    opConnections.forEach((cn) => {
      [cn.from, cn.to].forEach((id) => {
        if (prop.finalStatus[id] && prop.finalStatus[id] !== "up") impactedIds.add(id);
      });
    });
    // direct: on an edge adjacent to the failed component; indirect: transitive
    const direct = [...impactedIds].filter((id) =>
      id === componentId ||
      opConnections.some((cn) =>
        (cn.from === componentId && cn.to === id) || (cn.to === componentId && cn.from === id)));
    const indirect = [...impactedIds].filter((id) => !direct.includes(id));
    return {
      operationId: o.id, operationName: o.name, criticality: o.criticality,
      impacted: impactedIds.size > 0,
      directImpactedComponents: direct,
      indirectImpactedComponents: indirect,
    };
  });

  const protectedByBoundaries = m.connections
    .filter((cn) =>
      (cn.from === componentId || cn.to === componentId) &&
      (cn.failureBehavior === "isolated" || cn.failureBehavior === "degrades" || cn.kind === "async"))
    .map((cn) => cn.id);

  // counterfactual comparison: what if no edge isolated anything?
  const stripped: ArchitectureModel = {
    ...m,
    connections: m.connections.map((cn) => ({ ...cn, failureBehavior: "blocks" as const, kind: "sync" as const })),
  };
  const propStripped = propagate(stripped, { componentId, fault });
  const withoutIsolation = {
    affectedCount: Object.values(propStripped.finalStatus).filter((s) => s !== "up").length - 1,
    impactedOperationIds: m.operations
      .filter((o) => m.connections.some((cn) =>
        cn.operationIds.includes(o.id) &&
        (propStripped.finalStatus[cn.from] !== "up" || propStripped.finalStatus[cn.to] !== "up")))
      .map((o) => o.id),
  };

  return {
    componentId, fault, propagation: prop,
    affectedComponents: affected,
    impactedOperations: impactedOperations.filter((o) => o.impacted),
    protectedByBoundaries,
    withoutIsolation,
  };
}

/** Findings view (Task 10.3): user-facing impact with explanations. */
export function blastRadiusFindings(m: ArchitectureModel, componentId: string, fault: "down" | "slow" = "down"): Finding[] {
  const br = blastRadius(m, componentId, fault);
  const name = (id: string) => m.components.find((c) => c.id === id)?.name ?? id;
  const findings: Finding[] = br.impactedOperations.map((o) => finding(
    "blast", `blast:${componentId}:${o.operationId}`,
    o.criticality >= 4 ? "critical" : "warning",
    `Operation "${o.operationName}" is impacted by ${name(componentId)} failure`,
    o.directImpactedComponents.length > 0
      ? `Direct impact: ${o.directImpactedComponents.map(name).join(", ")}. Indirect: ${o.indirectImpactedComponents.map(name).join(", ") || "none"}.`
      : `Indirect (transitive) impact via: ${o.indirectImpactedComponents.map(name).join(", ")}.`,
    [{ ref: `component:${componentId}`, detail: `injected ${fault} fault` },
     { ref: `operation:${o.operationId}`, detail: `criticality ${o.criticality}` }],
  ));
  if (br.protectedByBoundaries.length > 0) {
    findings.push(finding(
      "blast", `blast-boundary:${componentId}`, "info",
      `Failure isolation limits the blast radius of ${name(componentId)}`,
      `${br.protectedByBoundaries.length} boundary edge(s) (${br.protectedByBoundaries.join(", ")}) stop or soften propagation. Without them, ${br.withoutIsolation.affectedCount} component(s) and ${br.withoutIsolation.impactedOperationIds.length} operation(s) would be affected.`,
      br.protectedByBoundaries.map((cnId) => ({ ref: `connection:${cnId}`, detail: "isolating boundary" })),
    ));
  }
  return findings;
}
