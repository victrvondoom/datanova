/**
 * Campaign 03, Milestone 1 tests — canonical model (T02), intent (T01),
 * semantic graph (T03), design ledger (T04), constraints (T05).
 */

import { describe, it, expect } from "vitest";
import {
  validateModel, serializeModel, parseModel, cloneModel, diffModels,
  emptyModel, ModelFormatError, type ArchitectureModel,
} from "../model";
import { docflowModel, flawedCheckoutModel } from "../samples";
import { analyzeIntent, coverageMap, explainComponent, isCovered } from "../engines/intent";
import {
  physicalView, dependencyView, operationView, causalLinks,
  downstreamClosure, upstreamClosure, findCycle, syncDepthFrom,
} from "../engines/graph";
import { createLedger, takeSnapshot, restore, summarizeChanges } from "../engines/ledger";
import {
  missingContext, findConflicts, clarifications, analyzeConstraints, CONSTRAINT_TAXONOMY,
} from "../engines/constraints";

// ---------------------------------------------------------------------------
// Task 02 — canonical model
// ---------------------------------------------------------------------------

describe("T02.1/T02.2 canonical schema + semantic validation", () => {
  it("the reference architecture validates cleanly", () => {
    expect(validateModel(docflowModel())).toEqual([]);
  });

  it("rejects unknown component kinds", () => {
    const m = docflowModel();
    (m.components[0] as unknown as { kind: string }).kind = "mainframe";
    const errs = validateModel(m as ArchitectureModel);
    expect(errs.some((e) => e.message.includes("unknown component kind"))).toBe(true);
  });

  it("rejects duplicate component ids and missing acceptance conditions", () => {
    const m = docflowModel();
    m.components.push({ ...m.components[0] });
    m.requirements.push({ id: "FR-1", kind: "functional", category: "functionality", statement: "dup", acceptance: "" });
    const errs = validateModel(m);
    expect(errs.some((e) => e.message.includes("duplicate component id"))).toBe(true);
    expect(errs.some((e) => e.message.includes("acceptance condition"))).toBe(true);
  });

  it("rejects dangling connection endpoints and self-connections", () => {
    const m = docflowModel();
    m.connections.push({ ...m.connections[0], id: "cn-bad", from: "ghost", to: "gateway" });
    m.connections.push({ ...m.connections[0], id: "cn-self", from: "web", to: "web" });
    const errs = validateModel(m);
    expect(errs.some((e) => e.message.includes("unknown component ghost"))).toBe(true);
    expect(errs.some((e) => e.message.includes("self-connection"))).toBe(true);
  });

  it("rejects synchronous connections targeting a queue", () => {
    const m = docflowModel();
    m.connections.push({ ...m.connections[0], id: "cn-sync-queue", from: "gateway", to: "work-queue", kind: "sync" });
    expect(validateModel(m).some((e) => e.message.includes("cannot target a queue"))).toBe(true);
  });

  it("rejects unknown requirement references on any entity", () => {
    const m = docflowModel();
    m.components[1].requirementIds.push("NFR-999");
    expect(validateModel(m).some((e) => e.path.includes("requirementIds") && e.message.includes("NFR-999"))).toBe(true);
  });

  it("rejects unknown operations, bad criticality, invalid assumptions, unknown zones/SLO refs", () => {
    const m = docflowModel();
    m.connections[0].operationIds.push("op-ghost");
    m.connections[0].criticality = 9;
    m.assumptions.push({ id: "ASM-bad", statement: "x", source: "y", confidence: 2, owner: "z", status: "unverified" });
    m.slos[0].componentIds.push("ghost");
    m.components[0].zoneId = "zone-ghost";
    const errs = validateModel(m);
    expect(errs.some((e) => e.message.includes("unknown operation op-ghost"))).toBe(true);
    expect(errs.some((e) => e.message.includes("criticality must be 1..5"))).toBe(true);
    expect(errs.some((e) => e.message.includes("confidence must be 0..1"))).toBe(true);
    expect(errs.some((e) => e.message.includes("unknown component ghost"))).toBe(true);
    expect(errs.some((e) => e.message.includes("unknown zone zone-ghost"))).toBe(true);
  });

  it("flags ADRs with no motivating requirement (decision lineage)", () => {
    const m = docflowModel();
    m.adrs.push({ id: "ADR-bare", title: "t", context: "c", decision: "d", status: "proposed", requirementIds: [], alternatives: [] });
    expect(validateModel(m).some((e) => e.message.includes("no motivating requirement"))).toBe(true);
  });
});

describe("T02.3/T01.5 versioning, migration, round-trip", () => {
  it("serialize -> parse round-trips the full intent model", () => {
    const m = docflowModel();
    const parsed = parseModel(serializeModel(m));
    expect(parsed).toEqual(m);
  });

  it("rejects newer schema versions loudly (no silent migration)", () => {
    const raw = serializeModel(docflowModel()).replace('"schemaVersion": 1', '"schemaVersion": 99');
    expect(() => parseModel(raw)).toThrow(ModelFormatError);
    expect(() => parseModel(raw)).toThrow(/newer than supported/);
  });

  it("rejects malformed JSON and semantically invalid imports", () => {
    expect(() => parseModel("{not json")).toThrow(ModelFormatError);
    const invalid = { ...docflowModel(), connections: [{ ...docflowModel().connections[0], from: "ghost" }] };
    expect(() => parseModel(JSON.stringify(invalid))).toThrow(/failed validation/);
  });

  it("cloneModel breaks aliasing (mutating a clone leaves the original intact)", () => {
    const m = docflowModel();
    const c = cloneModel(m);
    c.components[0].name = "changed";
    c.latencyBudget!.deadlineMs = 1;
    expect(m.components[0].name).toBe("Web client");
    expect(m.latencyBudget!.deadlineMs).toBe(800);
  });
});

describe("T02.5 model integrity: diff + stable identity across edits", () => {
  it("classifies structural, cost, reliability, and security changes", () => {
    const before = docflowModel();
    const after = cloneModel(before);
    after.components.push({
      id: "audit-log", kind: "service", name: "Audit log", purpose: "append-only audit trail",
      config: {}, requirementIds: ["CON-2"],
    });
    after.components.find((c) => c.id === "worker")!.config.concurrency = 16;
    after.connections.find((c) => c.id === "cn-gw-up")!.failureBehavior = "degrades";
    after.connections.find((c) => c.id === "cn-gw-up")!.controls = ["authn"];
    const changes = diffModels(before, after);
    expect(changes.find((c) => c.id === "audit-log")?.classification).toBe("structural");
    expect(changes.find((c) => c.detail.includes("concurrency"))?.classification).toBe("cost");
    expect(changes.find((c) => c.detail.includes("failureBehavior"))?.classification).toBe("reliability");
    expect(changes.find((c) => c.detail.includes("controls"))?.classification).toBe("security");
    // stable identity: all unchanged component ids survive the edit
    before.components.forEach((c) => expect(after.components.some((x) => x.id === c.id)).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// Task 01 — intent compiler
// ---------------------------------------------------------------------------

describe("T01 intent compiler", () => {
  it("maps requirements to components, connections, ADRs, operations, SLOs", () => {
    const cov = coverageMap(docflowModel());
    expect(cov["FR-1"].components).toContain("upload-svc");
    expect(cov["NFR-1"].connections.length).toBeGreaterThan(0);
    expect(cov["NFR-1"].adrs).toContain("ADR-1");
    expect(cov["NFR-3"].operations).toContain("op-upload");
    expect(isCovered(cov["FR-1"])).toBe(true);
  });

  it("detects requirements with no architecture support", () => {
    const m = docflowModel();
    m.requirements.push({
      id: "NFR-9", kind: "nfr", category: "latency",
      statement: "Processing completes within 5 minutes at p99.",
      acceptance: "p99 processing time <= 300 s",
    });
    const findings = analyzeIntent(m);
    const uncovered = findings.find((f) => f.id === "intent-uncovered:NFR-9");
    expect(uncovered?.severity).toBe("critical");
    expect(uncovered?.evidence[0].ref).toBe("requirement:NFR-9");
  });

  it("detects purposeless components and unmotivated ADRs", () => {
    const findings = analyzeIntent(flawedCheckoutModel());
    expect(findings.find((f) => f.id === "intent-orphan:c-logging")).toBeTruthy();
    const m = flawedCheckoutModel();
    m.adrs.push({ id: "ADR-bare", title: "Use sync payment", context: "c", decision: "d", status: "accepted", requirementIds: [], alternatives: [] });
    expect(analyzeIntent(m).find((f) => f.id === "intent-adr-unmotivated:ADR-bare")).toBeTruthy();
  });

  it("keeps explicitly unresolved requirements visible", () => {
    const m = docflowModel();
    m.requirements[0].unresolved = true;
    expect(analyzeIntent(m).find((f) => f.id === "intent-unresolved:FR-1")).toBeTruthy();
  });

  it("explains why a component exists, with trade-offs and lineage", () => {
    const intent = explainComponent(docflowModel(), "work-queue");
    expect(intent?.purpose).toContain("Buffers processing work");
    expect(intent?.supportsRequirements).toContain("NFR-1");
    expect(intent?.inOperations).toContain("op-process");
    expect(intent?.decidedBy).toContain("ADR-1");
    expect(intent?.introducesTradeoffs.length).toBeGreaterThan(0);
    expect(explainComponent(docflowModel(), "nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 03 — semantic dependency and causal graph
// ---------------------------------------------------------------------------

describe("T03 semantic + causal graph", () => {
  it("physical/dependency/operation views share the canonical topology", () => {
    const m = docflowModel();
    expect(physicalView(m).edges.length).toBe(m.connections.length);
    const upload = operationView(m, "op-upload");
    expect(upload.nodes).toContain("doc-store");
    expect(upload.edges.every((e) => e.connectionId !== "cn-db-analytics")).toBe(true);
    expect(dependencyView(m).nodes.length).toBe(m.components.length);
  });

  it("causal links encode latency, queue-depth, and idempotency relations", () => {
    const links = causalLinks(docflowModel());
    expect(links.some((l) => l.relation.includes("increases Upload service request duration"))).toBe(true);
    expect(links.some((l) => l.relation.includes("increases Work queue depth"))).toBe(true);
    expect(links.some((l) => l.relation.includes("duplicate side effects"))).toBe(true);
    expect(links.some((l) => l.connectionId === "cn-up-db")).toBe(true);
  });

  it("computes downstream and upstream closures", () => {
    const m = docflowModel();
    expect(upstreamClosure(m, "meta-db")).toContain("upload-svc");
    expect(upstreamClosure(m, "meta-db")).toContain("worker");
    expect(downstreamClosure(m, "web")).toContain("doc-store");
    expect(upstreamClosure(m, "analytics")).toContain("meta-db");
  });

  it("detects cycles and survives removal of components", () => {
    const cyclic = emptyModel("cyc", "cyclic");
    cyclic.components = [
      { id: "a", kind: "service", name: "A", config: {}, requirementIds: [] },
      { id: "b", kind: "service", name: "B", config: {}, requirementIds: [] },
      { id: "c", kind: "service", name: "C", config: {}, requirementIds: [] },
    ];
    cyclic.connections = [
      { id: "e1", from: "a", to: "b", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
      { id: "e2", from: "b", to: "c", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
      { id: "e3", from: "c", to: "a", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
    ];
    const cycle = findCycle(cyclic);
    expect(cycle).not.toBeNull();
    expect(new Set(cycle)).toEqual(new Set(["a", "b", "c"]));
    // removing the cycle-breaking edge removes the cycle
    cyclic.connections = cyclic.connections.slice(0, 2);
    expect(findCycle(cyclic)).toBeNull();
    // acyclic reference model
    expect(findCycle(docflowModel())).toBeNull();
  });

  it("computes synchronous dependency depth with a cycle guard", () => {
    const m = docflowModel();
    expect(syncDepthFrom(m, "web")).toBe(3); // web->gateway->upload-svc->(store|db)
    const cyclic = emptyModel("cyc", "cyclic");
    cyclic.components = [
      { id: "a", kind: "service", name: "A", config: {}, requirementIds: [] },
      { id: "b", kind: "service", name: "B", config: {}, requirementIds: [] },
    ];
    cyclic.connections = [
      { id: "e1", from: "a", to: "b", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
      { id: "e2", from: "b", to: "a", kind: "sync", criticality: 3, failureBehavior: "blocks", operationIds: [], requirementIds: [] },
    ];
    expect(syncDepthFrom(cyclic, "a")).toBeLessThanOrEqual(2); // terminates
  });
});

// ---------------------------------------------------------------------------
// Task 04 — versioned design ledger
// ---------------------------------------------------------------------------

describe("T04 design ledger", () => {
  const t0 = "2026-01-01T00:00:00Z";
  const t1 = "2026-01-02T00:00:00Z";

  it("snapshots are immutable: editing a restored copy never mutates history", () => {
    const m = docflowModel();
    let ledger = createLedger(m.id);
    ledger = takeSnapshot(ledger, m, { label: "v1 baseline", createdAt: t0 });
    const restored = restore(ledger, 1);
    restored.components[0].name = "hacked";
    restored.requirements = [];
    expect(ledger.snapshots[0].model.components[0].name).toBe("Web client");
    expect(ledger.snapshots[0].model.requirements.length).toBeGreaterThan(0);
  });

  it("versions are ordered, classified, and lineage-linked", () => {
    const m = docflowModel();
    let ledger = createLedger(m.id);
    ledger = takeSnapshot(ledger, m, { label: "baseline", createdAt: t0, motivation: "initial design" });
    const changed = cloneModel(m);
    changed.components.find((c) => c.id === "worker")!.config.concurrency = 16;
    ledger = takeSnapshot(ledger, changed, { label: "scale workers", createdAt: t1, motivation: "queue backlog at peak", adrId: "ADR-1", requirementId: "NFR-5" });
    expect(ledger.snapshots.map((s) => s.version)).toEqual([1, 2]);
    const snap2 = ledger.snapshots[1];
    expect(snap2.motivation).toBe("queue backlog at peak");
    expect(snap2.adrId).toBe("ADR-1");
    expect(summarizeChanges(snap2.changes).cost).toBe(1);
    expect(restore(ledger, 1)).not.toEqual(restore(ledger, 2));
  });

  it("restore rejects unknown versions", () => {
    const ledger = takeSnapshot(createLedager(), docflowModel(), { label: "v1", createdAt: t0 });
    expect(() => restore(ledger, 99)).toThrow(/no snapshot version 99/);
  });
});

function createLedager() { return createLedger("arch-docflow"); }

// ---------------------------------------------------------------------------
// Task 05 — constraint and assumption discovery
// ---------------------------------------------------------------------------

describe("T05 constraints + assumptions", () => {
  it("taxonomizes ten constraint categories", () => {
    expect(CONSTRAINT_TAXONOMY.length).toBe(10);
  });

  it("detects missing context categories with reasons", () => {
    const missing = missingContext(docflowModel()).map((m) => m.category);
    expect(missing).toContain("privacy");
    expect(missing).toContain("deployment");
    expect(missing).toContain("ops-skill");
    expect(missing).not.toContain("latency");
  });

  it("detects immediate-consistency vs async-hop conflicts", () => {
    const conflicts = findConflicts(docflowModel());
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].requirementId).toBe("NFR-3");
    expect(conflicts[0].evidence.some((e) => e.startsWith("connection:"))).toBe(true);
  });

  it("a consistent architecture produces no conflicts", () => {
    const m = flawedCheckoutModel();
    m.requirements[2].statement = "Inventory is eventually reconciled nightly.";
    expect(findConflicts(m)).toEqual([]);
  });

  it("surfaces unverified assumptions with provenance", () => {
    const findings = analyzeConstraints(docflowModel());
    const asm = findings.find((f) => f.id === "constraints-assumption:ASM-1");
    expect(asm?.detail).toContain("product estimate");
    expect(asm?.detail).toContain("unverified");
  });

  it("derives guided clarifications from real gaps", () => {
    const qs = clarifications(docflowModel());
    expect(qs.some((q) => q.category === "privacy" && q.howAnswersChangeTheDesign.length > 0)).toBe(true);
    expect(qs.some((q) => q.question.includes("NFR-3"))).toBe(true);
  });
});
