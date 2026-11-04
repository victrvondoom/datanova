# Campaign 07 — Ingestion Plane & Connector Specification

## 1. Connector Registry Protocol

All connectors implement the standard `RealityConnector` interface:

```typescript
export interface ConnectorConfig {
  connectorId: string;
  name: string;
  version: string;
  supportedFormats: string[];
  capabilities: {
    canStream: boolean;
    canBatch: boolean;
    supportsIncremental: boolean;
    readOnly: true; // Mandatory security invariant
  };
}

export interface IngestionResult {
  connectorId: string;
  itemsProcessed: number;
  itemsIngested: number;
  itemsQuarantined: number;
  envelopes: OperationalEvidenceEnvelope[];
  errors: Array<{ code: string; message: string; line?: number }>;
  health: {
    status: "healthy" | "degraded" | "failed";
    latencyMs: number;
    lastIngestion: string;
  };
}
```

## 2. Supported Ingestion Formats

1. **OpenTelemetry Trace Exporters (`otel.ts`):**
   - Ingests OTLP JSON / Jaeger JSON exports.
   - Extracts `traceId`, `spanId`, `parentSpanId`, `startTimeUnixNano`, `endTimeUnixNano`, `name`, `attributes`, `status`.
   - Normalizes service name from `service.name` or `app` resource attribute.
2. **Prometheus & OpenMetrics (`metrics.ts`):**
   - Ingests Prometheus text exposition and OpenMetrics sample JSON.
   - Parses gauges, counters, histograms (`_bucket`, `_count`, `_sum`).
   - Normalizes metric labels and associates them with resolved service identities.
3. **Structured Logs (`logs.ts`):**
   - Ingests JSON log lines containing `timestamp`, `level`, `service`, `message`, `trace_id`, `span_id`.
   - Redacts detected tokens, passwords, and authorization headers.
4. **Infrastructure Manifests (`infra.ts`):**
   - Kubernetes YAML (Deployments, Services, StatefulSets, Ingress).
   - Docker Compose YAML (services, networks, ports, depends_on).
   - Terraform Plan JSON (resource_changes with actions `create`, `update`, `delete`).
