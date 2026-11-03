/**
 * Campaign 04, Task 06 — Architecture Intent Compiler.
 *
 * Deterministic (no LLM): a structured intent specification — goal, workload,
 * reliability target, latency deadline, consistency needs, cost limit,
 * constraints, assumptions — is validated and compiled into a reviewable
 * STARTER canonical model with every unresolved field made explicit. The user
 * reviews and approves the compiled intent before it becomes their
 * architecture; ambiguity and contradictions are surfaced, never guessed away.
 */

import {
  type ArchitectureModel, type Requirement, emptyModel, newId,
} from "../model";

export interface IntentSpecInput {
  goal: string;
  /** peak requests per second (workload) */
  peakRps?: number;
  /** p95 acknowledgement deadline in ms */
  latencyDeadlineMs?: number;
  /** monthly availability target in percent (e.g. 99.9) */
  availabilityPercent?: number;
  /** read-after-write for user-visible status? */
  strictReadAfterWrite?: boolean;
  /** processing time per work item in seconds */
  processingSeconds?: number;
  /** modeled monthly cost cap (declared assumption unit) */
  monthlyCostCapUsd?: number;
  /** hard constraints stated as sentences */
  constraints: string[];
  /** declared assumptions (source + confidence required) */
  assumptions: { statement: string; source: string; confidence: number }[];
}

export type IntentProblemKind = "ambiguous" | "incomplete" | "contradictory" | "invalid";

export interface IntentProblem {
  kind: IntentProblemKind;
  detail: string;
}

export interface CompiledIntent {
  /** the starter model: valid, minimal, every requirement mapped */
  model: ArchitectureModel;
  /** fields the intent did NOT specify — the user must resolve them */
  unresolved: string[];
  problems: IntentProblem[];
  /** requirements created from the intent, for review */
  createdRequirements: Requirement[];
}

/** Validate + classify problems before compiling. */
export function validateIntent(raw: IntentSpecInput): IntentProblem[] {
  const problems: IntentProblem[] = [];
  if (!raw.goal || raw.goal.trim().length < 8) {
    problems.push({ kind: "invalid", detail: "goal is missing or too short to review" });
  }
  if (raw.peakRps === undefined) {
    problems.push({ kind: "incomplete", detail: "no peak workload stated — capacity decisions cannot be justified" });
  } else if (raw.peakRps <= 0 || raw.peakRps > 100_000) {
    problems.push({ kind: "invalid", detail: `peakRps ${raw.peakRps} is outside the supported range (0 < rps <= 100000)` });
  }
  if (raw.latencyDeadlineMs === undefined) {
    problems.push({ kind: "incomplete", detail: "no latency deadline stated — timeout and queueing choices are unconstrained" });
  }
  if (raw.processingSeconds === undefined) {
    problems.push({ kind: "ambiguous", detail: "processing time is unknown: cannot decide between synchronous and asynchronous processing" });
  }
  if (raw.strictReadAfterWrite === true && raw.processingSeconds !== undefined &&
      raw.latencyDeadlineMs !== undefined && raw.processingSeconds * 1000 > raw.latencyDeadlineMs) {
    problems.push({
      kind: "contradictory",
      detail: `strict read-after-write is required for RESULTS while processing takes ${raw.processingSeconds}s against a ${raw.latencyDeadlineMs} ms deadline — a result cannot be both fully processed and immediately consistent after acknowledgement; relax one of the two`,
    });
  }
  if (raw.availabilityPercent !== undefined && (raw.availabilityPercent < 50 || raw.availabilityPercent > 99.999)) {
    problems.push({ kind: "invalid", detail: `availability ${raw.availabilityPercent}% is outside the supported range` });
  }
  raw.assumptions.forEach((a, i) => {
    if (a.confidence < 0 || a.confidence > 1) {
      problems.push({ kind: "invalid", detail: `assumption ${i + 1} confidence must be 0..1` });
    }
    if (!a.source) problems.push({ kind: "incomplete", detail: `assumption ${i + 1} has no source — provenance is required` });
  });
  return problems;
}

/**
 * Compile a validated intent into a starter model. Deterministic: same input →
 * same model (stable ids derived from a fixed seed sequence).
 */
export function compileIntent(raw: IntentSpecInput): CompiledIntent {
  const problems = validateIntent(raw);
  const unresolved: string[] = [];
  const m = emptyModel("arch-intent", raw.goal.slice(0, 60) || "Untitled architecture",
    raw.goal || "");

  m.zones = [
    { id: "zone-internet", name: "Internet", trust: "internet" },
    { id: "zone-app", name: "Application", trust: "trusted" },
    { id: "zone-data", name: "Data", trust: "privileged" },
  ];

  const reqs: Requirement[] = [];
  const addReq = (r: Requirement): Requirement => { reqs.push(r); m.requirements.push(r); return r; };

  const fr = addReq({
    id: "INT-1", kind: "functional", category: "functionality",
    statement: raw.goal,
    acceptance: "A user-visible operation exists for the stated goal and its result is retrievable.",
  });

  const nfrRps = raw.peakRps !== undefined ? addReq({
    id: "INT-2", kind: "nfr", category: "throughput",
    statement: `The system sustains ${raw.peakRps} requests/sec at peak.`,
    acceptance: `Modeled queue backlog stays bounded at ${raw.peakRps} rps.`,
  }) : null;
  if (raw.peakRps === undefined) unresolved.push("peak workload (rps) — add requirement INT-2 after deciding");

  const nfrLatency = raw.latencyDeadlineMs !== undefined ? addReq({
    id: "INT-3", kind: "nfr", category: "latency",
    statement: `Acknowledgement within ${raw.latencyDeadlineMs} ms at p95.`,
    acceptance: `p95 ack latency <= ${raw.latencyDeadlineMs} ms under the stated peak.`,
  }) : null;
  if (raw.latencyDeadlineMs === undefined) unresolved.push("latency deadline — add requirement INT-3 after deciding");

  const nfrAvail = raw.availabilityPercent !== undefined ? addReq({
    id: "INT-4", kind: "nfr", category: "availability",
    statement: `Availability >= ${raw.availabilityPercent}% monthly.`,
    acceptance: `Modeled availability meets ${raw.availabilityPercent}% over a rolling 30-day window.`,
  }) : null;
  if (raw.availabilityPercent === undefined) unresolved.push("availability target — add requirement INT-4 after deciding");

  const nfrRaw = addReq({
    id: "INT-5", kind: "nfr", category: "consistency",
    statement: raw.strictReadAfterWrite
      ? "Results are immediately consistent after acknowledgement (read-after-write)."
      : "Results may lag; status is read-after-write via the synchronous status write before ack.",
    acceptance: raw.strictReadAfterWrite
      ? "A read after the ack returns the fully processed result."
      : "A status read after the ack returns at least 'processing'; the result appears within a bounded, documented window.",
  });
  if (!raw.strictReadAfterWrite) unresolved.push("staleness bound for results — set a TTL or accept the default");

  raw.constraints.forEach((c, i) => {
    m.requirements.push({
      id: `INT-C${i + 1}`, kind: "constraint", category: "functionality",
      statement: c,
      acceptance: "The constraint is checkable against the architecture (rewrite if it is not).",
    });
  });

  // --- starter skeleton mapped to the requirements ---
  const client = { id: "int-client", kind: "client" as const, name: "Client", zoneId: "zone-internet",
    purpose: "User-facing entry point (from intent)", config: {}, requirementIds: [fr.id] };
  const gateway = { id: "int-gateway", kind: "gateway" as const, name: "API gateway", zoneId: "zone-app",
    purpose: "Edge authentication and rate limiting (starter; confirm controls)", config: { rateLimitPerMin: (raw.peakRps ?? 10) * 60 },
    requirementIds: [fr.id, nfrRps?.id ?? fr.id].filter(Boolean) as string[],
    telemetry: { metrics: ["requests", "latency_p95"], logs: true, traces: true, tracePropagation: true } };
  const service = { id: "int-service", kind: "service" as const, name: "Core service", zoneId: "zone-app",
    purpose: "Implements the stated goal (starter; split as the design grows)", config: {},
    requirementIds: [fr.id, nfrLatency?.id ?? fr.id].filter(Boolean) as string[] };
  const db = { id: "int-db", kind: "database" as const, name: "Primary database", zoneId: "zone-data",
    purpose: "Authoritative state for the goal's data (starter)", config: { connPool: 50, tenantKey: "tenant_id" },
    requirementIds: [fr.id, nfrRaw.id] };
  m.components.push(client, gateway, service, db);

  m.connections.push(
    { id: "int-cn-1", from: client.id, to: gateway.id, kind: "sync", criticality: 5,
      failureBehavior: "blocks", latencyMs: 40, controls: ["ratelimit"],
      operationIds: ["int-op-1"], requirementIds: [fr.id] },
    { id: "int-cn-2", from: gateway.id, to: service.id, kind: "sync", criticality: 5,
      failureBehavior: "blocks", latencyMs: 10, controls: ["authn", "authz"],
      operationIds: ["int-op-1"], requirementIds: [fr.id] },
    { id: "int-cn-3", from: service.id, to: db.id, kind: "sync", criticality: 5,
      failureBehavior: "blocks", latencyMs: 20, access: "write", controls: ["encryption"],
      operationIds: ["int-op-1"], requirementIds: [fr.id, nfrRaw.id] },
  );

  m.operations.push({
    id: "int-op-1", name: "Primary operation (from goal)", criticality: 5,
    requirementIds: reqs.map((r) => r.id), description: raw.goal,
  });

  // processing time decides the starter shape: seconds of work => queue+worker
  if (raw.processingSeconds !== undefined && raw.processingSeconds >= 1) {
    const queue = { id: "int-queue", kind: "queue" as const, name: "Work queue", zoneId: "zone-data",
      purpose: "Decouples multi-second processing from the request path (starter, from processing-time assumption)",
      config: { capacity: 10000 }, requirementIds: [nfrLatency?.id ?? fr.id],
      telemetry: { metrics: ["queue_depth"], logs: false, traces: false, tracePropagation: false } };
    const worker = { id: "int-worker", kind: "worker" as const, name: "Processing worker", zoneId: "zone-app",
      purpose: `Processes work items (~${raw.processingSeconds}s each, declared assumption)`,
      config: { concurrency: 8, processingMs: Math.round(raw.processingSeconds * 1000), retryMax: 3, retryPolicy: "backoff" },
      requirementIds: [fr.id], telemetry: { metrics: ["processed", "processing_time", "retries"], logs: true, traces: true } };
    m.components.push(queue, worker);
    m.connections.push(
      { id: "int-cn-4", from: service.id, to: queue.id, kind: "async", criticality: 3,
        failureBehavior: "degrades", latencyMs: 5, access: "write",
        operationIds: ["int-op-1"], requirementIds: [nfrLatency?.id ?? fr.id] },
      { id: "int-cn-5", from: queue.id, to: worker.id, kind: "async", criticality: 3,
        failureBehavior: "isolated", latencyMs: 5,
        operationIds: ["int-op-1"], requirementIds: [fr.id] },
      { id: "int-cn-6", from: worker.id, to: db.id, kind: "sync", criticality: 4,
        failureBehavior: "blocks", latencyMs: 20, access: "write", controls: ["encryption"],
        operationIds: ["int-op-1"], requirementIds: [nfrRaw.id] },
    );
  } else if (raw.processingSeconds === undefined) {
    unresolved.push("communication mode for processing (queue+worker vs synchronous) — depends on processing time");
  }

  if (raw.monthlyCostCapUsd !== undefined) {
    m.requirements.push({
      id: "INT-COST", kind: "constraint", category: "cost",
      statement: `Modeled monthly infrastructure cost stays under $${raw.monthlyCostCapUsd} (declared assumption, not pricing).`,
      acceptance: `The trade-off frontier shows the design within the $${raw.monthlyCostCapUsd} cap under the declared cost assumptions.`,
    });
  }

  raw.assumptions.forEach((a, i) => {
    m.assumptions.push({
      id: `INT-ASM-${i + 1}`, statement: a.statement, source: a.source,
      confidence: a.confidence, owner: "intent-author", status: "unverified",
    });
  });

  return { model: m, unresolved, problems, createdRequirements: reqs };
}
