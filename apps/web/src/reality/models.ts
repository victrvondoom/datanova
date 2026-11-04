/**
 * Campaign 07 — Task 03: Multi-View Sovereign Graph Model
 *
 * Defines Intended, Configured, Observed, and Derived views,
 * canonical operational relationships, and explicit evidence confidence states.
 */

import type { ArchitectureModel } from "../lab/model";

export type OperationalRelationshipType =
  | "INTENDED_DEPENDENCY"
  | "CONFIGURED_DEPENDENCY"
  | "OBSERVED_CALL"
  | "OBSERVED_EVENT"
  | "DATA_FLOW"
  | "DEPLOYMENT_OWNERSHIP"
  | "RESOURCE_CONTAINMENT"
  | "CAUSAL_HYPOTHESIS";

export type EvidenceConfidenceState =
  | "CONFIRMED"
  | "SUPPORTED"
  | "INFERRED"
  | "AMBIGUOUS"
  | "CONFLICTING"
  | "STALE"
  | "MISSING_EVIDENCE"
  | "SYNTHETIC_ONLY";

export interface GraphNodeProvenance {
  sourceSystem: string;
  sourceType: string;
  sourceResourceId: string;
  evidenceIds: string[];
  observedAt: string;
  confidence: EvidenceConfidenceState;
}

export interface OperationalNode {
  id: string;
  name: string;
  kind: "service" | "database" | "queue" | "gateway" | "pod" | "deployment" | "external";
  environment: string;
  zone?: string;
  metadata?: Record<string, string | number | boolean>;
  provenance: GraphNodeProvenance;
}

export interface OperationalEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: OperationalRelationshipType;
  confidence: EvidenceConfidenceState;
  protocol?: string;
  port?: number;
  callCount?: number;
  p95LatencyMs?: number;
  errorCount?: number;
  evidenceIds: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface IntendedGraph {
  view: "INTENDED";
  architectureId: string;
  version: number;
  nodes: OperationalNode[];
  edges: OperationalEdge[];
  updatedAt: string;
}

export interface ConfiguredGraph {
  view: "CONFIGURED";
  sourceManifests: string[];
  nodes: OperationalNode[];
  edges: OperationalEdge[];
  updatedAt: string;
}

export interface ObservedGraph {
  view: "OBSERVED";
  windowStart: string;
  windowEnd: string;
  nodes: OperationalNode[];
  edges: OperationalEdge[];
  spanCount: number;
  updatedAt: string;
}

export interface DerivedGraph {
  view: "DERIVED";
  intendedVersion: number;
  reconciliationTime: string;
  nodes: (OperationalNode & {
    intendedMatchId?: string;
    configuredMatchId?: string;
    observedMatchId?: string;
    status: "matched" | "unmatched" | "ambiguous" | "shadow";
  })[];
  edges: (OperationalEdge & {
    divergenceStatus: "aligned" | "undocumented" | "unobserved" | "contract_drift";
  })[];
  driftCount: number;
}

/** Convert a canonical ArchitectureModel into an IntendedGraph */
export function modelToIntendedGraph(model: ArchitectureModel, version = 1): IntendedGraph {
  const nodes: OperationalNode[] = model.components.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind === "database" || c.kind === "objectstore" ? "database"
      : c.kind === "queue" || c.kind === "broker" ? "queue"
      : c.kind === "gateway" ? "gateway"
      : "service",
    environment: "production",
    zone: c.zoneId,
    metadata: {
      criticality: Number(c.config?.criticality || 1),
      group: String(c.config?.group || ""),
    },
    provenance: {
      sourceSystem: "datanova-atlas",
      sourceType: "architecture-model",
      sourceResourceId: c.id,
      evidenceIds: [],
      observedAt: new Date().toISOString(),
      confidence: "CONFIRMED",
    },
  }));

  const edges: OperationalEdge[] = model.connections.map((conn) => ({
    id: conn.id,
    sourceId: conn.from,
    targetId: conn.to,
    relationshipType: "INTENDED_DEPENDENCY",
    confidence: "CONFIRMED",
    callCount: 0,
    evidenceIds: [],
    firstObservedAt: new Date().toISOString(),
    lastObservedAt: new Date().toISOString(),
    metadata: {
      kind: conn.kind || "sync",
      criticality: conn.criticality || 1,
      failureBehavior: conn.failureBehavior || "blocks",
    },
  }));

  return {
    view: "INTENDED",
    architectureId: model.id,
    version,
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}
