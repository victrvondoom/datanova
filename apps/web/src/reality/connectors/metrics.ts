/**
 * Campaign 07 — Task 08: Prometheus & OpenMetrics Ingestion
 *
 * Ingests Prometheus text exposition and OpenMetrics sample streams,
 * normalizing metric names, labels, values, and units.
 */

import { createEvidenceEnvelope, type OperationalEvidenceEnvelope } from "../envelope";
import type { RealityConnector, IngestionContext, IngestionResult } from "./registry";

export interface MetricSample {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary" | "untyped";
  help?: string;
  labels: Record<string, string>;
  value: number;
  timestampIso: string;
  unit?: string;
}

export class PrometheusConnector implements RealityConnector {
  public readonly id = "prometheus-metrics";
  public readonly name = "Prometheus / OpenMetrics Ingestion";
  public readonly version = "1.0.0";
  public readonly supportedFormats = ["text/plain", "application/openmetrics-text"];
  public readonly capabilities = {
    canStream: false,
    canBatch: true,
    supportsIncremental: true,
    readOnly: true as const,
  };

  public parse(content: string, context: IngestionContext): IngestionResult {
    const lines = content.split("\n");
    const samples: MetricSample[] = [];
    const errors: Array<{ code: string; message: string; line?: number }> = [];

    let currentHelp: string | undefined;
    let currentType: MetricSample["type"] = "untyped";
    const nowIso = new Date().toISOString();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("# HELP ")) {
        const parts = line.slice(7).split(" ");
        currentHelp = parts.slice(1).join(" ");
        continue;
      }
      if (line.startsWith("# TYPE ")) {
        const parts = line.slice(7).split(" ");
        currentType = (parts[1]?.toLowerCase() as MetricSample["type"]) || "untyped";
        continue;
      }
      if (line.startsWith("#")) continue;

      // Sample line: metric_name{label="val",...} 123.45 [timestamp]
      try {
        const sample = this.parseSampleLine(line, currentType, currentHelp, nowIso);
        if (sample) samples.push(sample);
      } catch (err) {
        errors.push({
          code: "SAMPLE_PARSE_ERROR",
          message: err instanceof Error ? err.message : String(err),
          line: i + 1,
        });
      }
    }

    const envelopes: OperationalEvidenceEnvelope[] = [];
    for (const s of samples) {
      const serviceName = s.labels.service || s.labels.app || s.labels.job || "system";
      const env = createEvidenceEnvelope({
        evidenceId: `prom-${s.name}-${Math.random().toString(36).slice(2, 8)}`,
        workspaceId: context.workspaceId,
        sourceSystem: "prometheus",
        sourceType: "metric",
        sourceVersion: "1.0.0",
        sourceResourceId: `${serviceName}/${s.name}`,
        observedTime: s.timestampIso,
        serviceIdentity: serviceName,
        environment: context.environment,
        measurementName: s.name,
        measurementValue: s.value,
        unit: s.unit || this.guessUnit(s.name),
        dataClassification: context.classification || "internal",
        provenanceReferences: [`prom:${s.name}`],
        qualityStatus: context.isSynthetic ? "synthetic" : "valid",
        resourceAttributes: {
          ...s.labels,
          "metric.type": s.type,
        },
        rawPayload: {
          name: s.name,
          value: s.value,
          labels: s.labels,
        },
      });
      envelopes.push(env);
    }

    return {
      connectorId: this.id,
      sourceSystem: "prometheus",
      itemsProcessed: samples.length + errors.length,
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

  private parseSampleLine(
    line: string,
    type: MetricSample["type"],
    help: string | undefined,
    fallbackTime: string
  ): MetricSample | null {
    // Regex for: name{labels} value timestamp
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([^\s]+)(?:\s+(\d+))?$/);
    if (!match) return null;

    const name = match[1];
    const rawLabels = match[2] || "";
    const value = parseFloat(match[3]);
    const rawTime = match[4];

    if (isNaN(value)) return null;

    const labels: Record<string, string> = {};
    if (rawLabels) {
      const labelMatches = rawLabels.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g);
      for (const m of labelMatches) {
        labels[m[1]] = m[2];
      }
    }

    const timestampIso = rawTime ? new Date(parseInt(rawTime, 10)).toISOString() : fallbackTime;

    return {
      name,
      type,
      help,
      labels,
      value,
      timestampIso,
    };
  }

  private guessUnit(metricName: string): string {
    if (metricName.endsWith("_seconds") || metricName.endsWith("_duration_seconds")) return "s";
    if (metricName.endsWith("_milliseconds") || metricName.endsWith("_ms")) return "ms";
    if (metricName.endsWith("_bytes")) return "bytes";
    if (metricName.endsWith("_total") || metricName.endsWith("_count")) return "count";
    if (metricName.endsWith("_ratio") || metricName.endsWith("_percentage")) return "ratio";
    return "unit";
  }
}
