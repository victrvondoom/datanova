/**
 * Campaign 07 — Task 09: Structured Log & Event Ingestion
 *
 * Ingests JSON log streams, normalizes severity, timestamps, and service identity,
 * extracts trace correlation IDs, and sanitizes sensitive fields.
 */

import { createEvidenceEnvelope, type OperationalEvidenceEnvelope } from "../envelope";
import { IngestionGovernance } from "../governance";
import type { RealityConnector, IngestionContext, IngestionResult } from "./registry";

export interface StructuredLogEntry {
  timestampIso: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  attributes: Record<string, unknown>;
}

export class StructuredLogConnector implements RealityConnector {
  public readonly id = "structured-logs";
  public readonly name = "Structured JSON Logs & Events";
  public readonly version = "1.0.0";
  public readonly supportedFormats = ["application/json", "application/x-ndjson", "text/plain"];
  public readonly capabilities = {
    canStream: true,
    canBatch: true,
    supportsIncremental: true,
    readOnly: true as const,
  };

  private governance = new IngestionGovernance();

  public parse(content: string, context: IngestionContext): IngestionResult {
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const logs: StructuredLogEntry[] = [];
    const errors: Array<{ code: string; message: string; line?: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      try {
        const parsed = JSON.parse(line);
        logs.push(this.normalizeLog(parsed));
      } catch (err) {
        errors.push({
          code: "LOG_JSON_PARSE_ERROR",
          message: err instanceof Error ? err.message : String(err),
          line: i + 1,
        });
      }
    }

    const envelopes: OperationalEvidenceEnvelope[] = [];
    for (const log of logs) {
      const sanitizedMessage = this.governance.redactText(log.message);
      const sanitizedAttrs = this.governance.redactObject(log.attributes);

      const env = createEvidenceEnvelope({
        evidenceId: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        workspaceId: context.workspaceId,
        sourceSystem: "structured-logs",
        sourceType: "log",
        sourceVersion: "1.0.0",
        sourceResourceId: `${log.service}/log`,
        observedTime: log.timestampIso,
        serviceIdentity: log.service,
        environment: context.environment,
        traceId: log.traceId,
        spanId: log.spanId,
        measurementName: "log_severity",
        measurementValue: log.level === "ERROR" || log.level === "FATAL" ? 1 : 0,
        unit: "event",
        dataClassification: context.classification || "internal",
        provenanceReferences: log.traceId ? [`trace:${log.traceId}`] : [],
        qualityStatus: context.isSynthetic ? "synthetic" : "valid",
        resourceAttributes: {
          "log.level": log.level,
          "log.message": sanitizedMessage.slice(0, 500),
          ...(typeof sanitizedAttrs === "object" && sanitizedAttrs !== null
            ? Object.fromEntries(
                Object.entries(sanitizedAttrs as Record<string, unknown>).map(([k, v]) => [
                  k,
                  typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean),
                ])
              )
            : {}),
        },
        rawPayload: {
          level: log.level,
          message: sanitizedMessage,
        },
      });
      envelopes.push(env);
    }

    return {
      connectorId: this.id,
      sourceSystem: "structured-logs",
      itemsProcessed: lines.length,
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

  private normalizeLog(raw: Record<string, unknown>): StructuredLogEntry {
    const rawTime = raw.timestamp || raw.time || raw["@timestamp"] || new Date().toISOString();
    const timestampIso = !isNaN(Date.parse(String(rawTime))) ? new Date(String(rawTime)).toISOString() : new Date().toISOString();

    const rawLevel = String(raw.level || raw.severity || "INFO").toUpperCase();
    const level: StructuredLogEntry["level"] =
      rawLevel.startsWith("ERR") ? "ERROR"
      : rawLevel.startsWith("WARN") ? "WARN"
      : rawLevel.startsWith("FATAL") ? "FATAL"
      : rawLevel.startsWith("DEBUG") ? "DEBUG"
      : "INFO";

    const service = String(raw.service || raw.service_name || raw.app || raw.component || "unknown-service");
    const message = String(raw.message || raw.msg || raw.log || "");

    const traceId = raw.traceId || raw.trace_id ? String(raw.traceId || raw.trace_id) : undefined;
    const spanId = raw.spanId || raw.span_id ? String(raw.spanId || raw.span_id) : undefined;

    return {
      timestampIso,
      level,
      service,
      message,
      traceId,
      spanId,
      attributes: raw,
    };
  }
}
