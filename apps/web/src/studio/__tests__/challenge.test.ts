import { describe, expect, it } from "vitest";
import {
  CHALLENGE_STEPS, acknowledge, challengeSummary, constraintFeedback, constraintOptions, finalize, recordCompare, recordFailure, recordValidation,
  revealHint, startChallenge, submitConstraints, tryAdvance, ChallengeState,
} from "../challenge";
import { emptyArchitecture, addNode, connect, setProp } from "../model";
import { Builder, BLUEPRINTS } from "../blueprints";
import { getScenario } from "../scenarios";
import { createAdr, emptyDraft, Adr } from "../adr";

const sc = getScenario("pdf-saas") as NonNullable<ReturnType<typeof getScenario>>;
const sketch = () => new Builder().n("c", "client", 0, 0).n("s", "app_service", 1, 0).n("d", "postgres", 2, 0).c("c", "s", "sync").c("s", "d", "data").build();
const adr = (): Adr[] => {
  const r = createAdr([], { ...emptyDraft(), title: "Async PDFs", decision: "Queue plus workers for PDF generation", reason: "Generation takes up to two minutes per document" }, "t");
  if ("error" in r) throw new Error("bad");
  return r.adrs;
};

describe("guided challenge", () => {
  it("has the eleven required steps", () => {
    expect(CHALLENGE_STEPS).toHaveLength(11);
    for (const s of CHALLENGE_STEPS) expect(s.hints).toHaveLength(3);
  });

  it("does not advance until each gate is objectively met", () => {
    let s: ChallengeState = startChallenge(sc.id);
    const ctx = { arch: emptyArchitecture(), adrs: [] as Adr[] };
    expect(tryAdvance(s, ctx).advanced).toBe(false);
    s = tryAdvance(acknowledge(s, 0), ctx).state;
    expect(s.step).toBe(1);
    s = tryAdvance(acknowledge(s, 1), ctx).state;
    s = tryAdvance(acknowledge(s, 2), ctx).state;
    expect(s.step).toBe(3);
    // constraints: nothing selected -> blocked
    expect(tryAdvance(submitConstraints(s, []), ctx).advanced).toBe(false);
    s = tryAdvance(submitConstraints(s, [sc.constraints[0]]), ctx).state;
    expect(s.step).toBe(4);
    // sketch: blank canvas blocked, with an informative reason
    const blocked = tryAdvance(s, ctx);
    expect(blocked.advanced).toBe(false);
    expect(blocked.reason).toContain("need ≥ 3");
  });

  it("a full honest run completes and a shortcut does not", () => {
    const arch0 = sketch();
    let s = startChallenge(sc.id);
    const run = (st: ChallengeState, arch = arch0, adrs: Adr[] = []) => tryAdvance(st, { arch, adrs });
    s = run(acknowledge(s, 0)).state; s = run(acknowledge(s, 1)).state; s = run(acknowledge(s, 2)).state;
    s = run(submitConstraints(s, [sc.constraints[0], sc.decoyConstraints[0]])).state;
    s = run(s).state; // sketch -> captures initial snapshot
    expect(s.initialSnapshot).not.toBeNull();
    expect(s.step).toBe(5);
    expect(run(s).advanced).toBe(false); // no ADR yet
    s = run(s, arch0, adr()).state;
    expect(run(s).advanced).toBe(false); // not validated yet
    s = run(recordValidation(s)).state;
    expect(run(s).advanced).toBe(false); // no failure injected yet
    s = run(recordFailure(s, "api-503")).state;
    expect(s.archAtFailure).not.toBeNull();
    // moving boxes is not an improvement
    const moved = { ...arch0, nodes: arch0.nodes.map((n) => ({ ...n, x: n.x + 100 })) };
    expect(run(s, moved).advanced).toBe(false);
    // a real change is
    const improved = setProp(arch0, arch0.nodes[1].id, "instances", 3);
    s = run(s, improved).state;
    expect(s.step).toBe(9);
    // compare is blocked when nothing differs
    expect(recordCompare(s, arch0).ok).toBe(false);
    const cmp = recordCompare(s, improved);
    expect(cmp.ok).toBe(true);
    s = run(cmp.state, improved).state;
    expect(s.step).toBe(10);
    const fin = finalize(s, { arch: improved, adrs: adr() });
    expect(fin.ok).toBe(true);
    expect(fin.state.finalized).toBe(true);
  });

  it("cannot be finalized by skipping steps", () => {
    const s = { ...startChallenge(sc.id), step: 10 };
    expect(finalize(s, { arch: sketch(), adrs: adr() }).ok).toBe(false);
    expect(finalize(startChallenge(sc.id), { arch: sketch(), adrs: adr() }).ok).toBe(false);
  });

  it("an ADR with a trivial reason does not satisfy the explain step", () => {
    const r = createAdr([], { ...emptyDraft(), title: "x y z", decision: "Use a queue", reason: "quick one" }, "t");
    if ("error" in r) throw new Error("bad");
    let s = startChallenge(sc.id);
    s = { ...s, step: 5 };
    expect(tryAdvance(s, { arch: sketch(), adrs: r.adrs }).advanced).toBe(false);
  });

  it("hints are progressive, capped, and never contain a full solution", () => {
    let s = startChallenge(sc.id);
    for (let i = 0; i < 5; i++) s = revealHint(s, 4);
    expect(s.hints[4]).toBe(3);
    const text = CHALLENGE_STEPS.flatMap((x) => x.hints).join(" ").toLowerCase();
    for (const forbidden of ["idempotency store", "dead letter queue", "api gateway"]) expect(text).not.toContain(forbidden);
  });

  it("constraint identification scores correct picks, decoys and misses", () => {
    const picks = [sc.constraints[0], sc.decoyConstraints[0]];
    const s = submitConstraints(startChallenge(sc.id), picks);
    const fb = constraintFeedback(s, sc);
    expect(fb.correct).toEqual([sc.constraints[0]]);
    expect(fb.wrong).toEqual([sc.decoyConstraints[0]]);
    expect(fb.missed).toHaveLength(sc.constraints.length - 1);
    const opts = constraintOptions(sc);
    expect(opts).toHaveLength(sc.constraints.length + sc.decoyConstraints.length);
  });

  it("completion summary reports addressed/unresolved, survived/unhandled, decisions, topics, study areas and simplicity", () => {
    const initial = BLUEPRINTS[sc.id].baseline();
    const final = BLUEPRINTS[sc.id].example();
    const state: ChallengeState = { ...startChallenge(sc.id), initialSnapshot: initial, hints: { 4: 2, 5: 1 } };
    const sum = challengeSummary(state, sc, final, adr(), sc.capacity);
    expect(sum.requirementsAddressed.length + sum.requirementsUnresolved.length).toBe(sc.requirements.length);
    expect(sum.requirementsAddressed.length).toBeGreaterThan(8);
    expect(sum.failuresSurvived.length + sum.failuresNotHandled.length + sum.failuresNotApplicable.length).toBe(12);
    expect(sum.decisionsRecorded).toBe(1);
    expect(sum.hintsUsed).toBe(3);
    expect(sum.topicsPracticed.length).toBeGreaterThan(3);
    expect(sum.initialVsFinal.find((r) => r.label === "Components")).toEqual({ label: "Components", initial: "4", final: "17" });
    expect(sum.simplicity.components).toBe(17);
    expect(sum.furtherStudy.length).toBeGreaterThan(0); // honest: the worked example still has gaps
  });

  it("padding an architecture with unneeded components is visible as unjustified, not rewarded", () => {
    let a = BLUEPRINTS[sc.id].baseline();
    for (const k of ["saga", "tx_coordinator", "event_bus"] as const) a = addNode(a, k);
    const sum = challengeSummary({ ...startChallenge(sc.id), initialSnapshot: a }, sc, a, [], sc.capacity);
    expect(sum.simplicity.unjustified.length).toBeGreaterThan(0);
    expect(sum.requirementsAddressed.length).toBeLessThan(3);
  });

  it("connect helper sanity", () => {
    const a = addNode(addNode(emptyArchitecture(), "client"), "app_service");
    expect(connect(a, a.nodes[0].id, a.nodes[1].id, "sync").ok).toBe(true);
  });
});
