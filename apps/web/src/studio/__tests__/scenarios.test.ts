import { describe, expect, it } from "vitest";
import { SCENARIOS, allTopicsOf, getScenario } from "../scenarios";
import { BLUEPRINTS } from "../blueprints";
import { evaluateRequirement, relatedKinds } from "../requirements";
import { validateArchitecture, countBySeverity } from "../validation";
import { validateArchitectureShape } from "../store";
import { archFingerprint } from "../model";
import { getTopic } from "../../trail/content";
import { compareArchitectures } from "../compare";
import { reviewArchitecture } from "../review";
import { runAllFailures, summarizeFailures } from "../failures";
import { createAdr, emptyDraft, updateAdr, deleteAdr, adrToMarkdown, adrsToMarkdown, validateDraft } from "../adr";

describe("scenario library", () => {
  it("has the five required scenarios, each with substance", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["pdf-saas", "ecommerce-checkout", "realtime-collab", "notification-platform", "payments-rewards"]);
    for (const s of SCENARIOS) {
      expect(s.requirements.length).toBeGreaterThanOrEqual(9);
      expect(s.constraints.length).toBeGreaterThanOrEqual(3);
      expect(s.decoyConstraints.length).toBeGreaterThanOrEqual(2);
      expect(s.traffic.length).toBeGreaterThan(0);
      expect(s.consistency.length).toBeGreaterThan(0);
      expect(s.reliability.length).toBeGreaterThan(0);
      expect(s.security.length).toBeGreaterThan(0);
      expect(s.budget.length).toBeGreaterThan(0);
      expect(s.requirements.some((r) => r.type === "functional")).toBe(true);
      expect(s.requirements.some((r) => r.type === "non-functional")).toBe(true);
    }
  });

  it("requirement ids are globally unique and every row has decision, reason, trade-off and real topics", () => {
    const ids = SCENARIOS.flatMap((s) => s.requirements.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCENARIOS)
      for (const r of s.requirements) {
        expect(r.decision.length).toBeGreaterThan(5);
        expect(r.reason.length).toBeGreaterThan(5);
        expect(r.tradeoff.length).toBeGreaterThan(5);
        expect(r.needs.length).toBeGreaterThan(0);
        for (const t of r.topics) expect(getTopic(t)).toBeTruthy(); // only the 20 existing Foundations topics
        expect(r.topics.every((t) => t >= 1 && t <= 20)).toBe(true);
      }
  });

  it("scenarios are genuinely different (not the same empty editor)", () => {
    const sets = SCENARIOS.map((s) => s.requirements.map((r) => r.text).join("|"));
    expect(new Set(sets).size).toBe(5);
    const bl = SCENARIOS.map((s) => archFingerprint(BLUEPRINTS[s.id].baseline()));
    expect(new Set(bl).size).toBe(5);
    expect(allTopicsOf(getScenario("payments-rewards") as never).length).toBeGreaterThan(5);
  });

  it("realtime scenario does not treat a queue as a replacement for the real-time transport", () => {
    const rt = getScenario("realtime-collab");
    expect(rt?.requirements.some((r) => /persistent connection/i.test(r.text))).toBe(true);
    expect(rt?.requirements.some((r) => /queues? in the real-time path/i.test(r.text))).toBe(true);
  });

  it("the payments scenario states that payments are simulated", () => {
    expect(getScenario("payments-rewards")?.notice).toContain("SIMULATION");
  });

  it("every requirement has related components to show", () => {
    for (const s of SCENARIOS) for (const r of s.requirements) if (!r.needs.every((n) => n.test.t === "custom")) expect(relatedKinds(r).length).toBeGreaterThan(0);
  });
});

describe("starter architectures", () => {
  for (const s of SCENARIOS) {
    describe(s.id, () => {
      const bp = BLUEPRINTS[s.id];
      it("build and pass import validation", () => {
        expect(validateArchitectureShape(JSON.parse(JSON.stringify(bp.baseline()))).ok).toBe(true);
        expect(validateArchitectureShape(JSON.parse(JSON.stringify(bp.example()))).ok).toBe(true);
      });
      it("the naive baseline has real problems and little evidence; the example has far fewer problems and more evidence", () => {
        const base = bp.baseline();
        const ex = bp.example();
        const ev = (a: typeof base) => s.requirements.filter((r) => evaluateRequirement(a, r, { linkedAdrCount: 0 }).status === "evidenced").length;
        expect(ev(ex)).toBeGreaterThan(ev(base));
        expect(ev(ex)).toBeGreaterThanOrEqual(s.requirements.length - 1);
        const fb = countBySeverity(validateArchitecture(base, s));
        const fe = countBySeverity(validateArchitecture(ex, s));
        expect(fb.critical + fb.high).toBeGreaterThan(0);
        expect(fe.critical).toBe(0);
        expect(fe.critical + fe.high).toBeLessThan(fb.critical + fb.high);
      });
      it("the example is not a perfect answer: the failure lab still reports remaining gaps or unmet notes", () => {
        const sum = summarizeFailures(runAllFailures(bp.example(), s.capacity));
        expect(sum.survived.length).toBeGreaterThan(0);
        const sumBase = summarizeFailures(runAllFailures(bp.baseline(), s.capacity));
        expect(sum.survived.length).toBeGreaterThanOrEqual(sumBase.survived.length);
      });
    });
  }

  it("the collaboration example only reaches full evidence once an ADR explains ordering assumptions", () => {
    const s = getScenario("realtime-collab") as NonNullable<ReturnType<typeof getScenario>>;
    const ex = BLUEPRINTS[s.id].example();
    const r10 = s.requirements.find((r) => r.id === "rt-r10") as (typeof s.requirements)[number];
    expect(evaluateRequirement(ex, r10, { linkedAdrCount: 0 }).status).toBe("missing");
    expect(evaluateRequirement(ex, r10, { linkedAdrCount: 1 }).status).toBe("evidenced");
  });

  it("a real-time queue between websocket services breaks 'no queue in the real-time path'", () => {
    const s = getScenario("realtime-collab") as NonNullable<ReturnType<typeof getScenario>>;
    const base = BLUEPRINTS[s.id].baseline();
    const r6 = s.requirements.find((r) => r.id === "rt-r6") as (typeof s.requirements)[number];
    expect(evaluateRequirement(base, r6, { linkedAdrCount: 0 }).status).toBe("missing");
    expect(evaluateRequirement(BLUEPRINTS[s.id].example(), r6, { linkedAdrCount: 0 }).status).toBe("evidenced");
  });
});

describe("comparison mode", () => {
  const s = getScenario("pdf-saas") as NonNullable<ReturnType<typeof getScenario>>;
  const rep = compareArchitectures(BLUEPRINTS[s.id].baseline(), BLUEPRINTS[s.id].example(), s);
  it("compares all required dimensions", () => {
    const dims = rep.rows.map((r) => r.dimension);
    for (const d of ["Complexity", "Failure behavior", "User experience", "Consistency", "Operational overhead", "Approx. resource utilization", "Recovery behavior", "Cost assumptions"]) expect(dims).toContain(d);
  });
  it("explains trade-offs and does not declare a winner", () => {
    expect(rep.tradeoffs.length).toBeGreaterThan(3);
    expect(rep.tradeoffs.some((t) => t.includes("Queue"))).toBe(true);
    const text = JSON.stringify(rep).toLowerCase();
    expect(text).not.toContain("version b is better");
    expect(rep.perspective.join(" ")).toContain("simpler architecture");
    expect(rep.metricsB.components).toBeGreaterThan(rep.metricsA.components);
    expect(rep.metricsB.costUnits).toBeGreaterThan(rep.metricsA.costUnits);
  });
  it("shows failure outcome differences", () => {
    expect(rep.failures.some((f) => f.changed)).toBe(true);
  });
  it("when A already satisfies everything it says B needs separate justification", () => {
    const r2 = compareArchitectures(BLUEPRINTS[s.id].example(), BLUEPRINTS[s.id].example(), s);
    expect(r2.perspective[0]).toContain("already has structural evidence");
  });
});

describe("architecture review", () => {
  const s = getScenario("ecommerce-checkout") as NonNullable<ReturnType<typeof getScenario>>;
  it("covers all ten categories with evidence, missing, risks, questions, topics and next step", () => {
    const rv = reviewArchitecture(BLUEPRINTS[s.id].baseline(), s, [], "t");
    expect(rv.categories.map((c) => c.id)).toEqual(["functional", "reliability", "scalability", "consistency", "security", "recovery", "observability", "complexity", "cost", "maintainability"]);
    for (const c of rv.categories) {
      expect(c.evidence.length).toBeGreaterThan(0);
      expect(c.questions.length).toBeGreaterThan(0);
      expect(c.next.length).toBeGreaterThan(5);
    }
    expect(rv.categories.find((c) => c.id === "functional")?.missing.length).toBeGreaterThan(5);
  });
  it("an empty architecture honestly reports nothing addressed", () => {
    const rv = reviewArchitecture({ version: 1, seq: 0, nodes: [], connections: [] }, s, [], "t");
    expect(rv.categories.find((c) => c.id === "security")?.evidence[0]).toContain("Nothing");
  });
  it("review reflects improvements (fewer missing functional items)", () => {
    const a = reviewArchitecture(BLUEPRINTS[s.id].baseline(), s, [], "t").categories[0].missing.length;
    const b = reviewArchitecture(BLUEPRINTS[s.id].example(), s, [], "t").categories[0].missing.length;
    expect(b).toBeLessThan(a);
  });
});

describe("ADRs", () => {
  const draft = { ...emptyDraft(), title: "Process PDFs asynchronously", decision: "Use a queue and workers for PDF generation.", reason: "Generation takes up to two minutes.", relatedRequirementIds: ["pdf-r3"], relatedTopicIds: [15, 99], relatedNodeIds: ["n1"] };
  it("creates sequential ADRs, normalises links, edits and deletes", () => {
    const r = createAdr([], draft, "t1");
    if ("error" in r) throw new Error("unexpected");
    expect(r.adr.id).toBe("ADR-001");
    expect(r.adr.relatedTopicIds).toEqual([15]); // invalid topic 99 dropped
    const r2 = createAdr(r.adrs, { ...draft, title: "Second" }, "t2");
    if ("error" in r2) throw new Error("unexpected");
    expect(r2.adr.id).toBe("ADR-002");
    const u = updateAdr(r2.adrs, "ADR-001", { status: "Accepted" }, "t3");
    if ("error" in u) throw new Error("unexpected");
    expect(u.adrs[0].status).toBe("Accepted");
    expect(u.adrs[0].updatedAt).toBe("t3");
    expect(deleteAdr(u.adrs, "ADR-001")).toHaveLength(1);
  });
  it("rejects incomplete ADRs", () => {
    expect(validateDraft(emptyDraft()).length).toBe(3);
    expect("error" in createAdr([], emptyDraft(), "t")).toBe(true);
  });
  it("exports the documented structure", () => {
    const r = createAdr([], draft, "t1");
    if ("error" in r) throw new Error("unexpected");
    const s = getScenario("pdf-saas") as NonNullable<ReturnType<typeof getScenario>>;
    const md = adrToMarkdown(r.adr, { arch: BLUEPRINTS["pdf-saas"].baseline(), requirements: s.requirements, topicTitle: (t) => getTopic(t)?.title ?? "?" });
    for (const h of ["# ADR-001 — Process PDFs asynchronously", "## Status", "## Context", "## Decision", "## Alternatives", "## Consequences", "## Related Requirements", "## Related Topics"]) expect(md).toContain(h);
    expect(md).toContain("Generate large PDFs asynchronously");
    expect(md).toContain("Message Queues");
    expect(adrsToMarkdown([], { arch: BLUEPRINTS["pdf-saas"].baseline(), requirements: [], topicTitle: () => "" })).toContain("No decisions");
  });
});
