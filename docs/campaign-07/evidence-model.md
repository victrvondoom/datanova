# Campaign 07 — Operational Evidence Envelope & Relationship Model

## 1. Operational Evidence Envelope

Every operational event, trace span, metric point, log line, or infrastructure declaration is encapsulated into a validated, immutable envelope:

```typescript
export type SourceType = "trace" | "metric" | "log" | "infrastructure" | "deployment" | "observation";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";
export type EvidenceQualityStatus = "valid" | "quarantined" | "incomplete" | "stale" | "synthetic";

export interface OperationalEvidenceEnvelope {
  schemaVersion: "1.0.0";
  evidenceId: string;
  workspaceId: string;
  sourceSystem: string;
  sourceType: SourceType;
  sourceVersion: string;
  sourceResourceId: string;
  observedTime: string; // ISO 8601
  ingestedTime: string; // ISO 8601
  validityInterval?: { start: string; end: string };
  serviceIdentity?: string;
  resourceAttributes?: Record<string, string | number | boolean>;
  environment: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  relationshipReferences?: Array<{ target: string; type: string }>;
  measurementName?: string;
  measurementValue?: number;
  unit?: string;
  dataClassification: DataClassification;
  integrityHash: string; // SHA-256 over canonical JSON
  provenanceReferences: string[];
  qualityStatus: EvidenceQualityStatus;
  rawPayload?: Record<string, unknown>;
}
```

## 2. Canonical Operational Relationships

Relationships represent connections between architectural entities and runtime services:

- `INTENDED_DEPENDENCY`: Explicitly drawn in the architecture model.
- `CONFIGURED_DEPENDENCY`: Declared in Kubernetes Services, Docker Compose links, or Terraform associations.
- `OBSERVED_CALL`: Directly verified by distributed trace parent-child span executions.
- `OBSERVED_EVENT`: Asynchronous message publishing or queue consumption observed in traces or logs.
- `DATA_FLOW`: Persistent read/write interaction with a storage entity.
- `DEPLOYMENT_OWNERSHIP`: Pod or container managed by a deployment controller.
- `RESOURCE_CONTAINMENT`: Service contained within a namespace, cluster, or trust zone.
- `CAUSAL_HYPOTHESIS`: Candidate degradation trigger identified during incident investigation.

## 3. Explicit Evidence Confidence States

No binary green/red health indicators. All relationships and findings must carry:

1. `CONFIRMED`: Multi-signal evidence directly proving the relationship within the active time window.
2. `SUPPORTED`: Single-signal evidence indicating the relationship with high probability.
3. `INFERRED`: Derived transitively through intermediate connections or indirect log correlation.
4. `AMBIGUOUS`: Conflicting identifiers or multiple candidate matches without decisive proof.
5. `CONFLICTING`: Two or more sources directly contradict one another.
6. `STALE`: Previously confirmed relationship with no telemetry in the current observation window.
7. `MISSING_EVIDENCE`: Relationship expected by design or configuration, but zero runtime evidence exists.
8. `SYNTHETIC_ONLY`: Derived strictly from local synthetic test fixtures or educational models.
