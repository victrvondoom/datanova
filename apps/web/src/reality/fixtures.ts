/**
 * Campaign 07 — Task 08 & Section 8: Mandatory Reconciliation Fixture & Test Corpus
 *
 * Implements the canonical Section 8 reconciliation example:
 * Intended: Client -> API Gateway -> Order Service -> Message Queue -> Order Worker -> Order Database
 * Configured: K8s manifests for all 5 services
 * Observed: Traces demonstrating Client -> API Gateway -> Order Service -> Pricing Service -> Order Database
 */

import { emptyModel, type ArchitectureModel } from "../lab/model";
import { createEvidenceEnvelope, type OperationalEvidenceEnvelope } from "./envelope";
import type { NormalizedSpan } from "./connectors/otel";

/** Section 8 Intended Architecture Model */
export function section8IntendedModel(): ArchitectureModel {
  const base = emptyModel(
    "arch-section8-orderflow",
    "Order Processing Architecture (Intended)",
    "Intended architecture declaring asynchronous queue-based order processing."
  );

  return {
    ...base,
    zones: [
      { id: "zone-internet", name: "Internet", trust: "internet" },
      { id: "zone-dmz", name: "DMZ", trust: "dmz" },
      { id: "zone-internal", name: "Internal Trusted", trust: "trusted" },
    ],
    components: [
      { id: "comp-client", name: "Client", kind: "client", zoneId: "zone-internet", config: { criticality: 1 }, requirementIds: [] },
      { id: "comp-gateway", name: "API Gateway", kind: "gateway", zoneId: "zone-dmz", config: { criticality: 4 }, requirementIds: [] },
      { id: "comp-order-svc", name: "Order Service", kind: "service", zoneId: "zone-internal", config: { criticality: 5 }, requirementIds: ["req-1"] },
      { id: "comp-queue", name: "Message Queue", kind: "queue", zoneId: "zone-internal", config: { criticality: 4 }, requirementIds: ["req-1"] },
      { id: "comp-worker", name: "Order Worker", kind: "worker", zoneId: "zone-internal", config: { criticality: 4 }, requirementIds: ["req-1"] },
      { id: "comp-database", name: "Order Database", kind: "database", zoneId: "zone-internal", config: { criticality: 5 }, requirementIds: [] },
    ],
    connections: [
      { id: "conn-1", from: "comp-client", to: "comp-gateway", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
      { id: "conn-2", from: "comp-gateway", to: "comp-order-svc", kind: "sync", criticality: 5, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
      { id: "conn-3", from: "comp-order-svc", to: "comp-queue", kind: "async", criticality: 4, failureBehavior: "degrades", operationIds: [], requirementIds: ["req-1"] },
      { id: "conn-4", from: "comp-queue", to: "comp-worker", kind: "event", criticality: 4, failureBehavior: "degrades", operationIds: [], requirementIds: ["req-1"] },
      { id: "conn-5", from: "comp-worker", to: "comp-database", kind: "sync", criticality: 5, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
    ],
    requirements: [
      { id: "req-1", kind: "functional", category: "functionality", statement: "Asynchronous processing", acceptance: "Orders must be queued before database persistence" },
    ],
  };
}

/** Section 8 Configured Infrastructure YAML */
export function section8ConfiguredYaml(): string {
  return `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: gateway
          image: gateway:v2.1
          env:
            - name: ORDER_SERVICE_URL
              value: http://order-service:8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: order
          image: order-svc:v1.3
          env:
            - name: QUEUE_HOST
              value: amqp://message-queue:5672
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: message-queue
spec:
  replicas: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-worker
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: worker
          image: worker:v1.0
          env:
            - name: DB_HOST
              value: postgres://order-database:5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: order-database
spec:
  replicas: 1
`;
}

/** Section 8 Observed Spans demonstrating undocumented direct Pricing Service call */
export function section8ObservedSpans(): NormalizedSpan[] {
  const baseTime = Date.now() - 3600_000;

  return [
    {
      traceId: "tr-001",
      spanId: "sp-root",
      serviceName: "Client",
      name: "POST /order",
      kind: "CLIENT",
      startTimeIso: new Date(baseTime).toISOString(),
      endTimeIso: new Date(baseTime + 180).toISOString(),
      durationMs: 180,
      statusCode: "OK",
      attributes: { "http.method": "POST" },
      peerService: "API Gateway",
    },
    {
      traceId: "tr-001",
      spanId: "sp-gw",
      parentSpanId: "sp-root",
      serviceName: "API Gateway",
      name: "routeOrderRequest",
      kind: "SERVER",
      startTimeIso: new Date(baseTime + 10).toISOString(),
      endTimeIso: new Date(baseTime + 170).toISOString(),
      durationMs: 160,
      statusCode: "OK",
      attributes: {},
      peerService: "Order Service",
    },
    {
      traceId: "tr-001",
      spanId: "sp-order",
      parentSpanId: "sp-gw",
      serviceName: "Order Service",
      name: "createOrder",
      kind: "SERVER",
      startTimeIso: new Date(baseTime + 20).toISOString(),
      endTimeIso: new Date(baseTime + 160).toISOString(),
      durationMs: 140,
      statusCode: "OK",
      attributes: {},
      peerService: "Pricing Service", // UNDOCUMENTED CALL!
    },
    {
      traceId: "tr-001",
      spanId: "sp-pricing",
      parentSpanId: "sp-order",
      serviceName: "Pricing Service", // UNDOCUMENTED SERVICE!
      name: "calculateDiscount",
      kind: "SERVER",
      startTimeIso: new Date(baseTime + 30).toISOString(),
      endTimeIso: new Date(baseTime + 110).toISOString(),
      durationMs: 80,
      statusCode: "OK",
      attributes: { "pricing.tier": "enterprise" },
      peerService: "Order Database",
    },
    {
      traceId: "tr-001",
      spanId: "sp-db",
      parentSpanId: "sp-pricing",
      serviceName: "Order Database",
      name: "SELECT pricing_rules",
      kind: "SERVER",
      startTimeIso: new Date(baseTime + 40).toISOString(),
      endTimeIso: new Date(baseTime + 100).toISOString(),
      durationMs: 60,
      statusCode: "OK",
      attributes: { "db.system": "postgresql" },
    },
  ];
}

/** Convert section 8 observed spans into evidence envelopes */
export function section8EvidenceEnvelopes(workspaceId = "default"): OperationalEvidenceEnvelope[] {
  const spans = section8ObservedSpans();
  return spans.map((s) =>
    createEvidenceEnvelope({
      evidenceId: `sec8-${s.traceId}-${s.spanId}`,
      workspaceId,
      sourceSystem: "opentelemetry",
      sourceType: "trace",
      sourceVersion: "1.0.0",
      sourceResourceId: `${s.serviceName}/${s.name}`,
      observedTime: s.startTimeIso,
      serviceIdentity: s.serviceName,
      environment: "production",
      traceId: s.traceId,
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      relationshipReferences: s.peerService ? [{ target: s.peerService, type: "OBSERVED_CALL" }] : [],
      measurementName: "duration_ms",
      measurementValue: s.durationMs,
      unit: "ms",
      dataClassification: "internal",
      provenanceReferences: [`span:${s.traceId}:${s.spanId}`],
      qualityStatus: "synthetic",
      resourceAttributes: {
        ...s.attributes,
        "span.status": s.statusCode,
      },
    })
  );
}

/** Synthetic benchmark generator generating N services and M spans */
export function generateSyntheticCorpus(
  serviceCount: number,
  spanCount: number
): { services: string[]; spans: NormalizedSpan[] } {
  const services: string[] = [];
  for (let i = 1; i <= serviceCount; i++) {
    services.push(`svc-${String(i).padStart(3, "0")}`);
  }

  const spans: NormalizedSpan[] = [];
  const baseTime = Date.now() - 3600_000;

  for (let i = 1; i <= spanCount; i++) {
    const srcIdx = (i * 7) % serviceCount;
    const tgtIdx = (i * 13 + 1) % serviceCount;
    const src = services[srcIdx];
    const tgt = services[tgtIdx];
    const duration = 5 + (i % 80);
    const isError = i % 25 === 0;

    spans.push({
      traceId: `tr-${Math.floor(i / 5)}`,
      spanId: `sp-${i}`,
      parentSpanId: i % 5 !== 1 ? `sp-${i - 1}` : undefined,
      serviceName: src,
      name: `operation_${src}`,
      kind: "SERVER",
      startTimeIso: new Date(baseTime + i * 100).toISOString(),
      endTimeIso: new Date(baseTime + i * 100 + duration).toISOString(),
      durationMs: duration,
      statusCode: isError ? "ERROR" : "OK",
      attributes: { "test.index": i },
      peerService: src !== tgt ? tgt : undefined,
    });
  }

  return { services, spans };
}
