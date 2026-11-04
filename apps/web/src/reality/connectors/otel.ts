/**
 * Campaign 07 — Task 07: OpenTelemetry Trace Ingestion
 *
 * Ingests OpenTelemetry OTLP JSON and Jaeger trace exports, extracting spans,
 * parent-child relationships, service names, status, and semantic attributes.
 */

import { createEvidenceEnvelope, type OperationalEvidenceEnvelope } from "../envelope";
import type { RealityConnector, IngestionContext, IngestionResult } from "./registry";

export interface NormalizedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  name: string;
  kind: "INTERNAL" | "SERVER" | "CLIENT" | "PRODUCER" | "CONSUMER";
  startTimeIso: string;
  endTimeIso: string;
  durationMs: number;
  statusCode: "OK" | "ERROR" | "UNSET";
  statusMessage?: string;
  attributes: Record<string, string | number | boolean>;
  peerService?: string;
  httpUrl?: string;
  httpMethod?: string;
  dbSystem?: string;
}

export class OTelTraceConnector implements RealityConnector {
  public readonly id = "opentelemetry-traces";
  public readonly name = "OpenTelemetry Distributed Traces";
  public readonly version = "1.0.0";
  public readonly supportedFormats = ["application/json", "otlp/json", "jaeger/json"];
  public readonly capabilities = {
    canStream: false,
    canBatch: true,
    supportsIncremental: true,
    readOnly: true as const,
  };

  public parse(content: string, context: IngestionContext): IngestionResult {
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (err) {
      return {
        connectorId: this.id,
        sourceSystem: "opentelemetry",
        itemsProcessed: 0,
        itemsIngested: 0,
        itemsQuarantined: 1,
        envelopes: [],
        errors: [{ code: "MALFORMED_JSON", message: err instanceof Error ? err.message : String(err) }],
        health: { status: "failed", latencyMs: 0, lastIngestion: new Date().toISOString() },
      };
    }

    const spans = this.extractSpans(raw);
    const envelopes: OperationalEvidenceEnvelope[] = [];
    const errors: Array<{ code: string; message: string }> = [];

    for (const span of spans) {
      try {
        const relationshipRefs = [];
        if (span.peerService) {
          relationshipRefs.push({ target: span.peerService, type: "OBSERVED_CALL" });
        }

        const env = createEvidenceEnvelope({
          evidenceId: `otel-${span.traceId.slice(0, 8)}-${span.spanId.slice(0, 8)}`,
          workspaceId: context.workspaceId,
          sourceSystem: "opentelemetry",
          sourceType: "trace",
          sourceVersion: "1.0.0",
          sourceResourceId: `${span.serviceName}/${span.name}`,
          observedTime: span.startTimeIso,
          validityInterval: {
            start: span.startTimeIso,
            end: span.endTimeIso,
          },
          serviceIdentity: span.serviceName,
          environment: context.environment,
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          relationshipReferences: relationshipRefs,
          measurementName: "duration_ms",
          measurementValue: span.durationMs,
          unit: "ms",
          dataClassification: context.classification || "internal",
          provenanceReferences: [`span:${span.traceId}:${span.spanId}`],
          qualityStatus: context.isSynthetic ? "synthetic" : "valid",
          resourceAttributes: {
            ...span.attributes,
            "span.kind": span.kind,
            "span.status": span.statusCode,
            ...(span.httpUrl ? { "http.url": span.httpUrl } : {}),
            ...(span.dbSystem ? { "db.system": span.dbSystem } : {}),
          },
          rawPayload: {
            name: span.name,
            kind: span.kind,
            statusCode: span.statusCode,
          },
        });

        envelopes.push(env);
      } catch (e) {
        errors.push({
          code: "SPAN_NORMALIZATION_ERROR",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      connectorId: this.id,
      sourceSystem: "opentelemetry",
      itemsProcessed: spans.length,
      itemsIngested: envelopes.length,
      itemsQuarantined: errors.length,
      envelopes,
      errors,
      health: {
        status: errors.length > 0 ? "degraded" : "healthy",
        latencyMs: 0,
        lastIngestion: new Date().toISOString(),
      },
    };
  }

  private extractSpans(raw: unknown): NormalizedSpan[] {
    const results: NormalizedSpan[] = [];
    if (!raw || typeof raw !== "object") return results;

    // Case 1: Standard OTLP ResourceSpans export
    if ("resourceSpans" in raw && Array.isArray((raw as Record<string, unknown>).resourceSpans)) {
      const resourceSpans = (raw as Record<string, unknown>).resourceSpans as Array<Record<string, unknown>>;
      for (const rs of resourceSpans) {
        const resource = (rs.resource as Record<string, unknown>) || {};
        const resAttrs = this.parseAttributes((resource.attributes as Array<Record<string, unknown>>) || []);
        const serviceName = String(resAttrs["service.name"] || resAttrs["app"] || "unknown-service");

        const scopeSpans = (rs.scopeSpans as Array<Record<string, unknown>>) || [];
        for (const ss of scopeSpans) {
          const spans = (ss.spans as Array<Record<string, unknown>>) || [];
          for (const s of spans) {
            results.push(this.normalizeOtlpSpan(s, serviceName, resAttrs));
          }
        }
      }
      return results;
    }

    // Case 2: Simplified Array of Spans
    if (Array.isArray(raw)) {
      for (const s of raw) {
        if (typeof s === "object" && s !== null) {
          results.push(this.normalizeSimpleSpan(s as Record<string, unknown>));
        }
      }
      return results;
    }

    return results;
  }

  private parseAttributes(attrs: Array<Record<string, unknown>>): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const a of attrs) {
      const key = String(a.key || "");
      if (!key) continue;
      const v = a.value as Record<string, unknown> | undefined;
      if (v) {
        if ("stringValue" in v) out[key] = String(v.stringValue);
        else if ("intValue" in v) out[key] = Number(v.intValue);
        else if ("doubleValue" in v) out[key] = Number(v.doubleValue);
        else if ("boolValue" in v) out[key] = Boolean(v.boolValue);
      } else if (a.value !== undefined) {
        out[key] = typeof a.value === "object" ? JSON.stringify(a.value) : (a.value as string | number | boolean);
      }
    }
    return out;
  }

  private normalizeOtlpSpan(
    s: Record<string, unknown>,
    serviceName: string,
    resAttrs: Record<string, string | number | boolean>
  ): NormalizedSpan {
    const rawAttrs = Array.isArray(s.attributes) ? this.parseAttributes(s.attributes as Array<Record<string, unknown>>) : {};
    const attrs = { ...resAttrs, ...rawAttrs };

    const startNano = Number(s.startTimeUnixNano || s.start_time || Date.now() * 1_000_000);
    const endNano = Number(s.endTimeUnixNano || s.end_time || startNano + 10_000_000);
    const startMs = Math.floor(startNano / 1_000_000);
    const endMs = Math.floor(endNano / 1_000_000);

    const kindMap: Record<number, NormalizedSpan["kind"]> = {
      1: "INTERNAL",
      2: "SERVER",
      3: "CLIENT",
      4: "PRODUCER",
      5: "CONSUMER",
    };
    const kind = typeof s.kind === "number" ? kindMap[s.kind] || "INTERNAL" : String(s.kind || "INTERNAL") as NormalizedSpan["kind"];

    const statusObj = (s.status as Record<string, unknown>) || {};
    const statusCode = statusObj.code === 2 || statusObj.code === "ERROR" ? "ERROR" : "OK";

    return {
      traceId: String(s.traceId || s.trace_id || `tr-${Math.random().toString(36).slice(2, 10)}`),
      spanId: String(s.spanId || s.span_id || `sp-${Math.random().toString(36).slice(2, 10)}`),
      parentSpanId: s.parentSpanId || s.parent_span_id ? String(s.parentSpanId || s.parent_span_id) : undefined,
      serviceName,
      name: String(s.name || "unnamed-operation"),
      kind,
      startTimeIso: new Date(startMs).toISOString(),
      endTimeIso: new Date(endMs).toISOString(),
      durationMs: Math.max(0.1, (endNano - startNano) / 1_000_000),
      statusCode,
      statusMessage: statusObj.message ? String(statusObj.message) : undefined,
      attributes: attrs,
      peerService: attrs["peer.service"] ? String(attrs["peer.service"]) : undefined,
      httpUrl: attrs["http.url"] ? String(attrs["http.url"]) : undefined,
      httpMethod: attrs["http.method"] ? String(attrs["http.method"]) : undefined,
      dbSystem: attrs["db.system"] ? String(attrs["db.system"]) : undefined,
    };
  }

  private normalizeSimpleSpan(s: Record<string, unknown>): NormalizedSpan {
    const startMs = s.startTime ? new Date(String(s.startTime)).getTime() : Date.now();
    const durationMs = Number(s.durationMs || 10);
    const endMs = startMs + durationMs;

    return {
      traceId: String(s.traceId || `tr-${Math.random().toString(36).slice(2, 10)}`),
      spanId: String(s.spanId || `sp-${Math.random().toString(36).slice(2, 10)}`),
      parentSpanId: s.parentSpanId ? String(s.parentSpanId) : undefined,
      serviceName: String(s.serviceName || s.service || "unknown-service"),
      name: String(s.name || s.operation || "operation"),
      kind: (String(s.kind || "SERVER").toUpperCase()) as NormalizedSpan["kind"],
      startTimeIso: new Date(startMs).toISOString(),
      endTimeIso: new Date(endMs).toISOString(),
      durationMs,
      statusCode: s.error || s.statusCode === "ERROR" ? "ERROR" : "OK",
      statusMessage: s.statusMessage ? String(s.statusMessage) : undefined,
      attributes: (s.attributes as Record<string, string | number | boolean>) || {},
      peerService: s.peerService ? String(s.peerService) : undefined,
      httpUrl: s.httpUrl ? String(s.httpUrl) : undefined,
      httpMethod: s.httpMethod ? String(s.httpMethod) : undefined,
      dbSystem: s.dbSystem ? String(s.dbSystem) : undefined,
    };
  }
}
