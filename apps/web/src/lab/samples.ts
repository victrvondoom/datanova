/**
 * Seed architectures for the Architecture Intelligence Lab (Campaign 03).
 *
 * These are DATA fixtures: complete canonical models used by tests, panels,
 * the challenge generator, and the benchmark corpus. DocFlow is the campaign's
 * reference architecture — a document-processing SaaS whose full requirement /
 * consistency / security context exercises every engine.
 */

import {
  type ArchitectureModel, emptyModel,
} from "./model";

/** Reference architecture: DocFlow — a document-processing SaaS. */
export function docflowModel(): ArchitectureModel {
  const m = emptyModel("arch-docflow", "DocFlow (document-processing SaaS)",
    "Users upload documents; a worker pipeline extracts text and renders PDFs; analytics reports usage.");

  m.zones = [
    { id: "zone-internet", name: "Internet", trust: "internet" },
    { id: "zone-edge", name: "Edge / DMZ", trust: "dmz" },
    { id: "zone-app", name: "Application", trust: "trusted" },
    { id: "zone-data", name: "Data (privileged)", trust: "privileged" },
  ];

  m.requirements = [
    { id: "FR-1", kind: "functional", category: "functionality",
      statement: "Users can upload documents up to 25 MB and receive a processed PDF.",
      acceptance: "An upload returns a document id; a processed PDF appears within the processing SLO." },
    { id: "FR-2", kind: "functional", category: "functionality",
      statement: "Users can view document processing status and download results.",
      acceptance: "Status endpoint returns pending|processing|done|failed; done returns a download URL." },
    { id: "FR-3", kind: "functional", category: "functionality",
      statement: "Users can delete their documents and all derived data.",
      acceptance: "After deletion, document, extracted text, and rendered PDF are no longer retrievable." },
    { id: "NFR-1", kind: "nfr", category: "latency",
      statement: "Upload acknowledgement must complete within 800 ms at p95.",
      acceptance: "p95 upload ack latency <= 800 ms under peak modeled load." },
    { id: "NFR-2", kind: "nfr", category: "availability",
      statement: "The service is highly available.",
      acceptance: "Availability >= 99.9% over a rolling 30-day window." },
    { id: "NFR-3", kind: "nfr", category: "consistency",
      statement: "Users must immediately see 'processing' after a successful upload acknowledgement.",
      acceptance: "A status read after upload ack never returns 'not found' (read-after-write for status)." },
    { id: "NFR-4", kind: "nfr", category: "security",
      statement: "All document content is encrypted in transit and at rest.",
      acceptance: "Every connection carrying document bytes declares encryption; stores declare at-rest encryption." },
    { id: "NFR-5", kind: "nfr", category: "throughput",
      statement: "The system sustains 50 document uploads/sec at peak.",
      acceptance: "Modeled queue backlog stays bounded at 50 uploads/sec with 8 workers." },
    { id: "CON-1", kind: "constraint", category: "cost",
      statement: "Monthly infrastructure budget is capped.",
      acceptance: "Modeled monthly cost stays within the declared budget assumption." },
    { id: "CON-2", kind: "constraint", category: "regulatory",
      statement: "User data must be fully deleted within 30 days of a deletion request.",
      acceptance: "All stores holding user documents implement the deletion workflow." },
    { id: "CON-3", kind: "constraint", category: "consistency",
      statement: "Usage analytics may lag up to 24 hours behind processing.",
      acceptance: "Analytics freshness is between 0 and 24h and never blocks processing." },
  ];

  m.assumptions = [
    { id: "ASM-1", statement: "Peak traffic is 50 uploads/sec and bursty (bursts of 2x for up to 60s).",
      source: "product estimate", confidence: 0.6, owner: "product", status: "unverified" },
    { id: "ASM-2", statement: "Average processing takes 4s per document (p95 12s).",
      source: "prototype measurement", confidence: 0.7, owner: "engineering", status: "unverified" },
    { id: "ASM-3", statement: "Documents are sensitive business data but contain no direct PII.",
      source: "legal review pending", confidence: 0.4, owner: "legal", status: "unverified" },
    { id: "ASM-4", statement: "Active documents are polled for status about 4 times per minute each.",
      source: "UI team estimate", confidence: 0.5, owner: "engineering", status: "unverified" },
  ];

  m.components = [
    { id: "web", kind: "client", name: "Web client", zoneId: "zone-internet",
      purpose: "User-facing upload UI", config: {}, requirementIds: ["FR-1", "FR-2"] },
    { id: "gateway", kind: "gateway", name: "API gateway", zoneId: "zone-edge",
      purpose: "Terminates TLS, authenticates requests, rate-limits uploads",
      config: { rateLimitPerMin: 6000, tls: true }, requirementIds: ["NFR-4", "NFR-5"],
      telemetry: { metrics: ["requests", "latency_p95"], logs: true, traces: true, tracePropagation: true } },
    { id: "upload-svc", kind: "service", name: "Upload service", zoneId: "zone-app",
      purpose: "Validates documents, stores the original, enqueues processing work",
      config: { cpuUnits: 2, memoryMB: 2048, idempotent: false },
      requirementIds: ["FR-1", "NFR-1"],
      telemetry: { metrics: ["uploads", "upload_latency"], logs: true, traces: true, tracePropagation: true } },
    { id: "doc-store", kind: "objectstore", name: "Document store", zoneId: "zone-data",
      purpose: "Durable storage of original documents and rendered PDFs",
      config: { storageGB: 500, atRestEncryption: true },
      requirementIds: ["FR-1", "NFR-4", "CON-2"] },
    { id: "work-queue", kind: "queue", name: "Work queue", zoneId: "zone-data",
      purpose: "Buffers processing work so upload acks stay fast and worker outages don't lose work",
      config: { capacity: 10000 },
      requirementIds: ["NFR-1", "NFR-2"],
      telemetry: { metrics: ["queue_depth"], logs: false, traces: false, tracePropagation: false } },
    { id: "worker", kind: "worker", name: "Processing worker", zoneId: "zone-app",
      purpose: "Extracts text and renders PDFs; scales horizontally against the queue",
      config: { concurrency: 8, cpuUnits: 4, memoryMB: 8192, retryMax: 3, retryPolicy: "backoff" },
      requirementIds: ["FR-1", "NFR-2"],
      telemetry: { metrics: ["processed", "processing_time"], logs: true, traces: true, tracePropagation: false } },
    { id: "meta-db", kind: "database", name: "Metadata database", zoneId: "zone-data",
      purpose: "Authoritative document status and ownership records",
      config: { connPool: 50, replicas: 2, atRestEncryption: true },
      requirementIds: ["FR-2", "NFR-3", "CON-2"],
      telemetry: { metrics: ["queries", "latency_p95"], logs: true, traces: false, tracePropagation: false } },
    { id: "status-cache", kind: "cache", name: "Status cache", zoneId: "zone-data",
      purpose: "Serves hot status reads without hitting the metadata database",
      config: { ttlSeconds: 30, capacityMB: 512 }, requirementIds: ["NFR-1"],
      telemetry: { metrics: ["hit_rate"], logs: false, traces: false, tracePropagation: false } },
    { id: "analytics", kind: "analytics", name: "Usage analytics", zoneId: "zone-app",
      purpose: "Aggregates usage reports (explicitly allowed to lag)",
      config: { batchSize: 500 }, requirementIds: ["CON-3"] },
    { id: "notify", kind: "external", name: "Email notifier", zoneId: "zone-internet",
      purpose: "Sends 'document done' emails via a third-party provider",
      config: { provider: "third-party" }, requirementIds: [] },
  ];

  m.connections = [
    { id: "cn-web-gw", from: "web", to: "gateway", kind: "sync", criticality: 5,
      failureBehavior: "blocks", dataDirection: "requests", latencyMs: 40,
      controls: ["encryption"], operationIds: ["op-upload", "op-status", "op-delete"],
      requirementIds: ["NFR-4"] },
    { id: "cn-gw-up", from: "gateway", to: "upload-svc", kind: "sync", criticality: 5,
      failureBehavior: "blocks", dataDirection: "requests", latencyMs: 10,
      controls: ["authn", "authz", "ratelimit"], operationIds: ["op-upload"],
      requirementIds: ["NFR-4", "NFR-5"] },
    { id: "cn-up-store", from: "upload-svc", to: "doc-store", kind: "sync", criticality: 4,
      failureBehavior: "blocks", dataDirection: "files", latencyMs: 60,
      controls: ["encryption"], operationIds: ["op-upload"], requirementIds: ["NFR-4"] },
    { id: "cn-up-queue", from: "upload-svc", to: "work-queue", kind: "async", criticality: 3,
      failureBehavior: "degrades", dataDirection: "work items", latencyMs: 5,
      operationIds: ["op-upload"], requirementIds: ["NFR-1"] },
    { id: "cn-up-db", from: "upload-svc", to: "meta-db", kind: "sync", criticality: 5,
      failureBehavior: "blocks", dataDirection: "status writes", latencyMs: 20,
      controls: ["encryption"], operationIds: ["op-upload"], requirementIds: ["NFR-3"] },
    { id: "cn-queue-worker", from: "work-queue", to: "worker", kind: "async", criticality: 3,
      failureBehavior: "isolated", dataDirection: "work items", latencyMs: 5,
      operationIds: ["op-process"], requirementIds: ["NFR-2"] },
    { id: "cn-worker-store", from: "worker", to: "doc-store", kind: "sync", criticality: 4,
      failureBehavior: "blocks", dataDirection: "rendered PDFs", latencyMs: 80,
      controls: ["encryption"], operationIds: ["op-process"], requirementIds: ["FR-1"] },
    { id: "cn-worker-db", from: "worker", to: "meta-db", kind: "sync", criticality: 4,
      failureBehavior: "blocks", dataDirection: "status updates", latencyMs: 20,
      operationIds: ["op-process"], requirementIds: ["FR-2"] },
    { id: "cn-gw-status", from: "gateway", to: "status-cache", kind: "sync", criticality: 3,
      failureBehavior: "degrades", dataDirection: "status queries", latencyMs: 8,
      operationIds: ["op-status"], requirementIds: ["NFR-1"] },
    { id: "cn-cache-db", from: "status-cache", to: "meta-db", kind: "sync", criticality: 3,
      failureBehavior: "degrades", dataDirection: "status queries (cache miss)", latencyMs: 15,
      operationIds: ["op-status"], requirementIds: [] },
    { id: "cn-db-analytics", from: "meta-db", to: "analytics", kind: "event", criticality: 1,
      failureBehavior: "isolated", dataDirection: "usage events", latencyMs: 5,
      operationIds: ["op-report"], requirementIds: ["CON-3"] },
    { id: "cn-worker-notify", from: "worker", to: "notify", kind: "async", criticality: 2,
      failureBehavior: "isolated", dataDirection: "notification jobs", latencyMs: 50,
      operationIds: ["op-process"], requirementIds: [] },
  ];

  m.operations = [
    { id: "op-upload", name: "Upload document", criticality: 5,
      requirementIds: ["FR-1", "NFR-1", "NFR-3"], description: "User uploads a document and receives an ack." },
    { id: "op-process", name: "Process document", criticality: 4,
      requirementIds: ["FR-1", "NFR-2"], description: "Worker extracts text and renders the PDF." },
    { id: "op-status", name: "View status", criticality: 4,
      requirementIds: ["FR-2", "NFR-3"], description: "User checks processing status." },
    { id: "op-report", name: "Usage analytics", criticality: 2,
      requirementIds: ["CON-3"], description: "Usage reporting (may lag)." },
    { id: "op-delete", name: "Delete document", criticality: 3,
      requirementIds: ["FR-3", "CON-2"], description: "User deletes document and derived data." },
  ];

  m.adrs = [
    { id: "ADR-1", title: "Buffer processing work in a durable queue",
      context: "Upload ack must stay under 800 ms while processing takes seconds; worker outages must not lose work.",
      decision: "Upload service acknowledges after storing the original and enqueuing durable work; workers process asynchronously.",
      status: "accepted",
      requirementIds: ["NFR-1", "NFR-2"],
      alternatives: [
        { title: "Process synchronously during upload", rejectedBecause: "p95 would exceed the 800 ms budget by an order of magnitude." },
        { title: "In-memory task list", rejectedBecause: "A worker restart would lose accepted work, violating NFR-2." },
      ] },
    { id: "ADR-2", title: "Cache document status with a short TTL",
      context: "Status reads are hot; the metadata database must not see every poll.",
      decision: "Read-through cache with 30 s TTL in front of the metadata database.",
      status: "accepted",
      requirementIds: ["NFR-1", "NFR-3"],
      alternatives: [
        { title: "Read status directly from the database", rejectedBecause: "Poll traffic would dominate database load at peak (assumption ASM-1)." },
      ] },
  ];

  m.dataEntities = [
    { id: "de-doc", name: "Original document", ownerComponentId: "doc-store",
      classification: "sensitive", retentionDays: 90,
      copies: [{ componentId: "work-queue", purpose: "processing reference" }] },
    { id: "de-pdf", name: "Rendered PDF", ownerComponentId: "doc-store",
      classification: "sensitive", retentionDays: 90, copies: [] },
    { id: "de-meta", name: "Document metadata & status", ownerComponentId: "meta-db",
      classification: "internal", retentionDays: 365,
      copies: [{ componentId: "status-cache", purpose: "hot status reads" }] },
  ];

  m.events = [
    { id: "ev-usage", name: "document.processed", producerComponentId: "worker",
      versions: [
        { version: 1, fields: [
          { name: "documentId", type: "string", required: true, addedIn: 1 },
          { name: "bytes", type: "number", required: true, addedIn: 1 },
          { name: "durationMs", type: "number", required: false, addedIn: 1 },
        ] },
      ] },
  ];
  m.consumers = [
    { eventId: "ev-usage", consumerComponentId: "analytics", maxVersion: 1 },
  ];

  m.slos = [
    { id: "slo-avail", kind: "availability", target: 99.9, unit: "percent",
      windowDays: 30, expectedRequestsPerDay: 4_320_000,
      componentIds: ["gateway", "upload-svc", "meta-db"] },
    { id: "slo-upload-latency", kind: "latency", target: 800, unit: "ms",
      windowDays: 30, expectedRequestsPerDay: 4_320_000,
      componentIds: ["gateway", "upload-svc", "doc-store"] },
  ];

  m.latencyBudget = { deadlineMs: 800, allocations: { web: 20, gateway: 40, "upload-svc": 120, "doc-store": 60, "meta-db": 20 } };

  return m;
}

/**
 * A deliberately flawed minimal variant used by critic/benchmark fixtures:
 * no queue (synchronous processing), no idempotency, single database,
 * an uncontrolled privileged crossing, and a component without purpose.
 */
export function flawedCheckoutModel(): ArchitectureModel {
  const m = emptyModel("arch-flawed-checkout", "Flawed checkout (benchmark fixture)",
    "Intentionally flawed: synchronous processing, missing idempotency, uncontrolled boundary.");
  m.zones = [
    { id: "zone-internet", name: "Internet", trust: "internet" },
    { id: "zone-app", name: "Application", trust: "trusted" },
    { id: "zone-data", name: "Data", trust: "privileged" },
  ];
  m.requirements = [
    { id: "R-1", kind: "functional", category: "functionality",
      statement: "A customer can place an order and pay exactly once.",
      acceptance: "Each order results in exactly one charge, even under retries." },
    { id: "R-2", kind: "nfr", category: "availability",
      statement: "Checkout is highly available.",
      acceptance: "Availability >= 99.5% monthly." },
    { id: "R-3", kind: "constraint", category: "consistency",
      statement: "Inventory must not oversell.",
      acceptance: "Sum of sold items never exceeds stock." },
  ];
  m.components = [
    { id: "c-web", kind: "client", name: "Web client", zoneId: "zone-internet",
      purpose: "Checkout UI", config: {}, requirementIds: ["R-1"] },
    { id: "c-api", kind: "service", name: "Checkout API", zoneId: "zone-app",
      purpose: "Handles checkout requests", config: { idempotent: false },
      requirementIds: ["R-1"] },
    { id: "c-pay", kind: "external", name: "Payment provider", zoneId: "zone-internet",
      purpose: "Charges the customer", config: {}, requirementIds: ["R-1"] },
    { id: "c-db", kind: "database", name: "Order database", zoneId: "zone-data",
      purpose: "Orders and inventory", config: { connPool: 20, replicas: 1 },
      requirementIds: ["R-1", "R-3"] },
    { id: "c-logging", kind: "service", name: "Audit logger", zoneId: "zone-app",
      // intentionally no purpose + no requirements (orphan component fixture)
      purpose: "", config: {}, requirementIds: [] },
  ];
  m.connections = [
    { id: "k-1", from: "c-web", to: "c-api", kind: "sync", criticality: 5,
      failureBehavior: "blocks", latencyMs: 30, operationIds: ["op-checkout"],
      requirementIds: ["R-1"] },
    { id: "k-2", from: "c-api", to: "c-pay", kind: "sync", criticality: 5,
      failureBehavior: "blocks", latencyMs: 900, operationIds: ["op-checkout"],
      // intentionally NO controls on an internet-zone payment crossing
      requirementIds: ["R-1"] },
    { id: "k-3", from: "c-api", to: "c-db", kind: "sync", criticality: 5,
      failureBehavior: "blocks", latencyMs: 20, operationIds: ["op-checkout"],
      requirementIds: ["R-3"] },
  ];
  m.operations = [
    { id: "op-checkout", name: "Checkout", criticality: 5, requirementIds: ["R-1", "R-2", "R-3"] },
  ];
  // No ADR for the synchronous payment call, no assumptions, no telemetry.
  return m;
}
