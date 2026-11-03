/**
 * Task 22 — Data Lineage and Privacy Exposure Graph.
 *
 * Traces sensitive data through the architecture: who holds it, where it
 * flows next, which holders have no documented purpose, which copies may
 * outlive their retention period, and which copies are missing from the
 * deletion workflow.
 */

import type { ArchitectureModel, DataEntity, Finding } from "../model";
import { finding } from "../model";

export interface LineageNode {
  componentId: string;
  relation: "owner" | "copy";
  purpose?: string;
  /** components this holder forwards data to (downstream flows) */
  flowsTo: string[];
}

export interface EntityLineage {
  entityId: string;
  classification: DataEntity["classification"];
  retentionDays?: number;
  nodes: LineageNode[];
}

/** Task 22.2 — lineage graph per entity (holders + downstream flows). */
export function lineage(m: ArchitectureModel, entity: DataEntity): EntityLineage {
  const holders = [entity.ownerComponentId, ...(entity.copies ?? []).map((c) => c.componentId)];
  const nodes: LineageNode[] = holders.map((h) => ({
    componentId: h,
    relation: h === entity.ownerComponentId ? "owner" as const : "copy" as const,
    purpose: (entity.copies ?? []).find((c) => c.componentId === h)?.purpose,
    flowsTo: m.connections.filter((cn) => cn.from === h).map((cn) => cn.to),
  }));
  return {
    entityId: entity.id, classification: entity.classification,
    retentionDays: entity.retentionDays, nodes,
  };
}

export interface ExposureFinding {
  entityId: string;
  componentId: string;
  reason: string;
}

/** Task 22.3 — sensitive data received without documented purpose/protection. */
export function exposureAnalysis(m: ArchitectureModel): { exposures: ExposureFinding[]; findings: Finding[] } {
  const exposures: ExposureFinding[] = [];
  const findings: Finding[] = [];
  m.dataEntities.forEach((d) => {
    if (d.classification !== "sensitive" && d.classification !== "pii") return;
    (d.copies ?? []).forEach((c) => {
      const comp = m.components.find((x) => x.id === c.componentId);
      if (!comp) return;
      if (!c.purpose || c.purpose.trim().length < 3) {
        exposures.push({ entityId: d.id, componentId: c.componentId, reason: "copy has no documented purpose" });
      }
      // flowing onward without encryption toward a lower-trust zone
      m.connections.filter((cn) => cn.from === c.componentId).forEach((cn) => {
        const fromTrust = m.zones.find((z) => z.id === comp.zoneId)?.trust;
        const toTrust = m.zones.find((z) => z.id === m.components.find((x) => x.id === cn.to)?.zoneId)?.trust;
        const rank = { internet: 0, dmz: 1, trusted: 2, privileged: 3 } as Record<string, number>;
        if (fromTrust && toTrust && rank[toTrust] < rank[fromTrust] && !(cn.controls ?? []).includes("encryption")) {
          exposures.push({
            entityId: d.id, componentId: cn.to,
            reason: `sensitive "${d.name}" flows from ${c.componentId} to ${cn.to} (lower trust) without encryption`,
          });
        }
      });
    });
  });
  exposures.forEach((e) => {
    findings.push(finding(
      "lineage", `lineage-exposure:${e.entityId}:${e.componentId}`, "critical",
      `Privacy exposure: ${e.entityId} -> ${e.componentId}`,
      e.reason,
      [{ ref: `dataEntity:${e.entityId}`, detail: "sensitive data" },
       { ref: `component:${e.componentId}`, detail: "recipient" }],
    ));
  });
  return { exposures, findings };
}

/** Task 22.4 — copies that outlive retention or miss the deletion workflow. */
export function retentionAnalysis(m: ArchitectureModel): Finding[] {
  const findings: Finding[] = [];
  m.dataEntities.forEach((d) => {
    if (!d.retentionDays) return;
    const holders = [d.ownerComponentId, ...(d.copies ?? []).map((c) => c.componentId)];
    const deleteOp = m.operations.find((o) => /delete|remove|purge/i.test(o.name));
    holders.forEach((h) => {
      const inDeletePath = deleteOp
        ? m.connections.some((cn) =>
          cn.operationIds.includes(deleteOp.id) && (cn.from === h || cn.to === h))
        : false;
      const comp = m.components.find((c) => c.id === h);
      const ttl = Number(comp?.config.ttlSeconds ?? Infinity);
      if (!inDeletePath && comp?.kind === "cache" && ttl !== Infinity) {
        // caches self-expire: acceptable, documented
        findings.push(finding(
          "lineage", `lineage-retention-ok:${d.id}:${h}`, "info",
          `Cache copy of "${d.name}" in ${h} expires via TTL (${ttl}s)`,
          `TTL (${ttl}s) is shorter than the ${d.retentionDays}-day retention, so this copy cannot outlive the source.`,
          [{ ref: `component:${h}`, detail: `ttlSeconds: ${ttl}` }],
        ));
      } else if (!inDeletePath) {
        findings.push(finding(
          "lineage", `lineage-retention:${d.id}:${h}`, "warning",
          `Copy of "${d.name}" in ${h} is not in any deletion workflow`,
          `"${d.name}" has a ${d.retentionDays}-day retention, but no delete operation touches ${h}. The copy may outlive its intended lifetime.`,
          [{ ref: `dataEntity:${d.id}`, detail: `retentionDays: ${d.retentionDays}` },
           { ref: `component:${h}`, detail: "not covered by deletion" }],
        ));
      }
    });
  });
  return findings;
}

export function analyzeLineage(m: ArchitectureModel): { lineages: EntityLineage[]; findings: Finding[] } {
  const lineages = m.dataEntities.map((d) => lineage(m, d));
  const findings = [...exposureAnalysis(m).findings, ...retentionAnalysis(m)];
  return { lineages, findings };
}
