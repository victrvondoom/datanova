/**
 * Campaign 05 tests — grounding (T06-T10), counterexamples (T18), and the
 * nonvisual representation engine (T03/T04).
 */

import { describe, it, expect } from "vitest";
import { SOURCES, validateSourceRegistry, sourceById } from "../engines/sources";
import { CLAIMS, validateClaimRegistry, groundingIsIntact } from "../engines/claims";
import { CASES, validateCaseLibrary } from "../engines/cases";
import { explainFinding, groundingSummary } from "../engines/grounding";
import { buildCounterexamples, runCounterexamples } from "../engines/counterexamples";
import { topologySummary, topologySummaryText, propagationText, comparisonText } from "../engines/nonvisual";
import { docflowModel, flawedCheckoutModel } from "../samples";
import { critiqueArchitecture } from "../engines/critic";
import { causalFindings } from "../engines/causal";
import { extractGenome, compareGenomes } from "../engines/genome";
import type { Finding } from "../model";

// ---------------------------------------------------------------------------
// Task 06 / 08 — source registry integrity
// ---------------------------------------------------------------------------

describe("T06/T08 external source registry", () => {
  it("registers only well-formed sources (the registry is the ground truth)", () => {
    expect(validateSourceRegistry(SOURCES)).toEqual([]);
    expect(SOURCES.length).toBeGreaterThanOrEqual(15);
  });

  it("every source has real metadata: https URL, dates, topics, note, section, attribution", () => {
    for (const s of SOURCES) {
      expect(s.url.startsWith("https://")).toBe(true);
      expect(s.note.length).toBeGreaterThanOrEqual(20);
      expect(s.sectionRef.length).toBeGreaterThan(0);
      expect(s.attribution.length).toBeGreaterThan(0);
    }
  });

  it("covers the required engineering topics", () => {
    const topics = new Set(SOURCES.flatMap((s) => s.topics));
    for (const required of ["reliability", "queueing", "retries", "consistency", "idempotency", "security", "observability", "recovery", "slo"]) {
      expect([...topics].some((t) => t.includes(required) || required.includes(t))).toBe(true);
    }
  });

  it("rejects malformed and duplicate sources", () => {
    const bad = [
      SOURCES[0],
      SOURCES[0], // duplicate id
      { ...SOURCES[0], id: "bad-http", url: "http://insecure.example", published: "???", accessed: "nope", topics: [], note: "", sectionRef: "", attribution: "" },
    ];
    const problems = validateSourceRegistry(bad);
    expect(problems.length).toBeGreaterThan(5);
    expect(problems.some((p) => p.problem.includes("duplicate"))).toBe(true);
    expect(problems.some((p) => p.problem.includes("https"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 07 — claim-to-source mapping
// ---------------------------------------------------------------------------

describe("T07 claim registry", () => {
  it("is intact: no dangling references, no falsely grounded claims", () => {
    expect(validateClaimRegistry(CLAIMS, SOURCES)).toEqual([]);
    expect(groundingIsIntact()).toBe(true);
  });

  it("every external claim cites at least one existing source with a section", () => {
    const external = CLAIMS.filter((c) => c.kind === "external");
    expect(external.length).toBeGreaterThanOrEqual(10);
    for (const c of external) {
      expect(c.sources.length).toBeGreaterThanOrEqual(1);
      for (const sid of c.sources) {
        expect(sourceById(sid)).toBeDefined();
      }
    }
  });

  it("internal claims are honestly labeled and never presented as external", () => {
    const internal = CLAIMS.filter((c) => c.kind !== "external");
    expect(internal.length).toBeGreaterThanOrEqual(3);
    for (const c of internal) {
      expect(c.sources.length).toBeLessThanOrEqual(2);
      if (c.sources.length > 0) expect(c.labDelta).toBeDefined();
    }
  });

  it("fails when an external claim cites nothing (falsely grounded)", () => {
    const problems = validateClaimRegistry(
      [...CLAIMS, { id: "claim-fake", statement: "invented fact", kind: "external", sources: [], appliesTo: ["x"] }],
      SOURCES,
    );
    expect(problems.some((p) => p.claimId === "claim-fake" && p.problem.includes("falsely grounded"))).toBe(true);
  });

  it("fails on dangling source references", () => {
    const problems = validateClaimRegistry(
      [...CLAIMS, { id: "claim-dangle", statement: "cites nothing real", kind: "external", sources: ["src-nope"], appliesTo: ["x"] }],
      SOURCES,
    );
    expect(problems.some((p) => p.claimId === "claim-dangle" && p.problem.includes("dangling"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 09 — grounded case library
// ---------------------------------------------------------------------------

describe("T09 grounded case library", () => {
  it("validates: every fact cites an existing source and adaptations are declared", () => {
    expect(validateCaseLibrary(CASES)).toEqual([]);
    expect(CASES.length).toBeGreaterThanOrEqual(6);
  });

  it("covers the required dimensions", () => {
    const dims = new Set(CASES.map((c) => c.dimension));
    for (const d of ["availability", "overload", "consistency", "tenant-isolation", "security", "recovery"]) {
      expect(dims.has(d as never)).toBe(true);
    }
  });

  it("separates source facts from Datanova adaptations in every case", () => {
    for (const c of CASES) {
      expect(c.facts.length).toBeGreaterThanOrEqual(1);
      expect(c.adaptations.length).toBeGreaterThanOrEqual(1);
      for (const f of c.facts) {
        expect(sourceById(f.sourceId)).toBeDefined();
      }
    }
  });

  it("rejects a case that claims grounding without sources", () => {
    const problems = validateCaseLibrary([
      ...CASES,
      { id: "case-fake", title: "x", dimension: "security", facts: [], adaptations: [], discussionPoints: [], modeledBy: [] },
    ]);
    expect(problems.some((p) => p.caseId === "case-fake")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 10 — grounded explanation layer
// ---------------------------------------------------------------------------

describe("T10 grounded explanations", () => {
  it("explains critic findings with claims, sources, sections, and conditions", () => {
    const { findings } = critiqueArchitecture(flawedCheckoutModel());
    const spof = findings.find((f) => f.id.startsWith("critic-spof:"));
    expect(spof).toBeDefined();
    const ex = explainFinding(spof!);
    expect(ex.confidence).toBe("grounded");
    expect(ex.claims.some((c) => c.id === "claim-spof-redundancy")).toBe(true);
    expect(ex.sources.some((s) => s.id === "src-releaseit")).toBe(true);
    expect(ex.sources.every((s) => s.sectionRef.length > 0)).toBe(true);
    expect(ex.conditions.length).toBe(1); // the "does NOT apply when" clause
  });

  it("labels the complexity heuristic as internal-model, never grounded", () => {
    const { findings } = critiqueArchitecture(flawedCheckoutModel());
    const orphan = findings.find((f) => f.id.startsWith("critic-orphan:"));
    const ex = explainFinding(orphan!);
    expect(ex.confidence).toBe("internal-model");
    expect(ex.sources).toEqual([]);
  });

  it("reports insufficient evidence for unknown findings instead of inventing citations", () => {
    const unknown: Finding = {
      id: "mystery-engine:1", severity: "info", title: "t", detail: "d", evidence: [],
    } as unknown as Finding;
    expect(explainFinding(unknown).confidence).toBe("insufficient");
  });

  it("summarizes grounding across a full findings set", () => {
    const { findings } = critiqueArchitecture(flawedCheckoutModel());
    const s = groundingSummary(findings);
    expect(s.grounded + s.internalModel + s.insufficient).toBe(findings.length);
    expect(s.grounded).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Task 18 — counterexample corpus
// ---------------------------------------------------------------------------

describe("T18 counterexamples challenge the critic", () => {
  it("the corpus passes: control fires, false-positive challenges do not", () => {
    const results = runCounterexamples(buildCounterexamples());
    expect(results.length).toBe(5);
    for (const r of results) {
      expect({ id: r.counterexampleId, passed: r.passed, actual: r.actual, expected: r.expected })
        .toEqual(expect.objectContaining({ passed: true }));
    }
    const control = results.find((r) => r.counterexampleId === "cx-control-spof")!;
    expect(control.actual).toBe("finding");
    expect(results.filter((r) => r.counterexampleId !== "cx-control-spof").every((r) => r.actual === "no-finding")).toBe(true);
  });

  it("a counterexample that regresses is reported as failing (not hidden)", () => {
    const cases = buildCounterexamples();
    cases[1].expected = "finding"; // deliberately wrong expectation
    const results = runCounterexamples(cases);
    expect(results[1].passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tasks 03/04 — nonvisual representation
// ---------------------------------------------------------------------------

describe("T03/T04 nonvisual representation engine", () => {
  it("summarizes topology deterministically with zones and connections", () => {
    const m = docflowModel();
    const s1 = topologySummary(m);
    const s2 = topologySummary(m);
    expect(s1).toEqual(s2);
    expect(s1.overview).toBe("10 components across 4 trust zones, 12 connections");
    expect(s1.zones.length).toBe(4);
    expect(topologySummaryText(s1).length).toBe(1 + s1.zones.length + s1.connections.length);
  });

  it("describes failure propagation as ordered, severity-labeled text", () => {
    const m = docflowModel();
    const chain = causalFindings(m, { componentId: "meta-db", fault: "down" });
    const lines = propagationText(chain, "Metadata database");
    expect(lines[0]).toContain("propagates through");
    expect(lines[1]).toMatch(/^[12]. (Critical|Warning|Info):/);
  });

  it("describes architecture comparisons nonvisually", () => {
    const diffs = compareGenomes(extractGenome(docflowModel()), extractGenome(flawedCheckoutModel()));
    expect(diffs.length).toBeGreaterThan(0);
    const text = comparisonText("DocFlow", "Flawed checkout", diffs.map((d) => ({ kind: "genome", description: d.interpretation })));
    expect(text.length).toBeGreaterThan(1);
    expect(comparisonText("A", "B", [])[0]).toContain("semantically equivalent");
  });
});
