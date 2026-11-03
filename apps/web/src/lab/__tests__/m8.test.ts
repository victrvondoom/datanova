/**
 * Campaign 03, Milestone 8 tests — explanations (T36), challenges (T37),
 * critic (T38), debate (T39), mission (T40).
 */

import { describe, it, expect } from "vitest";
import { cloneModel } from "../model";
import { docflowModel, flawedCheckoutModel } from "../samples";
import { explainComponent, checkGrounding, explanationAtMaxLevel } from "../engines/explain";
import {
  generateChallenge, estimateDifficulty, recommendChallenge, validateChallenge, SUPPORTED_CONCEPTS,
} from "../engines/challenges";
import { critiqueArchitecture, criticSummary } from "../engines/critic";
import { processingDecouplingDebate, checkDebateConsistency, recordDecision } from "../engines/debate";
import { docflowMission, evaluateMission, recordRevision, type RevisionRecord } from "../engines/mission";

// ---------------------------------------------------------------------------
// Task 36 — explanation compiler
// ---------------------------------------------------------------------------

describe("T36 architecture explanation compiler", () => {
  it("generates grounded explanations at three levels of progressive detail", () => {
    const concise = explainComponent(docflowModel(), "work-queue", "concise")!;
    const advanced = explainComponent(docflowModel(), "work-queue", "advanced")!;
    expect(concise.text.length).toBeLessThan(advanced.text.length);
    expect(advanced.text).toContain("ADR-1");
    expect(advanced.text).toContain("provisional");
    expect(explainComponent(docflowModel(), "ghost", "concise")).toBeNull();
  });

  it("explanations reference only existing entities (grounding check)", () => {
    const e = explainComponent(docflowModel(), "upload-svc", "advanced")!;
    expect(checkGrounding(docflowModel(), e)).toEqual([]);
    // a fabricated explanation fails the grounding check
    expect(checkGrounding(docflowModel(), { ...e, sources: [...e.sources, "component:ghost"] }))
      .toEqual(["source references unknown component ghost"]);
  });

  it("explanations never claim unsupported guarantees", () => {
    const e = explainComponent(docflowModel(), "doc-store", "advanced")!;
    expect(e.uncertainties.some((u) => u.includes("educational rule set"))).toBe(true);
    expect(e.text).not.toContain("guaranteed");
    expect(e.supportsRequirements.every((r) => r.acceptance.length > 0)).toBe(true);
  });

  it("progressive disclosure filters depth without changing content grounding", () => {
    const capped = explanationAtMaxLevel(docflowModel(), "worker", "intermediate")!;
    expect(capped.level).toBe("intermediate");
    expect(capped.text).not.toContain("Trade-offs on record");
    expect(checkGrounding(docflowModel(), capped)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 37 — challenge generator
// ---------------------------------------------------------------------------

describe("T37 adaptive challenge generator", () => {
  it("generates controlled variations deterministically", () => {
    const a = generateChallenge("ch-1", { trafficMultiplier: 2, maxDeployables: 6 });
    const b = generateChallenge("ch-1", { trafficMultiplier: 2, maxDeployables: 6 });
    expect(a).toEqual(b);
    expect(a.constraints.some((c) => c.includes("2x"))).toBe(true);
    expect(a.constraints.some((c) => c.includes("At most 6 deployable"))).toBe(true);
    expect(a.expectedConcepts).toContain("error-budgets");
  });

  it("strict consistency is a harder variation", () => {
    const base = generateChallenge("ch-base");
    const strict = generateChallenge("ch-strict", { strictConsistency: true });
    expect(estimateDifficulty(strict)).toBeGreaterThan(estimateDifficulty(base));
    expect(strict.requirements.find((r) => r.id === "C-4")!.statement).toContain("immediately consistent");
  });

  it("recommends from verified prior performance only", () => {
    const catalog = [
      generateChallenge("ch-a"),
      generateChallenge("ch-b", { strictConsistency: true }),
      generateChallenge("ch-c", { trafficMultiplier: 3, availabilityTarget: 99.95, maxDeployables: 5 }),
    ];
    const none = recommendChallenge(catalog, { solvedChallenges: [], demonstratedConcepts: [] })!;
    expect(none.reason).toContain("no verified prior performance");
    expect(none.challenge.id).toBe("ch-a"); // easiest first
    const progressed = recommendChallenge(catalog, {
      solvedChallenges: ["ch-a"],
      demonstratedConcepts: ["queueing", "async-decoupling", "idempotency", "retries"],
    })!;
    expect(progressed.challenge.id).not.toBe("ch-a");
    expect(progressed.reason).toContain("verified completions only");
  });

  it("validates solvability within the supported model", () => {
    const ok = generateChallenge("ch-ok");
    expect(validateChallenge(ok).valid).toBe(true);
    const broken = { ...generateChallenge("ch-bad"), expectedConcepts: ["federated-learning"] };
    const v = validateChallenge(broken);
    expect(v.valid).toBe(false);
    expect(v.problems[0]).toContain("outside the supported model");
    expect(SUPPORTED_CONCEPTS.length).toBeGreaterThanOrEqual(14);
  });
});

// ---------------------------------------------------------------------------
// Task 38 — evidence-grounded critic
// ---------------------------------------------------------------------------

describe("T38 architecture critic", () => {
  it("criticizes the flawed checkout with grounded evidence", () => {
    const { findings, rulesFired } = critiqueArchitecture(flawedCheckoutModel());
    expect(rulesFired).toContain("spof");
    const spof = findings.find((f) => f.id.startsWith("critic-spof:"))!;
    expect(spof.detail).toContain("does NOT apply when");
    expect(spof.evidence[0].ref.startsWith("component:")).toBe(true);
    // the audit logger is complexity without a requirement
    expect(findings.find((f) => f.id === "critic-orphan:c-logging")).toBeTruthy();
    // unidempotent mutating service
    expect(findings.find((f) => f.id === "critic-idem:c-api")).toBeTruthy();
  });

  it("the flawed fixture has a far higher finding density than the reference", () => {
    const good = criticSummary(docflowModel());
    const bad = criticSummary(flawedCheckoutModel());
    const density = (x: typeof good, n: number) => (x.criticals + x.warnings) / n;
    expect(density(bad, flawedCheckoutModel().components.length))
      .toBeGreaterThan(density(good, docflowModel().components.length));
    // and it fires the orphan rule the reference does not
    const badFindings = critiqueArchitecture(flawedCheckoutModel()).findings;
    expect(badFindings.some((f) => f.id.startsWith("critic-orphan:"))).toBe(true);
    expect(critiqueArchitecture(docflowModel()).findings.some((f) => f.id.startsWith("critic-orphan:"))).toBe(false);
  });

  it("recommendations are conditional, never generic", () => {
    const { findings } = critiqueArchitecture(flawedCheckoutModel());
    findings.forEach((f) => {
      if (f.detail.includes("Recommendation")) {
        expect(f.detail).toContain("does NOT apply when");
      }
    });
  });

  it("penalizes unjustified complexity (no component without a purpose)", () => {
    const m = cloneModel(docflowModel());
    m.components.push({ id: "kafka", kind: "broker", name: "Kafka cluster", purpose: "", config: {}, requirementIds: [] });
    const { findings } = critiqueArchitecture(m);
    expect(findings.find((f) => f.id === "critic-orphan:kafka")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Task 39 — decision debate workspace
// ---------------------------------------------------------------------------

describe("T39 decision debate workspace", () => {
  it("presents alternatives with structured arguments under the same requirements", () => {
    const d = processingDecouplingDebate(docflowModel());
    expect(d.alternatives.length).toBe(3);
    expect(d.alternatives.every((a) => a.evidence.every((e) => /^(component|requirement|adr|connection|assumption|rule):/.test(e)))).toBe(true);
    const c = checkDebateConsistency(d);
    expect(c.consistent).toBe(true);
  });

  it("detects unfair comparisons (inconsistent assumptions)", () => {
    const d = processingDecouplingDebate(docflowModel());
    d.alternatives[0].assumptions = ["a", "b", "c", "d", "e", "f"]; // loaded dice
    const c = checkDebateConsistency(d);
    expect(c.consistent).toBe(false);
    expect(c.problems.some((p) => p.includes("not fair"))).toBe(true);
    const vague = processingDecouplingDebate(docflowModel());
    vague.alternatives[1].preferableWhen = "always";
    expect(checkDebateConsistency(vague).problems.some((p) => p.includes("preference condition"))).toBe(true);
  });

  it("records the decision as an ADR with rejected alternatives", () => {
    const d = processingDecouplingDebate(docflowModel());
    const adr = recordDecision(d, "alt-queue", "processing time exceeds the ack deadline by 15x");
    expect(adr.status).toBe("accepted");
    expect(adr.requirementIds).toEqual(d.requirementIds);
    expect(adr.alternatives.length).toBe(2);
    expect(adr.alternatives.every((a) => a.rejectedBecause.length > 20)).toBe(true);
    expect(() => recordDecision(d, "alt-ghost", "")).toThrow(/unknown alternative/);
  });
});

// ---------------------------------------------------------------------------
// Task 40 — design under constraints mission
// ---------------------------------------------------------------------------

describe("T40 design under constraints mission", () => {
  it("the mission defines constraints, unknowns, and progressive reveal stages", () => {
    const mission = docflowMission();
    expect(mission.requirements.length).toBe(5);
    expect(mission.constraints.length).toBe(5);
    expect(mission.unknowns.length).toBe(3);
    expect(mission.stages.map((s) => s.revealAt)).toEqual(["start", "after-design", "after-first-analysis"]);
    expect(mission.stages[2].information).toContain("doubles");
  });

  it("revision tracking records what changed and why per reveal", () => {
    let revisions: RevisionRecord[] = [];
    revisions = recordRevision(revisions, "after-first-analysis",
      "doubled worker concurrency to 16", "MC-5 doubled peak traffic; Little's law doubled required slots");
    expect(revisions.length).toBe(1);
    expect(revisions[0].changedAndWhy).toContain("MC-5");
  });

  it("evaluation rewards coverage, simplicity, and evidence — not component count", () => {
    const mission = docflowMission();
    const model = docflowModel();
    // docflow has 9 deployables > bound 8: must be flagged
    let revisions: RevisionRecord[] = [];
    revisions = recordRevision(revisions, "after-first-analysis", "split workers", "MC-5");
    const eval1 = evaluateMission(mission, model, revisions);
    expect(eval1.deployablesWithinBound).toBe(false);
    expect(eval1.overall).toBe("needs-work");
    expect(eval1.notes.some((n) => n.includes("deployable count"))).toBe(true);
    // deletion coverage is incomplete in the seeded model (stores not in the delete op)
    expect(eval1.deletionCoverage.some((d) => !d.covered)).toBe(true);

    const trimmed = cloneModel(model);
    trimmed.components = trimmed.components.filter((c) => c.id !== "analytics" && c.id !== "notify");
    trimmed.connections = trimmed.connections.filter((cn) => cn.from !== "analytics" && cn.to !== "notify");
    const eval2 = evaluateMission(mission, trimmed, revisions);
    expect(eval2.deployablesWithinBound).toBe(true);
    expect(eval2.orphanComponents).toEqual([]);
  });

  it("no revisions means needs-work: the reveal must force a recorded decision", () => {
    const evalNoRev = evaluateMission(docflowMission(), docflowModel(), []);
    expect(evalNoRev.revisionsTracked).toBe(false);
    expect(evalNoRev.overall).toBe("needs-work");
  });
});
