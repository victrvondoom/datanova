/**
 * Campaign 07 — DataNova Reality Engine Unit & Analytical Test Suite
 *
 * Exhaustively tests:
 * - Operational Evidence Envelope integrity and validation
 * - Ingestion connectors (OTel traces, Prometheus, Logs, K8s manifests)
 * - Identity resolution and disambiguation
 * - Section 8 Mandatory Reconciliation: detection of undocumented Pricing Service
 * - Drift triage and remediation lifecycle
 * - SLI/SLO error budget evaluation and critical path latency
 * - Causal hypothesis generation and blast radius discrepancy
 * - API contract breaking change detection and release gates
 */

import { describe, it, expect } from "vitest";
import {
  createEvidenceEnvelope,
  validateEnvelope,
  canonicalJsonStringify,
} from "../envelope";
import { IngestionGovernance } from "../governance";
import { OperationalHistoryStore } from "../history";
import { OTelTraceConnector } from "../connectors/otel";
import { PrometheusConnector } from "../connectors/metrics";
import { StructuredLogConnector } from "../connectors/logs";
import { InfrastructureConnector } from "../connectors/infra";
import { IdentityResolver } from "../identity";
import { RuntimeTopologyBuilder } from "../topology";
import { ArchitectureReconciler } from "../reconciliation";
import { DriftManager } from "../drift";
import { ReliabilityEngine } from "../reliability";
import { IncidentIntelligenceEngine } from "../incidents";
import { ChangeIntelligenceEngine } from "../changes";
import { modelToIntendedGraph } from "../models";
import {
  section8IntendedModel,
  section8ConfiguredYaml,
  section8ObservedSpans,
  generateSyntheticCorpus,
} from "../fixtures";

describe("Campaign 07 — Task 02: Operational Evidence Envelope", () => {
  it("creates and validates a well-formed envelope with matching integrity hash", () => {
    const env = createEvidenceEnvelope({
      evidenceId: "ev-test-1",
      workspaceId: "ws-1",
      sourceSystem: "opentelemetry",
      sourceType: "trace",
      sourceVersion: "1.0.0",
      sourceResourceId: "auth-svc/login",
      observedTime: "2026-11-04T12:00:00.000Z",
      serviceIdentity: "auth-svc",
      environment: "production",
      dataClassification: "internal",
      provenanceReferences: ["span:12345"],
      qualityStatus: "valid",
    });

    const res = validateEnvelope(env);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(env.integrityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("detects tampering or corruption in the envelope", () => {
    const env = createEvidenceEnvelope({
      evidenceId: "ev-test-2",
      workspaceId: "ws-1",
      sourceSystem: "prometheus",
      sourceType: "metric",
      sourceVersion: "1.0.0",
      sourceResourceId: "cpu_usage",
      observedTime: "2026-11-04T12:00:00.000Z",
      environment: "production",
      measurementName: "cpu_percent",
      measurementValue: 42.5,
      dataClassification: "internal",
      provenanceReferences: [],
      qualityStatus: "valid",
    });

    // Tamper with value
    const tampered = { ...env, measurementValue: 99.9 };
    const res = validateEnvelope(tampered);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Integrity hash mismatch"))).toBe(true);
  });

  it("produces deterministic canonical JSON regardless of key insertion order", () => {
    const objA = { z: 1, a: 2, m: { y: "hello", b: "world" } };
    const objB = { a: 2, m: { b: "world", y: "hello" }, z: 1 };
    expect(canonicalJsonStringify(objA)).toBe(canonicalJsonStringify(objB));
  });
});

describe("Campaign 07 — Task 05 & 37: Governance & Redaction", () => {
  it("redacts passwords, bearer tokens, connection strings and PII", () => {
    const gov = new IngestionGovernance();
    const raw = "Connecting to postgres://admin:superSecret123@db.prod.internal:5432/app with Bearer eyJhbGciOiJIUzI1NiJ9";
    const redacted = gov.redactText(raw);

    expect(redacted).not.toContain("superSecret123");
    expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(redacted).toContain("[REDACTED]");
  });

  it("quarantines malformed items and produces a quality report", () => {
    const gov = new IngestionGovernance();
    gov.quarantine("logs", "json", "bad json { { {", ["SyntaxError"]);
    const items = gov.getQuarantinedItems();
    expect(items).toHaveLength(1);
    expect(items[0].reasons).toContain("SyntaxError");
  });
});

describe("Campaign 07 — Tasks 06–10: Connectors Plane", () => {
  it("parses OpenTelemetry traces into validated envelopes", () => {
    const connector = new OTelTraceConnector();
    const spans = section8ObservedSpans();
    const result = connector.parse(JSON.stringify(spans), {
      workspaceId: "ws-test",
      environment: "production",
      isSynthetic: true,
    });

    expect(result.itemsIngested).toBe(5);
    expect(result.errors).toHaveLength(0);
    expect(result.envelopes.some((e) => e.serviceIdentity === "Pricing Service")).toBe(true);
  });

  it("parses Prometheus metric text exposition", () => {
    const connector = new PrometheusConnector();
    const text = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",service="api-gateway"} 1420 1762250000000
# HELP process_cpu_seconds_total Total user and system CPU time
# TYPE process_cpu_seconds_total gauge
process_cpu_seconds_total{service="api-gateway"} 35.2
`;
    const result = connector.parse(text, {
      workspaceId: "ws-test",
      environment: "production",
    });

    expect(result.itemsIngested).toBe(2);
    expect(result.envelopes[0].measurementName).toBe("http_requests_total");
    expect(result.envelopes[0].measurementValue).toBe(1420);
  });

  it("parses structured logs and extracts trace correlation", () => {
    const connector = new StructuredLogConnector();
    const logs = `
{"timestamp":"2026-11-04T12:00:00Z","level":"INFO","service":"order-svc","message":"Processing order 992","traceId":"tr-001","spanId":"sp-order"}
{"timestamp":"2026-11-04T12:00:01Z","level":"ERROR","service":"order-svc","message":"Payment token failed authorization token:secret123","traceId":"tr-001"}
`;
    const result = connector.parse(logs, {
      workspaceId: "ws-test",
      environment: "production",
    });

    expect(result.itemsIngested).toBe(2);
    expect(result.envelopes[1].measurementValue).toBe(1); // Error level
    expect(result.envelopes[1].traceId).toBe("tr-001");
  });

  it("parses Kubernetes manifests and extracts configured dependencies", () => {
    const connector = new InfrastructureConnector();
    const yaml = section8ConfiguredYaml();
    const result = connector.parse(yaml, {
      workspaceId: "ws-test",
      environment: "production",
    });

    expect(result.itemsIngested).toBeGreaterThanOrEqual(4);
    expect(result.envelopes.some((e) => e.serviceIdentity === "api-gateway")).toBe(true);
    expect(result.envelopes.some((e) => e.serviceIdentity === "order-service")).toBe(true);
  });
});

describe("Campaign 07 — Task 11: Service Identity Resolution", () => {
  it("resolves exact and normalized service names", () => {
    const resolver = new IdentityResolver();
    const declared = [
      { id: "comp-gateway", name: "API Gateway" },
      { id: "comp-order-svc", name: "Order Service" },
      { id: "comp-database", name: "Order Database" },
    ];

    const matchExact = resolver.resolveOne("API Gateway", declared);
    expect(matchExact.quality).toBe("EXACT");
    expect(matchExact.matchedNodeId).toBe("comp-gateway");

    const matchNormalized = resolver.resolveOne("order-svc", declared);
    expect(matchNormalized.quality).toBe("PROBABLE");
    expect(matchNormalized.matchedNodeId).toBe("comp-order-svc");

    const matchUnmatched = resolver.resolveOne("pricing-service", declared);
    expect(matchUnmatched.quality).toBe("UNMATCHED");
    expect(matchUnmatched.matchedNodeId).toBeUndefined();
  });

  it("respects human confirmation manual overrides", () => {
    const resolver = new IdentityResolver();
    const declared = [
      { id: "comp-database", name: "Order Database" },
    ];

    resolver.setManualOverride("postgres-primary", "comp-database");
    const match = resolver.resolveOne("postgres-primary", declared);
    expect(match.quality).toBe("EXACT");
    expect(match.matchedNodeId).toBe("comp-database");
    expect(match.strategy).toBe("manual_override");
  });
});

describe("Campaign 07 — Task 13 & Section 8: Mandatory Reconciliation Engine", () => {
  it("executes three-way reconciliation and flags undocumented Pricing Service dependency", () => {
    // 1. Establish Intended Architecture
    const intendedModel = section8IntendedModel();
    const intendedGraph = modelToIntendedGraph(intendedModel);

    // 2. Establish Configured Infrastructure
    const infraConnector = new InfrastructureConnector();
    const configuredResult = infraConnector.parse(section8ConfiguredYaml(), {
      workspaceId: "ws-sec8",
      environment: "production",
    });
    expect(configuredResult.itemsIngested).toBeGreaterThanOrEqual(4);
    // Build configured graph
    const configuredGraph = infraConnector.toConfiguredGraph([
      { id: "cfg-api-gateway", name: "API Gateway", kind: "service", ports: [8080], environmentVariables: {}, dependencies: [{ targetName: "Order Service", relationship: "CALL" }], labels: {} },
      { id: "cfg-order-svc", name: "Order Service", kind: "service", ports: [8081], environmentVariables: {}, dependencies: [{ targetName: "Message Queue", relationship: "CALL" }], labels: {} },
      { id: "cfg-queue", name: "Message Queue", kind: "queue", ports: [5672], environmentVariables: {}, dependencies: [{ targetName: "Order Worker", relationship: "EVENT" }], labels: {} },
      { id: "cfg-worker", name: "Order Worker", kind: "service", ports: [], environmentVariables: {}, dependencies: [{ targetName: "Order Database", relationship: "WRITE" }], labels: {} },
      { id: "cfg-database", name: "Order Database", kind: "database", ports: [5432], environmentVariables: {}, dependencies: [], labels: {} },
    ]);

    // 3. Establish Observed Runtime Topology from Spans
    const spans = section8ObservedSpans();
    const topologyBuilder = new RuntimeTopologyBuilder();
    const observedGraph = topologyBuilder.buildFromSpans(spans);

    // 4. Run Three-Way Reconciliation
    const reconciler = new ArchitectureReconciler();
    const { derived, records } = reconciler.reconcile(intendedGraph, configuredGraph, observedGraph);

    expect(derived.driftCount).toBeGreaterThan(0);

    // Fulfill Section 8 item 7 & 8: Verify undocumented Pricing Service dependency is detected!
    const undocumentedPricing = records.find(
      (r) =>
        r.driftClassification === "network_dependency" &&
        (r.targetService === "Pricing Service" || r.sourceService === "Pricing Service")
    );

    expect(undocumentedPricing).toBeDefined();
    expect(undocumentedPricing?.confidenceCategory).toBe("CONFIRMED");
    expect(undocumentedPricing?.severity).toBe("critical");
    expect(undocumentedPricing?.severityRationale).toContain("is NOT documented in architecture intent");

    // Fulfill Section 8 item 8: Shadow / Unarchitected node detection
    const shadowPricingNode = records.find((r) => r.sourceService === "Pricing Service" && r.driftClassification === "topology");
    expect(shadowPricingNode).toBeDefined();
  });
});

describe("Campaign 07 — Task 14 & 15: Drift Triage & Lifecycle", () => {
  it("transitions drift status through acknowledge, investigate, and accept-as-intended", () => {
    const manager = new DriftManager([
      {
        id: "drift-test-1",
        architectureVersion: 1,
        driftClassification: "network_dependency",
        severity: "critical",
        severityRationale: "Undocumented call",
        sourceService: "Order Service",
        targetService: "Pricing Service",
        intendedStatus: "absent",
        configuredStatus: "absent",
        observedStatus: "present",
        confidenceCategory: "CONFIRMED",
        affectedNodes: ["comp-order-svc"],
        affectedEdges: ["edge-1"],
        timeWindow: { start: "2026-11-04T12:00:00Z", end: "2026-11-04T13:00:00Z" },
        evidenceReferences: ["span:tr-001"],
        humanReviewStatus: "unreviewed",
      },
    ]);

    // Acknowledge
    const ack = manager.applyAction({
      recordId: "drift-test-1",
      action: "acknowledge",
      actor: "lead-architect",
      rationale: "Acknowledged during triage",
    });
    expect(ack.humanReviewStatus).toBe("acknowledged");

    // Accept as intended
    const accepted = manager.applyAction({
      recordId: "drift-test-1",
      action: "accept_as_intended",
      actor: "principal-engineer",
      rationale: "Approved direct pricing call to reduce checkout latency. Updating architecture.",
    });
    expect(accepted.humanReviewStatus).toBe("accepted_as_intended");
    expect(accepted.resolutionNote).toContain("ACCEPT_AS_INTENDED");

    // Summary stats
    const stats = manager.getSummaryStats();
    expect(stats.resolved).toBe(1);
    expect(stats.unreviewed).toBe(0);
  });
});

describe("Campaign 07 — Tasks 21–25: Operational Reliability & SLI/SLO", () => {
  it("evaluates SLO compliance and detects critical path bottleneck", () => {
    const engine = new ReliabilityEngine();
    const spans = section8ObservedSpans();

    const slos = engine.evaluateSlos(spans, [
      {
        serviceId: "Order Service",
        name: "Order Service",
        availabilityTarget: 0.99,
        latencyTargetMs: 200,
        latencyRatioTarget: 0.95,
        evaluationWindowHours: 1,
      },
    ]);

    expect(slos).toHaveLength(1);
    expect(slos[0].availabilityMet).toBe(true);
    expect(slos[0].latencyMet).toBe(true);

    // Critical Path Analysis
    const criticalPath = engine.calculateCriticalPath(spans);
    expect(criticalPath).not.toBeNull();
    expect(criticalPath?.totalDurationMs).toBe(180);
    expect(criticalPath?.bottleneckService).toBeDefined();
  });
});

describe("Campaign 07 — Tasks 26–30: Incident & Blast Radius Intelligence", () => {
  it("projects blast radius discrepancies and synthesizes causal hypotheses", () => {
    const incidentEngine = new IncidentIntelligenceEngine();
    const intended = modelToIntendedGraph(section8IntendedModel());
    const observed = new RuntimeTopologyBuilder().buildFromSpans(section8ObservedSpans());

    // Blast radius of Order Service
    const blast = incidentEngine.calculateBlastRadius("Order Service", intended, observed);
    expect(blast.intendedImpacted).toContain("Message Queue");
    expect(blast.observedImpacted).toContain("Pricing Service");
    expect(blast.discrepancyNodes).toContain("Pricing Service");

    // Hypotheses synthesis
    const hypotheses = incidentEngine.synthesizeHypotheses(
      [
        {
          id: "evt-dep",
          timestampIso: "2026-11-04T12:00:00Z",
          source: "deployment",
          service: "Pricing Service",
          summary: "Deployed v1.4.0",
          severity: "info",
        },
        {
          id: "evt-err",
          timestampIso: "2026-11-04T12:04:00Z",
          source: "log",
          service: "Order Database",
          summary: "Connection timeout",
          severity: "critical",
        },
      ],
      [{ sourceService: "Pricing Service", severityRationale: "Undocumented direct call", severity: "critical" }]
    );

    expect(hypotheses.length).toBeGreaterThanOrEqual(1);
    expect(hypotheses[0].confidence).toBe("SUPPORTED");
  });
});

describe("Campaign 07 — Tasks 31–35: Change Intelligence & Release Gates", () => {
  it("detects breaking API contract changes and evaluates release readiness gates", () => {
    const changeEngine = new ChangeIntelligenceEngine();

    const oldSpec = {
      openapi: "3.0.0",
      paths: {
        "/api/orders": {
          post: { summary: "Create order", parameters: [] },
        },
      },
    };

    const newSpec = {
      openapi: "3.1.0",
      paths: {
        "/api/orders": {
          post: {
            summary: "Create order",
            parameters: [{ name: "tenantId", in: "header", required: true }],
          },
        },
      },
    };

    const diff = changeEngine.diffApiContracts("order-service", oldSpec, newSpec, ["api-gateway"]);
    expect(diff.isBreaking).toBe(true);
    expect(diff.breakingChanges[0].description).toContain("Added required parameter(s): tenantId");

    // Release gate
    const gate = changeEngine.evaluateReleaseGate("order-service", "v2.0.0", {
      contractDiff: diff,
      activeDriftCount: 1,
      sloHealth: "healthy",
      unresolvedIncidentCount: 0,
    });

    expect(gate.overallDecision).toBe("BLOCKED");
    expect(gate.criteria.some((c) => c.status === "FAILED")).toBe(true);
  });
});

describe("Campaign 07 — Task 04 & Synthetic Benchmarking", () => {
  it("verifies history store append and snapshot creation", () => {
    const store = new OperationalHistoryStore("ws-test");
    const env = createEvidenceEnvelope({
      evidenceId: "ev-snap-1",
      workspaceId: "ws-test",
      sourceSystem: "opentelemetry",
      sourceType: "trace",
      sourceVersion: "1.0.0",
      sourceResourceId: "svc/op",
      observedTime: "2026-11-04T12:00:00Z",
      environment: "production",
      dataClassification: "internal",
      provenanceReferences: [],
      qualityStatus: "synthetic",
    });

    store.appendEnvelope(env);
    expect(store.getEnvelopes()).toHaveLength(1);

    const intended = modelToIntendedGraph(section8IntendedModel());
    const configured = new InfrastructureConnector().toConfiguredGraph([]);
    const observed = new RuntimeTopologyBuilder().buildFromSpans([]);
    const reconciler = new ArchitectureReconciler();
    const { derived } = reconciler.reconcile(intended, configured, observed);

    const snapshot = store.createSnapshot(1, intended, configured, observed, derived);
    expect(snapshot.snapshotId).toMatch(/^snap-/);
    expect(store.getSnapshots()).toHaveLength(1);
  });

  it("benchmarks synthetic corpus generation and topology processing", () => {
    const start = performance.now();
    const { spans } = generateSyntheticCorpus(25, 500);
    const builder = new RuntimeTopologyBuilder();
    const observed = builder.buildFromSpans(spans);
    const duration = performance.now() - start;

    expect(observed.nodes.length).toBe(25);
    expect(observed.spanCount).toBe(500);
    expect(duration).toBeLessThan(100); // well within 100ms budget for medium corpus
  });
});
