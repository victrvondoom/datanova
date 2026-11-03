/**
 * Campaign 03, Milestone 2 tests — genome (T06), mutations (T07),
 * counterfactual experiments (T08), causal propagation (T09),
 * blast radius (T10).
 */

import { describe, it, expect } from "vitest";
import {
  type ArchitectureModel, emptyModel, validateModel, cloneModel,
} from "../model";
import { docflowModel } from "../samples";
import { extractGenome, compareGenomes, fingerprintOf } from "../engines/genome";
import {
  addCache, addIdempotency, addQueueBetween, addRetryPolicy, makeAsync,
  splitService, mutationRegressions, MutationPreconditionError,
} from "../engines/mutations";
import { runExperiment, modeledMetrics, type CounterfactualExperiment } from "../engines/counterfactual";
import { propagate, causalFindings, CAUSAL_RULES } from "../engines/causal";
import { blastRadius, criticality, blastRadiusFindings } from "../engines/blastradius";

function miniModel(): ArchitectureModel {
  // client -> api (service) -> worker (sync, blocking) -> db (sync, blocking)
  const m = emptyModel("mini", "mini");
  m.components = [
    { id: "cl", kind: "client", name: "Client", config: {}, requirementIds: [] },
    { id: "api", kind: "service", name: "API", config: { idempotent: false }, requirementIds: [] },
    { id: "wk", kind: "worker", name: "Worker", config: { retryMax: 2 }, requirementIds: [] },
    { id: "db", kind: "database", name: "DB", config: { connPool: 10 }, requirementIds: [] },
  ];
  m.connections = [
    { id: "e1", from: "cl", to: "api", kind: "sync", criticality: 5, failureBehavior: "blocks", latencyMs: 10, operationIds: [], requirementIds: [] },
    { id: "e2", from: "api", to: "wk", kind: "sync", criticality: 5, failureBehavior: "blocks", latencyMs: 20, operationIds: [], requirementIds: [] },
    { id: "e3", from: "wk", to: "db", kind: "sync", criticality: 5, failureBehavior: "blocks", latencyMs: 30, operationIds: [], requirementIds: [] },
  ];
  return m;
}

// ---------------------------------------------------------------------------
// Task 06 — genome
// ---------------------------------------------------------------------------

describe("T06 architecture genome", () => {
  it("extracts traits from the canonical model", () => {
    const g = extractGenome(docflowModel());
    const v = (k: string) => g.traits.find((t) => t.key === k)?.value;
    expect(v("syncDepth")).toBe(3);
    expect(v("queues")).toBe(1);
    expect(v("caches")).toBe(1);
    expect(v("statefulStores")).toBe(3);
    expect(v("externalDeps")).toBe(1);
    expect(v("idempotencyCoverage")).toBe(0); // no service is idempotent yet
  });

  it("is order-insensitive: reordering components leaves the fingerprint equal", () => {
    const a = docflowModel();
    const b = cloneModel(a);
    b.components.reverse();
    b.connections.reverse();
    expect(extractGenome(a).fingerprint).toBe(extractGenome(b).fingerprint);
  });

  it("reflects meaningful changes", () => {
    const before = extractGenome(docflowModel());
    const mutated = addIdempotency(docflowModel(), "upload-svc").model;
    const after = extractGenome(mutated);
    expect(after.fingerprint).not.toBe(before.fingerprint);
    const deltas = compareGenomes(before, after);
    expect(deltas.find((d) => d.key === "idempotencyCoverage")).toMatchObject({ before: 0, after: 1 });
  });

  it("fingerprints are deterministic", () => {
    const g = extractGenome(docflowModel());
    expect(fingerprintOf(g.traits)).toBe(extractGenome(docflowModel()).fingerprint);
  });
});

// ---------------------------------------------------------------------------
// Task 07 — mutations
// ---------------------------------------------------------------------------

describe("T07 mutation engine", () => {
  it("addQueueBetween converts a blocking sync edge into a buffered async path", () => {
    const base = miniModel();
    const { model, explanation } = addQueueBetween(base, "e2");
    expect(validateModel(model)).toEqual([]);
    const q = model.components.find((c) => c.kind === "queue");
    expect(q).toBeTruthy();
    expect(model.connections.find((c) => c.id === "e2")?.kind).toBe("async");
    expect(model.connections.some((c) => c.from === q!.id && c.to === "wk")).toBe(true);
    // the original model is untouched (no aliasing)
    expect(base.components.some((c) => c.kind === "queue")).toBe(false);
    expect(base.connections.find((c) => c.id === "e2")?.kind).toBe("sync");
    // explanation covers problem, change, benefit, trade-offs
    expect(explanation.problem).toContain("blocked");
    expect(explanation.structuralChange).toContain("queue");
    expect(explanation.expectedBenefit.length).toBeGreaterThan(10);
    expect(explanation.tradeoffs.length).toBeGreaterThanOrEqual(2);
    // no regression: unrelated state preserved, protections intact
    expect(mutationRegressions(base, model)).toEqual([]);
  });

  it("rejects invalid mutation applications with reasons", () => {
    const base = miniModel();
    expect(() => addQueueBetween(base, "ghost")).toThrow(MutationPreconditionError);
    const df = docflowModel();
    expect(() => addQueueBetween(df, "cn-up-queue")).toThrow(/requires a synchronous/);
    expect(() => addCache(df, "cn-gw-status")).toThrow(/not cache/); // edge already ends at a cache
    expect(() => makeAsync(df, "cn-web-gw")).toThrow(/cannot make a client-facing/);
    expect(() => addIdempotency(df, "doc-store")).toThrow(/services\/workers/);
    expect(() => addRetryPolicy(df, "gateway", 99)).toThrow(/0\.\.10/);
    expect(() => addIdempotency(addIdempotency(df, "upload-svc").model, "upload-svc")).toThrow(/already idempotent/);
  });

  it("addCache inserts a read-through cache and re-points the reader", () => {
    const df = docflowModel();
    const { model } = addCache(df, "cn-up-db");
    expect(validateModel(model)).toEqual([]);
    expect(model.connections.find((c) => c.id === "cn-up-db")?.to).toMatch(/^cache-/);
    expect(model.connections.some((c) => c.to === "meta-db" && c.from.startsWith("cache-"))).toBe(true);
    expect(mutationRegressions(df, model)).toEqual([]);
  });

  it("addRetryPolicy and makeAsync behave and explain trade-offs", () => {
    const df = docflowModel();
    const r = addRetryPolicy(df, "gateway", 3, "backoff");
    expect(r.model.components.find((c) => c.id === "gateway")?.config.retryMax).toBe(3);
    expect(r.explanation.tradeoffs.some((t) => t.includes("duplicate"))).toBe(true);
    const a = makeAsync(df, "cn-cache-db");
    expect(a.model.connections.find((c) => c.id === "cn-cache-db")?.kind).toBe("async");
    expect(a.explanation.tradeoffs.some((t) => t.includes("status model"))).toBe(true);
  });

  it("splitService divides dependencies and preserves requirements", () => {
    const df = docflowModel();
    const { model, explanation } = splitService(df, "upload-svc");
    expect(validateModel(model)).toEqual([]);
    const half = model.components.find((c) => c.name === "Upload service (B)");
    expect(half).toBeTruthy();
    // the moved edges (store, queue, db -> slice(2) = [db]) now start at the new service
    expect(model.connections.find((c) => c.id === "cn-up-db")?.from).toBe(half!.id);
    // upstream caller reaches both halves
    expect(model.connections.filter((c) => c.from === "gateway" && (c.to === "upload-svc" || c.to === half!.id)).length).toBe(2);
    expect(mutationRegressions(df, model)).toEqual([]);
    expect(explanation.tradeoffs.length).toBeGreaterThanOrEqual(2);
  });

  it("mutationRegressions detects sabotage of existing protections", () => {
    const before = addIdempotency(docflowModel(), "upload-svc").model;
    const after = cloneModel(before);
    after.components.find((c) => c.id === "upload-svc")!.config.idempotent = false;
    expect(mutationRegressions(before, after)).toEqual(
      expect.arrayContaining([expect.stringContaining("idempotent")]),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 08 — counterfactual experiments
// ---------------------------------------------------------------------------

describe("T08 counterfactual experiment engine", () => {
  const experiment = (): CounterfactualExperiment => {
    const baseline = miniModel();
    const modified = addQueueBetween(baseline, "e2").model;
    return {
      id: "exp-1", label: "queue the worker",
      baseline, modified,
      scenario: { id: "sc-1", name: "peak load", description: "steady 10 rps" },
      declaredChanges: ["syncDepth", "asyncEdges"],
    };
  };

  it("computes modeled metrics from the canonical model", () => {
    const mm = modeledMetrics(miniModel());
    expect(mm.syncDepth).toBe(3);
    expect(mm.criticalPathLatencyMs).toBe(60); // 10+20+30
    expect(mm.idempotencyGaps).toBe(1);
  });

  it("attributes outcome differences to the changed trait", () => {
    const out = runExperiment(experiment());
    const syncDepth = out.deltas.find((d) => d.key === "syncDepth");
    expect(syncDepth).toMatchObject({ baseline: 3, modified: 1, improved: true });
    expect(out.explanation.some((e) => e.includes("syncDepth"))).toBe(true);
    expect(out.genomeDeltas.map((d) => d.key)).toContain("queues");
    expect(out.uncertainties.length).toBeGreaterThan(0);
  });

  it("flags undeclared changes as uncontrolled variables", () => {
    const exp = experiment();
    exp.declaredChanges = ["syncDepth"]; // queues changed too but not declared
    const out = runExperiment(exp);
    expect(out.uncontrolledChanges).toContain("queues");
    expect(out.explanation.some((e) => e.includes("UNCONTROLLED"))).toBe(true);
  });

  it("is reproducible: identical inputs give identical outputs", () => {
    const a = runExperiment(experiment());
    const b = runExperiment(experiment());
    expect(a).toEqual(b);
    expect(a.reproducible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 09 — causal failure propagation
// ---------------------------------------------------------------------------

describe("T09 causal propagation engine", () => {
  it("propagates a metadata-db failure through the documented rules", () => {
    const m = docflowModel();
    const r = propagate(m, { componentId: "meta-db", fault: "down" });
    expect(r.finalStatus["upload-svc"]).toBe("down"); // R-SYNC-BLOCK via cn-up-db
    expect(r.finalStatus["worker"]).toBe("down"); // via cn-worker-db
    expect(r.finalStatus["gateway"]).toBe("down"); // via cn-gw-up
    expect(r.finalStatus["web"]).toBe("down");
    expect(r.finalStatus["status-cache"]).toBe("degraded"); // cn-cache-db degrades
    // analytics is behind an isolated event edge: not affected
    expect(r.finalStatus["analytics"]).toBe("up");
    expect(r.chains.length).toBeGreaterThan(0);
    const workerChain = r.chains.find((c) => c.affectedComponentId === "worker");
    expect(workerChain?.path[0]).toBe("meta-db");
    expect(workerChain?.rulesFired).toContain("R-SYNC-BLOCK");
  });

  it("records retry amplification toward the failed dependency", () => {
    const m = docflowModel();
    const r = propagate(m, { componentId: "meta-db", fault: "down" });
    // worker has retryMax=3 facing meta-db: load factor 1 -> 4
    expect(r.loadFactor["meta-db"]).toBe(4);
    const amp = r.events.find((e) => e.ruleId === "R-RETRY-AMP");
    expect(amp?.componentId).toBe("meta-db");
    expect(amp?.confidence).toBe(CAUSAL_RULES["R-RETRY-AMP"].confidence);
  });

  it("models queue growth when the worker is down", () => {
    const m = docflowModel();
    const r = propagate(m, { componentId: "worker", fault: "down" });
    expect(r.queueDepthRounds["work-queue"]).toBeGreaterThan(0);
    expect(r.events.some((e) => e.ruleId === "R-QUEUE-GROW")).toBe(true);
    // the queue isolates the upload path: upload-svc stays up
    expect(r.finalStatus["upload-svc"]).toBe("up");
  });

  it("propagates slow (latency) faults multiplicatively", () => {
    const m = docflowModel();
    const r = propagate(m, { componentId: "meta-db", fault: "slow" });
    expect(r.finalStatus["meta-db"]).toBe("degraded");
    expect(r.latencyFactor["meta-db"]).toBe(2);
    expect(r.latencyFactor["upload-svc"]).toBe(2); // R-LATENCY-PROP over cn-up-db
    expect(r.latencyFactor["work-queue"]).toBe(1); // async edges do not propagate wait time
    expect(r.finalStatus["work-queue"]).toBe("up");
    expect(r.latencyFactor["gateway"]).toBe(4); // waits on two degraded sync deps
    expect(r.latencyFactor["web"]).toBe(4);
  });

  it("terminates on cyclic dependency graphs", () => {
    const m = miniModel();
    m.connections.push({ id: "e4", from: "db", to: "api", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] });
    const r = propagate(m, { componentId: "db", fault: "down" });
    expect(r.events.length).toBeLessThan(200);
    expect(r.finalStatus["api"]).toBe("down");
    expect(r.finalStatus["cl"]).toBe("down");
  });

  it("produces evidence-linked causal findings", () => {
    const findings = causalFindings(docflowModel(), { componentId: "meta-db", fault: "down" });
    const workerFinding = findings.find((f) => f.title.includes("Processing worker"));
    expect(workerFinding?.severity).toBe("critical");
    expect(workerFinding?.detail).toContain("R-SYNC-BLOCK");
    expect(workerFinding?.evidence.every((e) => e.ref.startsWith("component:"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 10 — blast radius and criticality
// ---------------------------------------------------------------------------

describe("T10 blast-radius analyzer", () => {
  it("computes criticality from explicit factors", () => {
    const c = criticality(docflowModel(), "meta-db");
    expect(c?.maxOperationCriticality).toBe(5);
    expect(c?.dependents).toBe(6); // web, gateway, upload-svc, worker, status-cache, analytics (event consumer)
    expect(c?.ownsDataEntities).toBe(1);
    expect(c?.stateful).toBe(true);
    expect(c?.score).toBeGreaterThan(3);
    expect(criticality(docflowModel(), "ghost")).toBeNull();
  });

  it("isolated failures have a near-zero blast radius", () => {
    const br = blastRadius(docflowModel(), "analytics", "down");
    expect(br.affectedComponents).toEqual([]); // nothing else is affected
    expect(br.impactedOperations.map((o) => o.operationId)).toEqual(["op-report"]); // its own operation only
  });

  it("a metadata-db failure impacts upload, process, status, and reporting", () => {
    const br = blastRadius(docflowModel(), "meta-db", "down");
    const impacted = br.impactedOperations.map((o) => o.operationId).sort();
    expect(impacted).toEqual(["op-delete", "op-process", "op-report", "op-status", "op-upload"]);
    const upload = br.impactedOperations.find((o) => o.operationId === "op-upload");
    expect(upload?.directImpactedComponents).toContain("meta-db");
    expect(upload?.indirectImpactedComponents).toContain("web");
  });

  it("compares against an architecture without isolation boundaries", () => {
    const br = blastRadius(docflowModel(), "worker", "down");
    const withBoundaries = br.affectedComponents.length;
    expect(br.withoutIsolation.affectedCount).toBeGreaterThan(withBoundaries);
    expect(br.protectedByBoundaries).toContain("cn-queue-worker");
  });

  it("produces user-facing impact findings with boundary explanations", () => {
    const findings = blastRadiusFindings(docflowModel(), "meta-db", "down");
    expect(findings.some((f) => f.title.includes("Upload document"))).toBe(true);
    const boundary = findings.find((f) => f.id.startsWith("blast-boundary:"));
    expect(boundary?.detail).toContain("Without them");
  });
});
