/**
 * Campaign 07 — Tasks 26–30: Incident Investigation, Causal Reasoning & Postmortems
 *
 * Provides multi-signal timeline correlation, causal hypothesis synthesis without
 * false certainty, dual blast-radius projection, and verifiable postmortem generation.
 */

import { sha256Sync, canonicalJsonStringify } from "./envelope";
import type { IntendedGraph, ObservedGraph } from "./models";

export type IncidentSeverity = "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
export type IncidentStatus = "investigating" | "identified" | "mitigated" | "resolved";

export interface IncidentTimelineEvent {
  id: string;
  timestampIso: string;
  source: "trace" | "metric" | "log" | "deployment" | "reconciliation";
  service: string;
  summary: string;
  severity: "critical" | "warning" | "info";
  evidenceId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CausalHypothesis {
  id: string;
  candidateCause: string;
  suspectService: string;
  triggerEventId?: string;
  confidence: "CONFIRMED" | "SUPPORTED" | "INFERRED" | "AMBIGUOUS";
  confidenceScore: number; // 0.0 - 1.0
  supportingEvidence: string[];
  contradictingEvidence: string[];
  rationale: string;
  recommendedAction: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startTimeIso: string;
  resolvedTimeIso?: string;
  impactedServices: string[];
  timeline: IncidentTimelineEvent[];
  hypotheses: CausalHypothesis[];
  notes: string[];
}

export interface IncidentPostmortemPackage {
  schemaVersion: "1.0.0";
  packageId: string;
  incidentId: string;
  generatedAt: string;
  severity: IncidentSeverity;
  title: string;
  durationMinutes: number;
  impactedServices: string[];
  timelineSummary: IncidentTimelineEvent[];
  confirmedFindings: string[];
  unresolvedQuestions: string[];
  correctiveActions: string[];
  integrityHash: string; // SHA-256
}

export class IncidentIntelligenceEngine {
  /** Project blast radius comparing Intended vs Observed dependencies */
  public calculateBlastRadius(
    failingService: string,
    intended: IntendedGraph,
    observed: ObservedGraph
  ): {
    intendedImpacted: string[];
    observedImpacted: string[];
    discrepancyNodes: string[];
  } {
    const idToName = new Map<string, string>();
    const nameToId = new Map<string, string>();
    for (const n of [...intended.nodes, ...observed.nodes]) {
      idToName.set(n.id, n.name);
      idToName.set(n.id.replace(/^(?:obs|cfg)-/, ""), n.name);
      nameToId.set(n.name, n.id);
      nameToId.set(n.name.toLowerCase(), n.id);
    }

    const traverse = (start: string, edges: Array<{ sourceId: string; targetId: string }>) => {
      const visited = new Set<string>();
      const visitedNames = new Set<string>();
      const startId = nameToId.get(start) || nameToId.get(start.toLowerCase()) || start;
      const queue = [start, startId, start.replace(/^(?:obs|cfg)-/, "")];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const e of edges) {
          const srcId = e.sourceId;
          const srcClean = e.sourceId.replace(/^(?:obs|cfg)-/, "");
          const srcName = idToName.get(srcId) || idToName.get(srcClean);

          if (curr === srcId || curr === srcClean || (srcName && curr === srcName)) {
            const tgtId = e.targetId;
            const tgtClean = e.targetId.replace(/^(?:obs|cfg)-/, "");
            const tgtName = idToName.get(tgtId) || idToName.get(tgtClean) || tgtClean;

            if (!visited.has(tgtId) && !visitedNames.has(tgtName)) {
              visited.add(tgtId);
              visitedNames.add(tgtName);
              queue.push(tgtId);
            }
          }
        }
      }
      return Array.from(visitedNames);
    };

    const cleanFailing = failingService.replace(/^(?:obs|cfg)-/, "");
    const intendedImpacted = traverse(cleanFailing, intended.edges);
    const observedImpacted = traverse(cleanFailing, observed.edges);

    const discrepancyNodes = observedImpacted.filter((n) => !intendedImpacted.includes(n));

    return {
      intendedImpacted,
      observedImpacted,
      discrepancyNodes,
    };
  }

  /** Correlate multi-signal telemetry events into an aligned chronological timeline */
  public correlateTimeline(events: IncidentTimelineEvent[]): IncidentTimelineEvent[] {
    return [...events].sort(
      (a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()
    );
  }

  /** Synthesize causal hypotheses from correlated events and drift records */
  public synthesizeHypotheses(
    events: IncidentTimelineEvent[],
    driftFindings: Array<{ sourceService: string; severityRationale: string; severity: string }>
  ): CausalHypothesis[] {
    const hypotheses: CausalHypothesis[] = [];
    let idx = 1;

    // Check 1: Deployment followed immediately by error spikes
    const deploymentEvents = events.filter((e) => e.source === "deployment");
    for (const dep of deploymentEvents) {
      const depTime = new Date(dep.timestampIso).getTime();
      const downstreamErrors = events.filter(
        (e) =>
          e.severity === "critical" &&
          new Date(e.timestampIso).getTime() >= depTime &&
          new Date(e.timestampIso).getTime() <= depTime + 10 * 60 * 1000 // within 10 mins
      );

      if (downstreamErrors.length > 0) {
        hypotheses.push({
          id: `hypo-${idx++}`,
          candidateCause: `Deployment of "${dep.service}" triggered error cascade in ${downstreamErrors.map((e) => e.service).join(", ")}`,
          suspectService: dep.service,
          triggerEventId: dep.id,
          confidence: downstreamErrors.length >= 1 ? "SUPPORTED" : "INFERRED",
          confidenceScore: downstreamErrors.length >= 2 ? 0.85 : 0.7,
          supportingEvidence: [
            `Deployment event "${dep.summary}" at ${dep.timestampIso}`,
            `${downstreamErrors.length} critical error event(s) observed within 10 minutes`,
          ],
          contradictingEvidence: [],
          rationale: `Temporal alignment: deployment occurred at ${dep.timestampIso}, followed by errors starting at ${downstreamErrors[0].timestampIso}`,
          recommendedAction: `Inspect deployment diff or roll back "${dep.service}" to previous stable version.`,
        });
      }
    }

    // Check 2: Undocumented runtime drift creating bottleneck or failure
    for (const drift of driftFindings) {
      if (drift.severity === "critical" || drift.severity === "high") {
        hypotheses.push({
          id: `hypo-${idx++}`,
          candidateCause: `Undocumented runtime dependency on "${drift.sourceService}" bypassed capacity limits`,
          suspectService: drift.sourceService,
          confidence: "SUPPORTED",
          confidenceScore: 0.8,
          supportingEvidence: [
            `Architecture drift finding: ${drift.severityRationale}`,
          ],
          contradictingEvidence: [],
          rationale: `Service "${drift.sourceService}" participates in unarchitected calls during degradation window.`,
          recommendedAction: `Verify if direct calls to "${drift.sourceService}" overload downstream database connections.`,
        });
      }
    }

    // Fallback if no hypotheses could be confirmed
    if (hypotheses.length === 0 && events.length > 0) {
      const earliestError = events.find((e) => e.severity === "critical");
      if (earliestError) {
        hypotheses.push({
          id: `hypo-${idx++}`,
          candidateCause: `Initial failure in "${earliestError.service}"`,
          suspectService: earliestError.service,
          triggerEventId: earliestError.id,
          confidence: "AMBIGUOUS",
          confidenceScore: 0.45,
          supportingEvidence: [`Earliest error logged by "${earliestError.service}": ${earliestError.summary}`],
          contradictingEvidence: ["No correlated deployment or configuration event observed prior to failure"],
          rationale: "Earliest recorded failure signal in active window.",
          recommendedAction: "Check internal service logs and database connection pool metrics.",
        });
      }
    }

    return hypotheses;
  }

  /** Generate an immutable postmortem report package */
  public generatePostmortem(
    incident: IncidentRecord,
    confirmedFindings: string[],
    unresolvedQuestions: string[],
    correctiveActions: string[]
  ): IncidentPostmortemPackage {
    const generatedAt = new Date().toISOString();
    const startMs = new Date(incident.startTimeIso).getTime();
    const endMs = incident.resolvedTimeIso ? new Date(incident.resolvedTimeIso).getTime() : Date.now();
    const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

    const partial = {
      schemaVersion: "1.0.0" as const,
      packageId: `postmortem-${incident.id}-${Date.now()}`,
      incidentId: incident.id,
      generatedAt,
      severity: incident.severity,
      title: incident.title,
      durationMinutes,
      impactedServices: incident.impactedServices,
      timelineSummary: incident.timeline.slice(0, 20),
      confirmedFindings,
      unresolvedQuestions,
      correctiveActions,
    };

    const integrityHash = sha256Sync(canonicalJsonStringify(partial));

    return {
      ...partial,
      integrityHash,
    };
  }
}
