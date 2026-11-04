/**
 * Campaign 07 — Task 13: Three-Way Architecture Reconciliation Engine
 *
 * Joins Intended Architecture, Configured Infrastructure, and Observed Runtime
 * to detect undocumented dependencies, unobserved relationships, shadow deployments,
 * and architectural drift with transparent evidence trails.
 */

import { IdentityResolver } from "./identity";
import type { IntendedGraph, ConfiguredGraph, ObservedGraph, DerivedGraph } from "./models";

export type DriftClassification =
  | "topology"
  | "resource_config"
  | "network_dependency"
  | "api_contract"
  | "security_boundary"
  | "workload"
  | "data_flow"
  | "stale_documentation";

export type DriftSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface ReconciliationRecord {
  id: string;
  architectureVersion: number;
  driftClassification: DriftClassification;
  severity: DriftSeverity;
  severityRationale: string;
  sourceService: string;
  targetService?: string;
  intendedStatus: "present" | "absent";
  configuredStatus: "present" | "absent";
  observedStatus: "present" | "absent";
  confidenceCategory: "CONFIRMED" | "SUPPORTED" | "INFERRED" | "AMBIGUOUS" | "CONFLICTING" | "STALE" | "SYNTHETIC_ONLY";
  affectedNodes: string[];
  affectedEdges: string[];
  timeWindow: {
    start: string;
    end: string;
  };
  evidenceReferences: string[];
  humanReviewStatus: "unreviewed" | "acknowledged" | "investigating" | "resolved" | "rejected" | "accepted_as_intended";
  resolutionNote?: string;
}

export class ArchitectureReconciler {
  constructor(private identityResolver = new IdentityResolver()) {}

  /** Perform three-way reconciliation */
  public reconcile(
    intended: IntendedGraph,
    configured: ConfiguredGraph,
    observed: ObservedGraph
  ): { derived: DerivedGraph; records: ReconciliationRecord[] } {
    const records: ReconciliationRecord[] = [];
    const derivedNodes: DerivedGraph["nodes"] = [];
    const derivedEdges: DerivedGraph["edges"] = [];

    const declaredNodes = intended.nodes.map((n) => ({ id: n.id, name: n.name }));
    const timeWindow = { start: observed.windowStart, end: observed.windowEnd };

    // 1. Resolve Configured resources against Intended nodes
    const configuredMatches = new Map<string, string>(); // cfgNodeId -> intendedNodeId
    for (const cNode of configured.nodes) {
      const match = this.identityResolver.resolveOne(cNode.name, declaredNodes);
      if (match.matchedNodeId) {
        configuredMatches.set(cNode.id, match.matchedNodeId);
      }
    }

    // 2. Resolve Observed services against Intended nodes
    const observedMatches = new Map<string, string>(); // obsNodeId -> intendedNodeId
    for (const oNode of observed.nodes) {
      const match = this.identityResolver.resolveOne(oNode.name, declaredNodes);
      if (match.matchedNodeId) {
        observedMatches.set(oNode.id, match.matchedNodeId);
      }
    }

    // 3. Node Reconciliation: Compare Intended nodes with Configured & Observed
    const configuredMatchedNodeIds = new Set(Array.from(configuredMatches.values()));
    const observedMatchedNodeIds = new Set(Array.from(observedMatches.values()));

    for (const iNode of intended.nodes) {
      const hasConfig = configuredMatchedNodeIds.has(iNode.id);
      const hasObserved = observedMatchedNodeIds.has(iNode.id);

      let status: "matched" | "unmatched" | "ambiguous" | "shadow" = "matched";
      if (!hasConfig && !hasObserved) {
        status = "unmatched";
        records.push({
          id: `drift-node-undeployed-${iNode.id}`,
          architectureVersion: intended.version,
          driftClassification: "resource_config",
          severity: iNode.metadata?.criticality === 5 ? "critical" : "high",
          severityRationale: `Component "${iNode.name}" is declared in architecture but neither configured nor observed in runtime.`,
          sourceService: iNode.name,
          intendedStatus: "present",
          configuredStatus: "absent",
          observedStatus: "absent",
          confidenceCategory: "CONFIRMED",
          affectedNodes: [iNode.id],
          affectedEdges: [],
          timeWindow,
          evidenceReferences: [iNode.provenance.sourceResourceId],
          humanReviewStatus: "unreviewed",
        });
      } else if (hasConfig && !hasObserved) {
        records.push({
          id: `drift-node-unobserved-${iNode.id}`,
          architectureVersion: intended.version,
          driftClassification: "stale_documentation",
          severity: "medium",
          severityRationale: `Component "${iNode.name}" is configured in infrastructure but has zero observed runtime traffic.`,
          sourceService: iNode.name,
          intendedStatus: "present",
          configuredStatus: "present",
          observedStatus: "absent",
          confidenceCategory: "SUPPORTED",
          affectedNodes: [iNode.id],
          affectedEdges: [],
          timeWindow,
          evidenceReferences: [iNode.provenance.sourceResourceId],
          humanReviewStatus: "unreviewed",
        });
      }

      derivedNodes.push({
        ...iNode,
        intendedMatchId: iNode.id,
        configuredMatchId: Array.from(configuredMatches.entries()).find(([, iId]) => iId === iNode.id)?.[0],
        observedMatchId: Array.from(observedMatches.entries()).find(([, iId]) => iId === iNode.id)?.[0],
        status,
      });
    }

    // 4. Check for Unarchitected Observed Nodes (Shadow / Undocumented services)
    for (const oNode of observed.nodes) {
      const match = this.identityResolver.resolveOne(oNode.name, declaredNodes);
      if (!match.matchedNodeId) {
        records.push({
          id: `drift-node-shadow-${oNode.name}`,
          architectureVersion: intended.version,
          driftClassification: "topology",
          severity: "high",
          severityRationale: `Observed active runtime service "${oNode.name}" does not exist in canonical architecture.`,
          sourceService: oNode.name,
          intendedStatus: "absent",
          configuredStatus: configured.nodes.some((c) => c.name.toLowerCase() === oNode.name.toLowerCase()) ? "present" : "absent",
          observedStatus: "present",
          confidenceCategory: "CONFIRMED",
          affectedNodes: [oNode.id],
          affectedEdges: [],
          timeWindow,
          evidenceReferences: oNode.provenance.evidenceIds,
          humanReviewStatus: "unreviewed",
        });

        derivedNodes.push({
          ...oNode,
          observedMatchId: oNode.id,
          status: "shadow",
        });
      }
    }

    // 5. Edge Reconciliation: Build Intended Edge Map
    const intendedEdgeKeys = new Set<string>(); // "sourceId->targetId"
    for (const iEdge of intended.edges) {
      intendedEdgeKeys.add(`${iEdge.sourceId}->${iEdge.targetId}`);
    }

    // Map each observed edge to intended IDs
    const observedEdgePairs = new Set<string>();
    for (const oEdge of observed.edges) {
      const srcObsName = oEdge.sourceId.replace(/^obs-/, "");
      const tgtObsName = oEdge.targetId.replace(/^obs-/, "");

      const srcMatch = this.identityResolver.resolveOne(srcObsName, declaredNodes);
      const tgtMatch = this.identityResolver.resolveOne(tgtObsName, declaredNodes);

      const srcId = srcMatch.matchedNodeId || oEdge.sourceId;
      const tgtId = tgtMatch.matchedNodeId || oEdge.targetId;
      const canonicalKey = `${srcId}->${tgtId}`;
      observedEdgePairs.add(canonicalKey);

      const isIntended = intendedEdgeKeys.has(canonicalKey);

      if (!isIntended) {
        // Undocumented Dependency Detected! (Section 8 Mandatory Demonstration)
        const severity: DriftSeverity = !srcMatch.matchedNodeId || !tgtMatch.matchedNodeId ? "critical" : "high";

        records.push({
          id: `drift-edge-undocumented-${srcObsName}->${tgtObsName}`,
          architectureVersion: intended.version,
          driftClassification: "network_dependency",
          severity,
          severityRationale: `Observed runtime call path "${srcObsName}" -> "${tgtObsName}" (${oEdge.callCount || 1} calls, ${oEdge.p95LatencyMs || 10}ms p95) is NOT documented in architecture intent.`,
          sourceService: srcObsName,
          targetService: tgtObsName,
          intendedStatus: "absent",
          configuredStatus: configured.edges.some((c) => c.sourceId.includes(srcObsName) && c.targetId.includes(tgtObsName)) ? "present" : "absent",
          observedStatus: "present",
          confidenceCategory: "CONFIRMED",
          affectedNodes: [srcId, tgtId],
          affectedEdges: [oEdge.id],
          timeWindow,
          evidenceReferences: oEdge.evidenceIds,
          humanReviewStatus: "unreviewed",
        });

        derivedEdges.push({
          ...oEdge,
          sourceId: srcId,
          targetId: tgtId,
          divergenceStatus: "undocumented",
        });
      } else {
        derivedEdges.push({
          ...oEdge,
          sourceId: srcId,
          targetId: tgtId,
          divergenceStatus: "aligned",
        });
      }
    }

    // 6. Check for Intended Edges that were Never Observed
    for (const iEdge of intended.edges) {
      const key = `${iEdge.sourceId}->${iEdge.targetId}`;
      if (!observedEdgePairs.has(key)) {
        const srcNode = intended.nodes.find((n) => n.id === iEdge.sourceId);
        const tgtNode = intended.nodes.find((n) => n.id === iEdge.targetId);

        records.push({
          id: `drift-edge-unobserved-${iEdge.id}`,
          architectureVersion: intended.version,
          driftClassification: "stale_documentation",
          severity: "low",
          severityRationale: `Documented architecture edge "${srcNode?.name || iEdge.sourceId}" -> "${tgtNode?.name || iEdge.targetId}" had zero observable runtime calls in the telemetry window.`,
          sourceService: srcNode?.name || iEdge.sourceId,
          targetService: tgtNode?.name || iEdge.targetId,
          intendedStatus: "present",
          configuredStatus: "present",
          observedStatus: "absent",
          confidenceCategory: "STALE",
          affectedNodes: [iEdge.sourceId, iEdge.targetId],
          affectedEdges: [iEdge.id],
          timeWindow,
          evidenceReferences: iEdge.evidenceIds,
          humanReviewStatus: "unreviewed",
        });

        derivedEdges.push({
          ...iEdge,
          divergenceStatus: "unobserved",
        });
      }
    }

    const derived: DerivedGraph = {
      view: "DERIVED",
      intendedVersion: intended.version,
      reconciliationTime: new Date().toISOString(),
      nodes: derivedNodes,
      edges: derivedEdges,
      driftCount: records.length,
    };

    return { derived, records };
  }
}
