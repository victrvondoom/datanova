/**
 * Canonical Architecture Intermediate Representation (Campaign 03, Task 02).
 *
 * Single source of truth for every Lab engine: components, connections,
 * requirements/intent, assumptions, ADRs, business operations, data entities,
 * event contracts, trust zones, SLOs. Engines never keep private architecture
 * formats (global requirement A).
 *
 * Conventions:
 * - Stable IDs: assigned once, referenced everywhere, never regenerated.
 * - Explicit schema version + migration; unknown versions are rejected loudly.
 * - All functions here are pure; models are treated as immutable values.
 */

export const MODEL_VERSION = 1;

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

export type ComponentKind =
  | "client"
  | "gateway"
  | "service"
  | "worker"
  | "queue"
  | "cache"
  | "database"
  | "objectstore"
  | "broker"
  | "analytics"
  | "external";

export const COMPONENT_KINDS: readonly ComponentKind[] = [
  "client", "gateway", "service", "worker", "queue", "cache",
  "database", "objectstore", "broker", "analytics", "external",
];

/** Component kinds that own persistent state (drives genome/complexity traits). */
export const STATEFUL_KINDS: readonly ComponentKind[] = ["database", "objectstore", "cache"];

export interface TelemetrySpec {
  /** metric names reported by this component */
  metrics?: string[];
  logs?: boolean;
  traces?: boolean;
  /** whether trace/correlation ids are propagated downstream */
  tracePropagation?: boolean;
}

export interface Component {
  id: string;
  kind: ComponentKind;
  name: string;
  /** why this component exists — the documented purpose (intent layer) */
  purpose?: string;
  config: Record<string, string | number | boolean | null>;
  zoneId?: string;
  requirementIds: string[];
  telemetry?: TelemetrySpec;
}

export type ConnectionKind = "sync" | "async" | "event";
export type FailureBehavior = "blocks" | "degrades" | "isolated";
export type BoundaryControl = "authn" | "authz" | "encryption" | "validation" | "ratelimit";

export interface Port {
  name: string;
  direction: "in" | "out";
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  kind: ConnectionKind;
  /** 1 (nice to have) .. 5 (system stops) */
  criticality: number;
  /** what happens upstream when this dependency fails */
  failureBehavior: FailureBehavior;
  /** what flows: requests, events, queries, files... */
  dataDirection?: string;
  /** modeled single-hop network + service latency in ms (assumption) */
  latencyMs?: number;
  controls?: BoundaryControl[];
  operationIds: string[];
  requirementIds: string[];
  ports?: Port[];
}

export type RequirementKind = "functional" | "nfr" | "constraint" | "risk" | "objective";
export type RequirementCategory =
  | "functionality" | "latency" | "throughput" | "availability" | "consistency"
  | "security" | "privacy" | "cost" | "deployment" | "ops-skill" | "regulatory";

export const REQUIREMENT_CATEGORIES: readonly RequirementCategory[] = [
  "functionality", "latency", "throughput", "availability", "consistency",
  "security", "privacy", "cost", "deployment", "ops-skill", "regulatory",
];

export interface Requirement {
  id: string;
  kind: RequirementKind;
  category: RequirementCategory;
  statement: string;
  /** reviewable / measurable acceptance condition — required */
  acceptance: string;
  /** explicitly unresolved (kept visible, never hidden) */
  unresolved?: boolean;
}

export type AssumptionStatus = "unverified" | "validated" | "refuted";

export interface Assumption {
  id: string;
  statement: string;
  source: string;
  /** 0..1 — declared confidence, never a measurement */
  confidence: number;
  owner: string;
  status: AssumptionStatus;
}

export interface AdrAlternative {
  title: string;
  rejectedBecause: string;
}

export interface Adr {
  id: string;
  title: string;
  context: string;
  decision: string;
  status: "proposed" | "accepted" | "superseded";
  requirementIds: string[];
  alternatives: AdrAlternative[];
}

export interface BusinessOperation {
  id: string;
  name: string;
  /** 1..5 — user-visible importance (drives criticality) */
  criticality: number;
  requirementIds: string[];
  description?: string;
}

export type DataClassification = "public" | "internal" | "sensitive" | "pii";

export interface DataEntity {
  id: string;
  name: string;
  /** authoritative owner — the only component allowed to mutate it */
  ownerComponentId: string;
  classification: DataClassification;
  retentionDays?: number;
  /** components holding a copy of this entity (cache/queue/log/export) */
  copies?: { componentId: string; purpose: string }[];
}

export interface EventField {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  /** event version in which this field was introduced */
  addedIn: number;
}

export interface EventVersion {
  version: number;
  fields: EventField[];
}

export interface EventContract {
  id: string;
  name: string;
  producerComponentId: string;
  versions: EventVersion[];
}

export interface ConsumerBinding {
  eventId: string;
  consumerComponentId: string;
  /** the maximum event version the consumer understands */
  maxVersion: number;
}

export type TrustLevel = "internet" | "dmz" | "trusted" | "privileged";

export interface TrustZone {
  id: string;
  name: string;
  trust: TrustLevel;
}

export interface SloTarget {
  id: string;
  kind: "availability" | "latency" | "completion";
  /** e.g. 99.9 (% availability), 500 (ms p95), 99 (% completed) */
  target: number;
  unit: "percent" | "ms";
  /** measurement window in days + expected request volume for budget math */
  windowDays: number;
  expectedRequestsPerDay: number;
  componentIds: string[];
}

export interface LatencyBudget {
  /** total deadline for the mapped request path */
  deadlineMs: number;
  /** per-component latency allocations (assumptions) */
  allocations: Record<string, number>;
}

export interface ArchitectureModel {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  components: Component[];
  connections: Connection[];
  requirements: Requirement[];
  assumptions: Assumption[];
  adrs: Adr[];
  operations: BusinessOperation[];
  dataEntities: DataEntity[];
  events: EventContract[];
  consumers: ConsumerBinding[];
  zones: TrustZone[];
  slos: SloTarget[];
  latencyBudget?: LatencyBudget;
}

// ---------------------------------------------------------------------------
// Construction + identity helpers
// ---------------------------------------------------------------------------

export function emptyModel(id: string, name: string, description = ""): ArchitectureModel {
  return {
    schemaVersion: MODEL_VERSION,
    id,
    name,
    description,
    components: [],
    connections: [],
    requirements: [],
    assumptions: [],
    adrs: [],
    operations: [],
    dataEntities: [],
    events: [],
    consumers: [],
    zones: [],
    slos: [],
  };
}

let idCounter = 0;
/** Generate a stable, collision-free id for newly created entities. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

/** Deep clone via JSON — models are plain data by contract (no code, no dates). */
export function cloneModel(m: ArchitectureModel): ArchitectureModel {
  return JSON.parse(JSON.stringify(m)) as ArchitectureModel;
}

// ---------------------------------------------------------------------------
// Validation (Task 02.2)
// ---------------------------------------------------------------------------

export interface ValidationError {
  path: string;
  message: string;
}

export function validateModel(m: ArchitectureModel): ValidationError[] {
  const errors: ValidationError[] = [];
  const push = (path: string, message: string) => errors.push({ path, message });

  if (m.schemaVersion !== MODEL_VERSION) {
    push("schemaVersion", `unsupported schema version ${m.schemaVersion} (expected ${MODEL_VERSION})`);
  }

  const componentIds = new Set<string>();
  m.components.forEach((c, i) => {
    const p = `components[${i}]`;
    if (!c.id) push(`${p}.id`, "missing id");
    else if (componentIds.has(c.id)) push(`${p}.id`, `duplicate component id ${c.id}`);
    else componentIds.add(c.id);
    if (!COMPONENT_KINDS.includes(c.kind)) push(`${p}.kind`, `unknown component kind ${c.kind}`);
    if (!c.name) push(`${p}.name`, "missing name");
    if (!c.config || typeof c.config !== "object") push(`${p}.config`, "missing config object");
    if (c.zoneId && !m.zones.some((z) => z.id === c.zoneId)) {
      push(`${p}.zoneId`, `unknown zone ${c.zoneId}`);
    }
  });

  const requirementIds = new Set<string>();
  m.requirements.forEach((r, i) => {
    const p = `requirements[${i}]`;
    if (!r.id) push(`${p}.id`, "missing id");
    else if (requirementIds.has(r.id)) push(`${p}.id`, `duplicate requirement id ${r.id}`);
    else requirementIds.add(r.id);
    if (!r.statement) push(`${p}.statement`, "missing statement");
    if (!r.acceptance || r.acceptance.length < 3) {
      push(`${p}.acceptance`, "requirements must have a reviewable acceptance condition");
    }
    if (!REQUIREMENT_CATEGORIES.includes(r.category)) {
      push(`${p}.category`, `unknown category ${r.category}`);
    }
  });

  const operationIds = new Set(m.operations.map((o) => o.id));
  const zoneIds = new Set(m.zones.map((z) => z.id));

  m.connections.forEach((cn, i) => {
    const p = `connections[${i}]`;
    if (!cn.id) push(`${p}.id`, "missing id");
    if (!componentIds.has(cn.from)) push(`${p}.from`, `unknown component ${cn.from}`);
    if (!componentIds.has(cn.to)) push(`${p}.to`, `unknown component ${cn.to}`);
    if (cn.from === cn.to) push(`${p}`, "self-connection is not allowed");
    if (cn.kind === "sync") {
      const target = m.components.find((c) => c.id === cn.to);
      if (target && target.kind === "queue") {
        push(`${p}`, "synchronous connections cannot target a queue — use async/event");
      }
    }
    if (cn.criticality < 1 || cn.criticality > 5) push(`${p}.criticality`, "criticality must be 1..5");
    if (!["blocks", "degrades", "isolated"].includes(cn.failureBehavior)) {
      push(`${p}.failureBehavior`, `unknown failure behavior ${cn.failureBehavior}`);
    }
    cn.operationIds.forEach((oid) => {
      if (!operationIds.has(oid)) push(`${p}.operationIds`, `unknown operation ${oid}`);
    });
  });

  // every requirement reference on any entity must resolve (Task 01.5)
  const checkReqRefs = (owner: string, refs: string[]) => {
    refs.forEach((rid) => {
      if (!requirementIds.has(rid)) push(`${owner}.requirementIds`, `unknown requirement ${rid}`);
    });
  };
  m.components.forEach((c) => checkReqRefs(`component:${c.id}`, c.requirementIds));
  m.connections.forEach((c) => checkReqRefs(`connection:${c.id}`, c.requirementIds));
  m.adrs.forEach((a) => {
    checkReqRefs(`adr:${a.id}`, a.requirementIds);
    if (a.requirementIds.length === 0) push(`adr:${a.id}.requirementIds`, "ADR has no motivating requirement (decision lineage)");
  });
  m.operations.forEach((o) => {
    checkReqRefs(`operation:${o.id}`, o.requirementIds);
    if (o.criticality < 1 || o.criticality > 5) push(`operation:${o.id}.criticality`, "criticality must be 1..5");
  });
  m.assumptions.forEach((a) => {
    if (a.confidence < 0 || a.confidence > 1) push(`assumption:${a.id}.confidence`, "confidence must be 0..1");
    if (!["unverified", "validated", "refuted"].includes(a.status)) {
      push(`assumption:${a.id}.status`, `unknown status ${a.status}`);
    }
  });
  m.dataEntities.forEach((d) => {
    if (!componentIds.has(d.ownerComponentId)) {
      push(`dataEntity:${d.id}.ownerComponentId`, `unknown component ${d.ownerComponentId}`);
    }
    (d.copies ?? []).forEach((cp, j) => {
      if (!componentIds.has(cp.componentId)) {
        push(`dataEntity:${d.id}.copies[${j}]`, `unknown component ${cp.componentId}`);
      }
    });
  });
  m.events.forEach((e) => {
    if (!componentIds.has(e.producerComponentId)) {
      push(`event:${e.id}.producerComponentId`, `unknown component ${e.producerComponentId}`);
    }
    const seen = new Set<number>();
    e.versions.forEach((v) => {
      if (seen.has(v.version)) push(`event:${e.id}`, `duplicate event version ${v.version}`);
      seen.add(v.version);
    });
  });
  m.consumers.forEach((c) => {
    if (!m.events.some((e) => e.id === c.eventId)) push(`consumer:${c.consumerComponentId}`, `unknown event ${c.eventId}`);
    if (!componentIds.has(c.consumerComponentId)) {
      push(`consumer`, `unknown component ${c.consumerComponentId}`);
    }
  });
  m.zones.forEach((z) => {
    if (!["internet", "dmz", "trusted", "privileged"].includes(z.trust)) {
      push(`zone:${z.id}.trust`, `unknown trust level ${z.trust}`);
    }
  });
  m.slos.forEach((s) => {
    if (s.windowDays <= 0) push(`slo:${s.id}.windowDays`, "window must be positive");
    if (s.expectedRequestsPerDay <= 0) push(`slo:${s.id}.expectedRequestsPerDay`, "expected volume must be positive");
    s.componentIds.forEach((cid) => {
      if (!componentIds.has(cid)) push(`slo:${s.id}.componentIds`, `unknown component ${cid}`);
    });
  });
  if (m.latencyBudget) {
    Object.keys(m.latencyBudget.allocations).forEach((cid) => {
      if (!componentIds.has(cid)) {
        push(`latencyBudget.allocations`, `unknown component ${cid}`);
      }
    });
  }
  // zones referenced but never defined
  m.components.forEach((c) => {
    if (c.zoneId && !zoneIds.has(c.zoneId)) push(`component:${c.id}.zoneId`, `undefined zone ${c.zoneId}`);
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Serialization + migration (Tasks 02.3, 01.5)
// ---------------------------------------------------------------------------

export class ModelFormatError extends Error {}

export function serializeModel(m: ArchitectureModel): string {
  const withVersion = { ...cloneModel(m), schemaVersion: MODEL_VERSION };
  return JSON.stringify(withVersion, null, 2);
}

/** Migrate a parsed raw model to the current MODEL_VERSION. */
export function migrateModel(raw: unknown): ArchitectureModel {
  if (!raw || typeof raw !== "object") throw new ModelFormatError("model is not an object");
  const r = raw as Record<string, unknown>;
  const version = typeof r.schemaVersion === "number" ? r.schemaVersion : -1;
  if (version > MODEL_VERSION) {
    throw new ModelFormatError(`model version ${version} is newer than supported ${MODEL_VERSION} — refusing silent migration`);
  }
  // v1 is the first version: nothing to migrate yet; the hook exists so that
  // future versions have one place to add steps and older files stay readable.
  return raw as ArchitectureModel;
}

export function parseModel(text: string): ArchitectureModel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new ModelFormatError(`invalid JSON: ${(e as Error).message}`);
  }
  const model = migrateModel(parsed);
  const errors = validateModel(model);
  if (errors.length > 0) {
    throw new ModelFormatError(`model failed validation: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`);
  }
  return model;
}

// ---------------------------------------------------------------------------
// Diff (used by ledger 04, drift 29, counterfactual 08)
// ---------------------------------------------------------------------------

export type ChangeClass =
  | "structural" | "behavioral" | "reliability" | "security" | "cost" | "documentation";

export interface ModelChange {
  target: "component" | "connection" | "requirement" | "assumption" | "adr" | "operation" | "slo" | "dataEntity";
  id: string;
  type: "added" | "removed" | "modified";
  /** what changed, e.g. "config.concurrency: 4 -> 8" */
  detail: string;
  classification: ChangeClass;
}

function classifyComponentChange(before: Component, after: Component): ModelChange[] {
  const changes: ModelChange[] = [];
  const changedKeys = new Set([...Object.keys(before.config), ...Object.keys(after.config)]);
  changedKeys.forEach((k) => {
    const b = before.config[k];
    const a = after.config[k];
    if (b !== a) {
      const cls: ChangeClass =
        k === "replicas" || k === "capacity" || k === "concurrency" || k === "memoryMB" || k === "cpuUnits"
          ? "cost"
          : k === "retryPolicy" || k === "retryMax" || k === "timeoutMs"
            ? "reliability"
            : "behavioral";
      changes.push({
        target: "component", id: after.id, type: "modified",
        detail: `config.${k}: ${String(b)} -> ${String(a)}`, classification: cls,
      });
    }
  });
  if ((before.purpose ?? "") !== (after.purpose ?? "")) {
    changes.push({
      target: "component", id: after.id, type: "modified",
      detail: `purpose changed`, classification: "documentation",
    });
  }
  if ((before.zoneId ?? "") !== (after.zoneId ?? "")) {
    changes.push({
      target: "component", id: after.id, type: "modified",
      detail: `zoneId: ${before.zoneId ?? "none"} -> ${after.zoneId ?? "none"}`, classification: "security",
    });
  }
  return changes;
}

function classifyConnectionChange(before: Connection, after: Connection): ModelChange[] {
  const changes: ModelChange[] = [];
  const diffs: [unknown, unknown, string][] = [
    [before.kind, after.kind, "kind"],
    [before.criticality, after.criticality, "criticality"],
    [before.failureBehavior, after.failureBehavior, "failureBehavior"],
    [before.latencyMs, after.latencyMs, "latencyMs"],
  ];
  diffs.forEach(([b, a, field]) => {
    if (b !== a) {
      const cls: ChangeClass = field === "criticality" || field === "failureBehavior"
        ? "reliability"
        : "behavioral";
      changes.push({ target: "connection", id: after.id, type: "modified", detail: `${field}: ${String(b)} -> ${String(a)}`, classification: cls });
    }
  });
  const beforeControls = [...(before.controls ?? [])].sort().join(",");
  const afterControls = [...(after.controls ?? [])].sort().join(",");
  if (beforeControls !== afterControls) {
    changes.push({
      target: "connection", id: after.id, type: "modified",
      detail: `controls: ${beforeControls || "none"} -> ${afterControls || "none"}`, classification: "security",
    });
  }
  return changes;
}

/** Structural diff between two model versions, with change classification (Task 04.2). */
export function diffModels(before: ArchitectureModel, after: ArchitectureModel): ModelChange[] {
  const changes: ModelChange[] = [];
  const b = new Map(before.components.map((c) => [c.id, c]));
  const a = new Map(after.components.map((c) => [c.id, c]));
  b.forEach((c, id) => {
    if (!a.has(id)) changes.push({ target: "component", id, type: "removed", detail: `removed ${c.kind} "${c.name}"`, classification: "structural" });
  });
  a.forEach((c, id) => {
    const prev = b.get(id);
    if (!prev) changes.push({ target: "component", id, type: "added", detail: `added ${c.kind} "${c.name}"`, classification: "structural" });
    else changes.push(...classifyComponentChange(prev, c));
  });

  const bcn = new Map(before.connections.map((c) => [c.id, c]));
  const acn = new Map(after.connections.map((c) => [c.id, c]));
  bcn.forEach((c, id) => {
    if (!acn.has(id)) changes.push({ target: "connection", id, type: "removed", detail: `removed ${c.from} -> ${c.to}`, classification: "structural" });
  });
  acn.forEach((c, id) => {
    const prev = bcn.get(id);
    if (!prev) changes.push({ target: "connection", id, type: "added", detail: `added ${c.from} -> ${c.to}`, classification: "structural" });
    else changes.push(...classifyConnectionChange(prev, c));
  });

  const reqB = new Set(before.requirements.map((r) => r.id));
  const reqA = new Set(after.requirements.map((r) => r.id));
  reqB.forEach((id) => { if (!reqA.has(id)) changes.push({ target: "requirement", id, type: "removed", detail: "requirement removed", classification: "documentation" }); });
  reqA.forEach((id) => { if (!reqB.has(id)) changes.push({ target: "requirement", id, type: "added", detail: "requirement added", classification: "documentation" }); });

  const adrB = new Set(before.adrs.map((r) => r.id));
  const adrA = new Set(after.adrs.map((r) => r.id));
  adrB.forEach((id) => { if (!adrA.has(id)) changes.push({ target: "adr", id, type: "removed", detail: "ADR removed", classification: "documentation" }); });
  adrA.forEach((id) => { if (!adrB.has(id)) changes.push({ target: "adr", id, type: "added", detail: "ADR added", classification: "documentation" }); });
  return changes;
}

// ---------------------------------------------------------------------------
// Shared finding type — the universal, evidence-linked analysis output.
// Every engine returns findings whose evidence names the exact entities,
// rules, and assumptions behind the claim (global requirement C).
// ---------------------------------------------------------------------------

export type Severity = "info" | "warning" | "critical";

export interface Evidence {
  /** e.g. component:api-gateway, requirement:NFR-1, rule:causal.db-latency */
  ref: string;
  detail: string;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  evidence: Evidence[];
  /** which analysis produced this (e.g. "intent", "causal") */
  source: string;
}

export function finding(
  source: string, id: string, severity: Severity, title: string,
  detail: string, evidence: Evidence[],
): Finding {
  return { id, severity, title, detail, evidence, source };
}
