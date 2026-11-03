/**
 * Task 16 — Consistency Contract Visualizer.
 *
 * Checks whether the architecture's communication/persistence patterns can
 * satisfy the declared consistency contracts. Unsupported guarantees are
 * marked UNKNOWN — never silently passed.
 */

import type { ArchitectureModel, ConsistencyContract, Finding } from "../model";
import { finding } from "../model";

export interface ContractCheck {
  contractId: string;
  requirementId: string;
  entityId: string;
  operationId: string;
  promised: string;
  verdict: "satisfied" | "violated" | "unknown";
  detail: string;
  evidence: string[];
}

export interface ConsistencyTimelineEvent {
  t: number;
  actor: string;
  action: string;
  observed: string;
  stale: boolean;
  note: string;
}

/** Analyze one contract against the model's read/write paths. */
export function checkContract(m: ArchitectureModel, cc: ConsistencyContract): ContractCheck {
  const entity = m.dataEntities.find((d) => d.id === cc.entityId);
  const writeConns = m.connections.filter((cn) =>
    (cn.access === "write" || cn.access === "readwrite") &&
    cn.to === entity?.ownerComponentId);
  const readConns = m.connections.filter((cn) =>
    (cn.access === "read" || cn.access === "readwrite") &&
    cn.to === entity?.ownerComponentId);
  const evidence: string[] = [
    `dataEntity:${cc.entityId}`, `requirement:${cc.requirementId}`, `operation:${cc.operationId}`,
  ];

  if (!entity) {
    return { contractId: cc.id, requirementId: cc.requirementId, entityId: cc.entityId, operationId: cc.operationId,
      promised: cc.readAfterWrite, verdict: "unknown", detail: "referenced entity does not exist", evidence };
  }

  if (cc.readAfterWrite === "immediate") {
    // every read path toward the owner must not pass through a TTL cache,
    // unless writes invalidate it — we cannot prove invalidation from the model
    const cacheOnReadPath = readConns.some((cn) => {
      const cache = m.components.find((c) => c.id === cn.from);
      return cache?.kind === "cache";
    });
    const asyncRead = readConns.some((cn) => cn.kind !== "sync");
    if (writeConns.length === 0) {
      return { contractId: cc.id, requirementId: cc.requirementId, entityId: cc.entityId, operationId: cc.operationId,
        promised: "immediate read-after-write", verdict: "unknown",
        detail: "no synchronous write path to the authoritative store is declared — the guarantee cannot be established",
        evidence };
    }
    if (cacheOnReadPath || asyncRead) {
      return { contractId: cc.id, requirementId: cc.requirementId, entityId: cc.entityId, operationId: cc.operationId,
        promised: "immediate read-after-write", verdict: "violated",
        detail: cacheOnReadPath
          ? "the read path crosses a TTL cache: a read right after a write may observe the pre-write value for up to the TTL"
          : "the read path is asynchronous: the write may not be visible immediately",
        evidence: [...evidence, ...(cacheOnReadPath ? readConns.filter((cn) => m.components.find((c) => c.id === cn.from)?.kind === "cache").map((cn) => `connection:${cn.id}`) : [])] };
    }
    return { contractId: cc.id, requirementId: cc.requirementId, entityId: cc.entityId, operationId: cc.operationId,
      promised: "immediate read-after-write", verdict: "satisfied",
      detail: "reads and writes both hit the authoritative store synchronously",
      evidence };
  }

  // eventual: staleness bound must be plausible vs the async path, and at least
  // one delivery path must exist
  if (readConns.length === 0 && writeConns.length === 0) {
    return { contractId: cc.id, requirementId: cc.requirementId, entityId: cc.entityId, operationId: cc.operationId,
      promised: "eventual", verdict: "unknown", detail: "no read or write path is declared for this entity", evidence };
  }
  return { contractId: cc.id, requirementId: cc.requirementId, entityId: cc.entityId, operationId: cc.operationId,
    promised: `eventual${cc.maxStalenessSec ? ` (<= ${cc.maxStalenessSec}s staleness)` : ""}`,
    verdict: "satisfied",
    detail: "eventual consistency is compatible with the declared asynchronous/event paths; the staleness bound itself cannot be verified without timing measurements",
    evidence };
}

export function analyzeConsistency(m: ArchitectureModel): { checks: ContractCheck[]; findings: Finding[] } {
  const checks = (m.consistencyContracts ?? []).map((cc) => checkContract(m, cc));
  const findings: Finding[] = checks.map((c) => finding(
    "consistency", `consistency:${c.contractId}`,
    c.verdict === "violated" ? "critical" : c.verdict === "unknown" ? "warning" : "info",
    `Consistency contract ${c.contractId}: ${c.verdict}`,
    c.detail,
    c.evidence.map((e) => ({ ref: e, detail: `contract promises ${c.promised}` })),
  ));
  return { checks, findings };
}

/**
 * Task 16.4 — a modeled write/read timeline for a contract, showing when a
 * stale observation occurs (cache TTL window), and reconciliation afterwards.
 */
export function consistencyTimeline(m: ArchitectureModel, contractId: string, ttlSec: number): ConsistencyTimelineEvent[] {
  const cc = (m.consistencyContracts ?? []).find((c) => c.id === contractId);
  if (!cc) return [];
  const entity = m.dataEntities.find((d) => d.id === cc.entityId);
  const events: ConsistencyTimelineEvent[] = [];
  events.push({ t: 0, actor: "writer", action: "write committed to authoritative store",
    observed: "new value", stale: false, note: "write is durable at the owner" });
  const readConns = m.connections.filter((cn) =>
    (cn.access === "read" || cn.access === "readwrite") && cn.to === entity?.ownerComponentId);
  const cache = readConns.map((cn) => m.components.find((c) => c.id === cn.from)).find((c) => c?.kind === "cache");
  if (cache) {
    events.push({ t: 1, actor: cache.id, action: "read served from cache",
      observed: "pre-write value", stale: true, note: `stale for up to TTL (${ttlSec}s) unless invalidated` });
    events.push({ t: ttlSec, actor: cache.id, action: "TTL expiry -> cache miss -> read-through",
      observed: "new value", stale: false, note: "reconciled: cache converges to the authoritative store" });
  } else {
    events.push({ t: 1, actor: "reader", action: "read from authoritative store",
      observed: "new value", stale: false, note: "no cache on the path: no staleness window" });
  }
  return events;
}
