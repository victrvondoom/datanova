/**
 * Task 17 — Transaction Boundary and Data Ownership Auditor.
 *
 * Who can mutate which entity, do mutations cross transaction boundaries, and
 * where is ownership unclear? Suggests alternatives context-sensitively but
 * never auto-selects one.
 */

import type { ArchitectureModel, DataEntity, Finding } from "../model";
import { finding } from "../model";

export interface EntityWriters {
  entityId: string;
  ownerComponentId: string;
  writers: { componentId: string; connectionId: string; crossesBoundary: boolean }[];
  copies: string[];
}

/** Task 17.2 — write-path analysis per entity. */
export function entityWriters(m: ArchitectureModel, entity: DataEntity): EntityWriters {
  const copies = (entity.copies ?? []).map((c) => c.componentId);
  const writers = m.connections
    .filter((cn) => (cn.access === "write" || cn.access === "readwrite"))
    .map((cn) => ({ cn, holder: cn.to }))
    .filter(({ holder }) => holder === entity.ownerComponentId || copies.includes(holder))
    .map(({ cn }) => ({
      componentId: cn.from,
      connectionId: cn.id,
      crossesBoundary: isCrossBoundary(m, cn.from, cn.to),
    }));
  return { entityId: entity.id, ownerComponentId: entity.ownerComponentId, writers, copies };
}

function isCrossBoundary(m: ArchitectureModel, a: string, b: string): boolean {
  const za = m.components.find((c) => c.id === a)?.zoneId;
  const zb = m.components.find((c) => c.id === b)?.zoneId;
  return !!za && !!zb && za !== zb;
}

export interface OwnershipViolation {
  entityId: string;
  kind: "unclear-owner" | "duplicate-authority" | "cross-boundary-mutation";
  detail: string;
  evidence: string[];
}

export function auditOwnership(m: ArchitectureModel): { writers: EntityWriters[]; violations: OwnershipViolation[]; findings: Finding[] } {
  const writers = m.dataEntities.map((d) => entityWriters(m, d));
  const violations: OwnershipViolation[] = [];

  m.dataEntities.forEach((d) => {
    const w = writers.find((x) => x.entityId === d.id) as EntityWriters;
    const distinct = [...new Set(w.writers.map((x) => x.componentId))];

    // unclear ownership: entity has no owner or owner has no writer
    if (!m.components.some((c) => c.id === d.ownerComponentId)) {
      violations.push({
        entityId: d.id, kind: "unclear-owner",
        detail: `owner component ${d.ownerComponentId} does not exist`,
        evidence: [`dataEntity:${d.id}`],
      });
    }

    // duplicated authoritative state: several components write the entity
    if (distinct.length > 1) {
      violations.push({
        entityId: d.id, kind: "duplicate-authority",
        detail: `${distinct.length} components mutate "${d.name}" (${distinct.join(", ")}) — authoritative state is duplicated and requires explicit justification or a coordination mechanism`,
        evidence: w.writers.map((x) => `connection:${x.connectionId}`),
      });
    }

    // cross-boundary mutations with atomicity needs
    const crossBoundary = w.writers.filter((x) => x.crossesBoundary);
    if (crossBoundary.length > 0 && distinct.length > 0) {
      const sameZone = distinct.every((cid) => m.components.find((c) => c.id === cid)?.zoneId === m.components.find((c) => c.id === distinct[0])?.zoneId);
      violations.push({
        entityId: d.id, kind: "cross-boundary-mutation",
        detail: crossBoundary.length === w.writers.length && sameZone
          ? `all writers of "${d.name}" sit in one zone but the store is in another — every mutation crosses a transaction boundary (${crossBoundary.map((x) => `${x.componentId} -> via ${x.connectionId}`).join("; ")})`
          : `mutations of "${d.name}" cross trust/deployment boundaries (${crossBoundary.map((x) => `${x.componentId} via ${x.connectionId}`).join("; ")}) — a local transaction cannot cover them`,
        evidence: crossBoundary.map((x) => `connection:${x.connectionId}`),
      });
    }
  });

  const findings: Finding[] = violations.map((v) => finding(
    "ownership", `ownership:${v.kind}:${v.entityId}`,
    v.kind === "unclear-owner" ? "critical" : "warning",
    `${v.kind.replace(/-/g, " ")}: ${v.entityId}`,
    v.detail,
    v.evidence.map((e) => ({ ref: e, detail: v.kind })),
  ));
  return { writers, violations, findings };
}

/** Task 17.4 — context-sensitive alternatives with trade-offs, no auto-selection. */
export interface RefactorAlternative {
  approach: string;
  appliesWhen: string;
  tradeoff: string;
}

export function refactorAlternatives(v: OwnershipViolation): RefactorAlternative[] {
  const out: RefactorAlternative[] = [];
  if (v.kind === "duplicate-authority") {
    out.push({
      approach: "Consolidate ownership: only the authoritative owner accepts writes; others read or request changes through it",
      appliesWhen: "writers serve the same business capability and can be merged or fronted by one API",
      tradeoff: "the owner becomes a coordination point; its availability and latency affect every writer",
    });
    out.push({
      approach: "Publish an event: secondary writers publish intents; the owner applies them in order",
      appliesWhen: "writers act on different triggers and can tolerate ordering/asynchrony",
      tradeoff: "eventual consistency for downstream observers; needs ordering, idempotent consumers, and DLQ handling",
    });
    out.push({
      approach: "Introduce a saga: coordinate multi-writer updates with local transactions and compensations",
      appliesWhen: "updates must span services and cannot be merged into one transaction",
      tradeoff: "sagas add failure-path complexity: compensations, retries, and manual recovery states",
    });
  }
  if (v.kind === "cross-boundary-mutation") {
    out.push({
      approach: "Move the store into the writing zone's transaction boundary (or vice versa)",
      appliesWhen: "the data belongs to one service and other zones only need access via that service",
      tradeoff: "couples deployment of the store to that service; other zones lose direct access",
    });
    out.push({
      approach: "Accept the distributed write and design for it: idempotency, retries, and reconciliation",
      appliesWhen: "the boundary is intentional (scaling, trust, or ownership reasons)",
      tradeoff: "no atomicity across the boundary: temporary inconsistency is a feature, not a bug — must be documented",
    });
  }
  if (v.kind === "unclear-owner") {
    out.push({
      approach: "Assign ownership explicitly and record the rationale as an ADR",
      appliesWhen: "always — an entity without an owner cannot be reasoned about",
      tradeoff: "none: this is the prerequisite for every other alternative",
    });
  }
  return out;
}
