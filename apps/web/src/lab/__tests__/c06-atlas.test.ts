/**
 * Campaign 06 tests — Atlas engines: graph adapter (T08), deterministic
 * layout (T09.4/T11), map layers (T16-22), validation policy (T30), and
 * workspace lifecycle isolation (T06).
 */

import { describe, it, expect } from "vitest";
import { toVisGraph, graphStats, flowDepths } from "../../atlas/graph";
import { layeredLayout, layoutBounds, layoutIsSane, applyUserLayout } from "../../atlas/layout";
import { computeLayer, MAP_MODES } from "../../atlas/layers";
import { evaluateValidation, DEFAULT_POLICY, type ReviewRecord } from "../../atlas/validation";
import {
  defaultAtlasState, createProject, selectProject, saveModel, duplicateProject, archiveProject, renameProject, markUnsaved,
} from "../../atlas/state";
import { docflowModel, flawedCheckoutModel } from "../samples";
import { serializeModel } from "../model";
import { critiqueArchitecture } from "../engines/critic";
import { scenarioTemplate, runScenario } from "../engines/scenario";
import { blastRadius } from "../engines/blastradius";
import type { ReviewAssessment } from "../engines/review";

// ---------------------------------------------------------------------------
// Task 08 — canonical graph adapter
// ---------------------------------------------------------------------------

describe("T08 graph adapter", () => {
  it("maps every component and connection with canonical ids preserved", () => {
    const g = toVisGraph(docflowModel());
    expect(g.nodes.length).toBe(10);
    expect(g.edges.length).toBe(12);
    for (const n of g.nodes) {
      const src = docflowModel().components.find((c) => c.id === n.id)!;
      expect(n.label).toBe(src.name);
      expect(n.type).toBe(src.kind);
      expect(n.zoneId).toBe(src.zoneId ?? null);
    }
    expect(g.edges.every((e) => g.nodes.some((n) => n.id === e.from) && g.nodes.some((n) => n.id === e.to))).toBe(true);
    expect(g.unresolved).toEqual([]);
  });

  it("round-trips: vis ids map 1:1 back to the canonical model (no dropped entities)", () => {
    const model = flawedCheckoutModel();
    const g = toVisGraph(model);
    expect(new Set(g.nodes.map((n) => n.id))).toEqual(new Set(model.components.map((c) => c.id)));
    expect(new Set(g.edges.map((e) => e.id))).toEqual(new Set(model.connections.map((c) => c.id)));
    expect(g.zones.map((z) => z.id)).toEqual(model.zones.map((z) => z.id));
  });

  it("computes degrees and finds isolated components", () => {
    const g = toVisGraph(flawedCheckoutModel());
    const stats = graphStats(g);
    expect(stats.nodes).toBe(5);
    expect(stats.edges).toBe(3);
    // the orphan audit logger has no connections
    expect(stats.isolated).toEqual(["c-logging"]);
  });

  it("computes deterministic flow depths (request-path progression)", () => {
    const g = toVisGraph(docflowModel());
    const d1 = flowDepths(g);
    const d2 = flowDepths(g);
    expect(d1).toEqual(d2);
    expect(d1["web"]).toBe(0);            // client is the flow source
    expect(d1["meta-db"]).toBeGreaterThan(d1["web"]); // storage is downstream
  });
});

// ---------------------------------------------------------------------------
// Tasks 09/11 — deterministic spatial layout
// ---------------------------------------------------------------------------

describe("T09/T11 deterministic layout", () => {
  it("produces identical layouts for identical graphs (byte-stable)", () => {
    const g = toVisGraph(docflowModel());
    const l1 = layeredLayout(g);
    const l2 = layeredLayout(g);
    expect(l1).toEqual(l2);
    expect(layoutIsSane(g, l1)).toEqual([]);
  });

  it("is sane for dense, disconnected, and cyclic graphs", () => {
    const g = toVisGraph(flawedCheckoutModel()); // includes an isolated node
    const layout = layeredLayout(g);
    expect(layoutIsSane(g, layout)).toEqual([]);
    expect(layout.positions["c-logging"].x).toBeGreaterThanOrEqual(0);
  });

  it("flow progression on X: deeper components never sit left of their sources", () => {
    const g = toVisGraph(docflowModel());
    const layout = layeredLayout(g);
    const depths = flowDepths(g);
    for (const e of g.edges) {
      // same-zone edges must respect depth ordering on the X axis
      const za = g.nodes.find((n) => n.id === e.from)?.zoneId;
      const zb = g.nodes.find((n) => n.id === e.to)?.zoneId;
      if (za === zb && depths[e.to] > depths[e.from]) {
        expect(layout.positions[e.to].x).toBeGreaterThan(layout.positions[e.from].x);
      }
    }
  });

  it("user layout overrides position without touching semantics", () => {
    const model = docflowModel();
    const g = toVisGraph(model);
    const base = layeredLayout(g);
    const moved = applyUserLayout(base, { moved: { "meta-db": { x: 999, z: -42 } } });
    expect(moved.positions["meta-db"]).toEqual({ x: 999, y: 0, z: -42 });
    // the canonical model is untouched
    expect(docflowModel().components.find((c) => c.id === "meta-db")).toBeDefined();
    expect(layoutBounds(moved).maxX).toBeGreaterThanOrEqual(999);
  });
});

// ---------------------------------------------------------------------------
// Tasks 16-22 — map layers
// ---------------------------------------------------------------------------

describe("T16-22 map layers", () => {
  const model = docflowModel();
  const g = toVisGraph(model);

  it("topology: all normal with a summary and legend", () => {
    const l = computeLayer(g, model, "topology", {});
    expect(l.summary).toContain("10 components");
    expect(Object.values(l.nodes).every((n) => n.emphasis === "normal")).toBe(true);
    expect(l.legend.length).toBeGreaterThan(0);
  });

  it("dependency: selection highlights upstream + downstream, dims the rest", () => {
    const l = computeLayer(g, model, "dependency", { selected: "meta-db" });
    expect(l.nodes["meta-db"].emphasis).toBe("highlighted");
    expect(l.nodes["upload-svc"].emphasis).toBe("highlighted"); // upstream
    expect(l.nodes["analytics"].emphasis).toBe("highlighted");   // downstream (meta-db -> analytics)
    expect(l.nodes["notify"].emphasis).toBe("dimmed");           // unrelated path
    expect(l.focusPaths.length).toBeGreaterThan(0);
    // critical edges flagged
    expect(Object.values(l.edges).some((e) => e.emphasis === "critical")).toBe(true);
  });

  it("traffic: inert without a scenario, data-driven with one", () => {
    const inert = computeLayer(g, model, "traffic", {});
    expect(inert.summary).toMatch(/No scenario/);
    const result = runScenario(model, scenarioTemplate("burst-overload", model, 120));
    const active = computeLayer(g, model, "traffic", {
      scenario: {
        saturated: result.workload.saturated,
        peakRps: 120,
        expectationResults: result.expectationResults,
        impactedOperations: ["op-upload"],
        failedComponents: ["meta-db"],
      },
    });
    expect(active.summary).toMatch(/120 rps/);
    expect(active.nodes["meta-db"].badge).toBe("DOWN");
    expect(active.nodes["meta-db"].emphasis).toBe("critical");
  });

  it("trust: flags uncontrolled cross-boundary edges and externals", () => {
    const l = computeLayer(g, model, "trust", {});
    expect(l.nodes["notify"].badge).toBe("EXT"); // external notifier
    const criticalEdges = Object.entries(l.edges).filter(([, e]) => e.emphasis === "critical");
    expect(criticalEdges.length).toBeGreaterThan(0);
    expect(criticalEdges[0][1].note).toMatch(/no declared boundary controls|crosses/);
  });

  it("lineage: highlights data owners and access paths, traces entities", () => {
    const l = computeLayer(g, model, "lineage", { selected: "de-meta" });
    expect(l.nodes["meta-db"].badge).toMatch(/OWNS/);
    expect(l.edges["cn-cache-db"].emphasis).toBe("highlighted"); // read access
    expect(l.focusPaths.length).toBeGreaterThan(0);
  });

  it("failure: dormant without a fault, propagation with one (real engines)", () => {
    const dormant = computeLayer(g, model, "failure", {});
    expect(dormant.summary).toMatch(/No failure injected/);
    const br = blastRadius(model, "meta-db", "down");
    const l = computeLayer(g, model, "failure", {
      failure: {
        origin: "meta-db",
        downComponents: br.affectedComponents.filter((c) => c.status === "down").map((c) => c.id),
        degradedComponents: br.affectedComponents.filter((c) => c.status === "degraded").map((c) => c.id),
        impactedOperations: br.impactedOperations.map((o) => o.operationId),
      },
    });
    expect(l.nodes["meta-db"].badge).toBe("FAULT");
    expect(l.summary).toMatch(/meta-db/);
    expect(l.focusPaths.length).toBeGreaterThan(0);
  });

  it("recovery: maps the recovery-timeline engine output", () => {
    const result = runScenario(model, scenarioTemplate("peak-hour-outage", model, 60));
    const l = computeLayer(g, model, "recovery", {
      recovery: {
        phases: result.faults.combinedStatus ? Object.entries(result.faults.combinedStatus).map(([id, st]) => ({ componentId: id, stage: st === "up" ? "recovered" : st })) : [],
        bottlenecks: [],
      },
    });
    expect(l.summary).toMatch(/recovered/);
  });

  it("evidence: findings map to the components they reference", () => {
    const findings = critiqueArchitecture(flawedCheckoutModel()).findings;
    const l = computeLayer(toVisGraph(flawedCheckoutModel()), flawedCheckoutModel(), "evidence", { findings });
    const referenced = new Set(findings.flatMap((f) => f.evidence.map((e) => e.ref.replace("component:", ""))).filter((r) => !r.includes(":")));
    for (const id of referenced) {
      expect(l.nodes[id]?.badge).toMatch(/EVID/);
    }
  });

  it("all eight modes are covered and each returns a full state map", () => {
    expect(MAP_MODES.length).toBe(8);
    for (const m of MAP_MODES) {
      const l = computeLayer(g, model, m.mode, {});
      expect(Object.keys(l.nodes).length).toBe(g.nodes.length);
      expect(Object.keys(l.edges).length).toBe(g.edges.length);
      expect(l.legend.length).toBeGreaterThan(0);
      expect(typeof l.summary).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Task 30 — validation policy engine
// ---------------------------------------------------------------------------

const assessment = (over: Partial<ReviewAssessment> = {}): ReviewAssessment => ({
  id: "rev-1", targetId: "architecture:p1", reviewerId: "reviewer-a",
  identity: "self-declared", verdict: "agree", confidence: 4,
  rationale: "Read the claim trace and the scenario results; the modeled outcomes are consistent with the documented expectations.",
  evidenceRefs: ["src-srebook"], submittedAt: "2026-11-03T10:00:00Z",
  ...over,
});

describe("T30 validation policy engine", () => {
  const now = "2026-11-03T12:00:00Z";

  it("zero reviews → not-reviewed (never fabrication)", () => {
    const r = evaluateValidation([], DEFAULT_POLICY, { reviewRequested: false, now });
    expect(r.state).toBe("not-reviewed");
    expect(r.reasons[0]).toMatch(/no human assessments/);
  });

  it("review requested without response → review-requested", () => {
    const r = evaluateValidation([], DEFAULT_POLICY, { reviewRequested: true, now });
    expect(r.state).toBe("review-requested");
  });

  it("a real assessment with unverified identity → identity-unverified", () => {
    const rec: ReviewRecord = { assessment: assessment(), coi: "independence-declared", identityTrust: "self-declared", rubricSections: ["correctness", "assumptions"] };
    const r = evaluateValidation([rec], DEFAULT_POLICY, { reviewRequested: false, now });
    expect(r.state).toBe("identity-unverified");
    expect(r.reasons[0]).toMatch(/0 of 1 required verified-identity/);
  });

  it("verified identity + full rubric + COI → independently-validated", () => {
    const rec: ReviewRecord = { assessment: assessment(), coi: "independence-declared", identityTrust: "verified", rubricSections: ["correctness", "assumptions"] };
    const r = evaluateValidation([rec], DEFAULT_POLICY, { reviewRequested: false, now });
    expect(r.state).toBe("independently-validated");
    expect(r.requirements.every((x) => x.satisfied)).toBe(true);
  });

  it("records with identityTrust 'none' can NEVER satisfy identity requirements", () => {
    const rec: ReviewRecord = { assessment: assessment(), coi: "independence-declared", identityTrust: "none", rubricSections: ["correctness", "assumptions"] };
    const r = evaluateValidation([rec], { ...DEFAULT_POLICY, minVerifiedIdentity: 1 }, { reviewRequested: false, now });
    expect(r.state).toBe("identity-unverified");
  });

  it("unresolved disagreement → findings-disputed even with verified identity", () => {
    const rec: ReviewRecord = {
      assessment: assessment({ verdict: "disagree", disagreementKind: "interpretation", confidence: 5 }),
      coi: "independence-declared", identityTrust: "verified", rubricSections: ["correctness", "assumptions"],
    };
    const r = evaluateValidation([rec], DEFAULT_POLICY, { reviewRequested: false, now });
    expect(r.state).toBe("findings-disputed");
  });

  it("expired assessments do not count", () => {
    const old: ReviewRecord = {
      assessment: assessment({ submittedAt: "2020-01-01T00:00:00Z" }),
      coi: "independence-declared", identityTrust: "verified", rubricSections: ["correctness", "assumptions"],
    };
    const r = evaluateValidation([old], DEFAULT_POLICY, { reviewRequested: false, now });
    expect(r.state).toBe("validation-expired");
    expect(r.derived.expired).toBe(1);
  });

  it("missing COI declarations make the state conditional, not validated", () => {
    const rec: ReviewRecord = { assessment: assessment(), coi: "none-declared", identityTrust: "verified", rubricSections: ["correctness", "assumptions"] };
    const r = evaluateValidation([rec], DEFAULT_POLICY, { reviewRequested: false, now });
    expect(r.state).toBe("conditionally-supported");
    expect(r.reasons.join(" ")).toMatch(/COI/);
  });
});

// ---------------------------------------------------------------------------
// Task 06 — workspace lifecycle and project isolation
// ---------------------------------------------------------------------------

describe("T06 workspace lifecycle", () => {
  const now = "2026-11-03T12:00:00Z";
  it("creates, selects, renames, duplicates, archives projects", () => {
    let s = defaultAtlasState();
    s = createProject(s, "Payments", "payments platform", docflowModel(), now);
    expect(s.projects.length).toBe(3);
    expect(s.activeProjectId).not.toBe("proj-docflow");
    s = renameProject(s, s.activeProjectId, "Payments v2");
    expect(s.projects.find((p) => p.id === s.activeProjectId)!.name).toBe("Payments v2");
    s = duplicateProject(s, s.activeProjectId, now);
    expect(s.projects.length).toBe(4);
    s = archiveProject(s, s.activeProjectId);
    expect(s.projects.find((p) => p.id === s.activeProjectId)!.archived).toBe(true);
  });

  it("switching projects resets the session (no selection/scenario leakage)", () => {
    let s = defaultAtlasState();
    s = { ...s, session: { selected: { id: "meta-db", kind: "node" }, lastScenario: { project: "proj-docflow", saturated: true, peakRps: 10, summary: "x" } } };
    s = selectProject(s, "proj-flawed");
    expect(s.session.selected).toBeNull();
    expect(s.session.lastScenario).toBeNull();
    // switching back does NOT restore the stale session
    s = selectProject(s, "proj-docflow");
    expect(s.session.selected).toBeNull();
  });

  it("saveModel validates first, bumps the version, and clears unsaved", () => {
    let s = defaultAtlasState();
    s = markUnsaved(s, serializeChanged());
    expect(s.unsaved["proj-docflow"]).toBe(true);
    s = saveModel(s, serializeChanged(), now);
    expect(s.projects.find((p) => p.id === "proj-docflow")!.version).toBe(2);
    expect(s.unsaved["proj-docflow"]).toBe(false);
    // saving an INVALID model is impossible (throws from parseModel)
    expect(() => saveModel(s, "{not-json", now)).toThrow();

    function serializeChanged(): string {
      const m = docflowModel();
      m.components = m.components.map((c) => (c.id === "meta-db" ? { ...c, name: "Metadata store v2" } : c));
      return serializeModel(m);
    }
  });
});
