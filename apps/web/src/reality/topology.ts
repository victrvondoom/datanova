/**
 * Campaign 07 — Task 12: Runtime Topology Reconstruction
 *
 * Reconstructs the observed service communication graph from distributed
 * trace parent-child span relationships and metric flows.
 */

import type { OperationalEvidenceEnvelope } from "./envelope";
import type { ObservedGraph, OperationalNode, OperationalEdge } from "./models";

export interface SpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  name: string;
  durationMs: number;
  statusCode: "OK" | "ERROR" | "UNSET";
  startTimeIso?: string;
  timestampIso?: string;
  peerService?: string;
}

export class RuntimeTopologyBuilder {
  /** Reconstruct ObservedGraph from an array of trace envelopes */
  public buildFromEnvelopes(
    envelopes: OperationalEvidenceEnvelope[],
    windowStart?: string,
    windowEnd?: string
  ): ObservedGraph {
    const traceEnvelopes = envelopes.filter((e) => e.sourceType === "trace");
    const spans: SpanRecord[] = traceEnvelopes.map((e) => {
      const attrs = e.resourceAttributes || {};
      return {
        traceId: e.traceId || "",
        spanId: e.spanId || "",
        parentSpanId: e.parentSpanId,
        serviceName: e.serviceIdentity || "unknown-service",
        name: e.sourceResourceId || "operation",
        durationMs: Number(e.measurementValue || 10),
        statusCode: attrs["span.status"] === "ERROR" ? "ERROR" : "OK",
        timestampIso: e.observedTime,
        peerService: attrs["peer.service"] ? String(attrs["peer.service"]) : undefined,
      };
    });

    return this.buildFromSpans(spans, windowStart, windowEnd);
  }

  /** Reconstruct ObservedGraph from normalized spans */
  public buildFromSpans(
    spans: SpanRecord[],
    windowStart?: string,
    windowEnd?: string
  ): ObservedGraph {
    const spanMap = new Map<string, SpanRecord>();
    const serviceSet = new Set<string>();
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const s of spans) {
      if (s.spanId) spanMap.set(s.spanId, s);
      if (s.serviceName) serviceSet.add(s.serviceName);

      const timeStr = s.startTimeIso || s.timestampIso || new Date().toISOString();
      const t = new Date(timeStr).getTime();
      if (!isNaN(t)) {
        if (t < minTime) minTime = t;
        if (t > maxTime) maxTime = t;
      }
    }

    const actualWindowStart = windowStart || (minTime !== Infinity ? new Date(minTime).toISOString() : new Date().toISOString());
    const actualWindowEnd = windowEnd || (maxTime !== -Infinity ? new Date(maxTime).toISOString() : new Date().toISOString());

    // Aggregate directed calls between services
    interface EdgeAgg {
      source: string;
      target: string;
      callCount: number;
      errorCount: number;
      durations: number[];
      firstObserved: string;
      lastObserved: string;
    }
    const edgeAggs = new Map<string, EdgeAgg>();

    const recordCall = (src: string, tgt: string, duration: number, isError: boolean, timeIso: string) => {
      if (!src || !tgt || src === tgt) return; // ignore intra-service calls for inter-service topology
      const key = `${src}->${tgt}`;
      let agg = edgeAggs.get(key);
      if (!agg) {
        agg = {
          source: src,
          target: tgt,
          callCount: 0,
          errorCount: 0,
          durations: [],
          firstObserved: timeIso,
          lastObserved: timeIso,
        };
        edgeAggs.set(key, agg);
      }
      agg.callCount++;
      if (isError) agg.errorCount++;
      agg.durations.push(duration);
      if (new Date(timeIso) > new Date(agg.lastObserved)) agg.lastObserved = timeIso;
      if (new Date(timeIso) < new Date(agg.firstObserved)) agg.firstObserved = timeIso;
    };

    // Method 1: Parent-child relationship across different services
    for (const span of spans) {
      const timeIso = span.startTimeIso || span.timestampIso || new Date().toISOString();
      if (span.parentSpanId) {
        const parentSpan = spanMap.get(span.parentSpanId);
        if (parentSpan && parentSpan.serviceName !== span.serviceName) {
          recordCall(
            parentSpan.serviceName,
            span.serviceName,
            span.durationMs,
            span.statusCode === "ERROR",
            timeIso
          );
        }
      }

      // Method 2: Explicit peer.service on client span
      if (span.peerService && span.peerService !== span.serviceName) {
        recordCall(
          span.serviceName,
          span.peerService,
          span.durationMs,
          span.statusCode === "ERROR",
          timeIso
        );
      }
    }

    // Build OperationalNodes
    const nodes: OperationalNode[] = Array.from(serviceSet).map((name) => ({
      id: `obs-${name}`,
      name,
      kind: name.includes("db") || name.includes("postgres") ? "database"
        : name.includes("queue") || name.includes("mq") ? "queue"
        : name.includes("gateway") ? "gateway"
        : "service",
      environment: "runtime",
      provenance: {
        sourceSystem: "opentelemetry",
        sourceType: "traces",
        sourceResourceId: name,
        evidenceIds: [],
        observedAt: actualWindowEnd,
        confidence: "CONFIRMED",
      },
    }));

    // Build OperationalEdges
    const edges: OperationalEdge[] = Array.from(edgeAggs.values()).map((agg, idx) => {
      agg.durations.sort((a, b) => a - b);
      const p95Idx = Math.floor(agg.durations.length * 0.95);
      const p95LatencyMs = agg.durations[p95Idx] || agg.durations[agg.durations.length - 1] || 10;

      return {
        id: `obs-edge-${idx + 1}`,
        sourceId: `obs-${agg.source}`,
        targetId: `obs-${agg.target}`,
        relationshipType: "OBSERVED_CALL",
        confidence: "CONFIRMED",
        callCount: agg.callCount,
        errorCount: agg.errorCount,
        p95LatencyMs: Math.round(p95LatencyMs * 10) / 10,
        evidenceIds: [],
        firstObservedAt: agg.firstObserved,
        lastObservedAt: agg.lastObserved,
      };
    });

    return {
      view: "OBSERVED",
      windowStart: actualWindowStart,
      windowEnd: actualWindowEnd,
      nodes,
      edges,
      spanCount: spans.length,
      updatedAt: new Date().toISOString(),
    };
  }
}
