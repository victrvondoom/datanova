/**
 * Guided system-design challenge: a gated 11-step state machine.
 * Completion is earned: each step has an objective gate computed from the
 * learner's real work (canvas, ADRs, recorded validation/failure runs).
 * No hint ever reveals a full solution, and there is no opaque score.
 */
import { Architecture, archFingerprint } from "./model";
import { Adr } from "./adr";
import { CapacityInputs, fromArchitecture } from "./capacity";
import { FailureId, SURVIVED, getFailure, runAllFailures } from "./failures";
import { Scenario } from "./scenarios";
import { evaluateRequirement } from "./requirements";
import { countBySeverity, validateArchitecture } from "./validation";
import { KIND_DEFS, str } from "./model";
import { kindsRequiredBy } from "./requirements";

export interface ChallengeState {
  scenarioId: string;
  step: number;
  ack: number[];
  constraintsPicked: string[];
  constraintsSubmitted: boolean;
  hints: Record<number, number>;
  initialSnapshot: Architecture | null;
  validated: boolean;
  failuresInjected: FailureId[];
  archAtFailure: string | null;
  compared: boolean;
  finalized: boolean;
  /** steps whose gate was met when the learner advanced */
  passed: number[];
}

export interface GateCtx {
  arch: Architecture;
  adrs: Adr[];
}

export interface StepDef {
  title: string;
  instruction: string;
  /** progressive hints: 1 nudge, 2 concept pointer, 3 stronger pointer — never the design itself */
  hints: [string, string, string];
  gate: (s: ChallengeState, c: GateCtx) => { met: boolean; need: string };
}

export const CHALLENGE_STEPS: StepDef[] = [
  { title: "Read the scenario", instruction: "Read the product scenario. Who uses it, and what could go wrong?",
    hints: ["What is the one thing the product must never get wrong?", "Look for words like ‘spike’, ‘duplicate’, ‘external’.", "Each scary word maps to a concept in the Foundations trail."],
    gate: (s) => ({ met: s.ack.includes(0), need: "Confirm you have read the scenario." }) },
  { title: "Reveal functional requirements", instruction: "Read what the system must do.",
    hints: ["Which of these is the slowest operation?", "Slow operations rarely belong inside a request.", "Topic 15 explains how to take slow work out of the request path."],
    gate: (s) => ({ met: s.ack.includes(1), need: "Confirm you have read the functional requirements." }) },
  { title: "Reveal non-functional requirements", instruction: "Read the qualities the system must have under stress.",
    hints: ["Which requirement describes a failure rather than a feature?", "Failures need a plan: wait less, retry smarter, or fail fast.", "Topics 10–13 cover timeouts, retries, backoff and circuit breakers."],
    gate: (s) => ({ met: s.ack.includes(2), need: "Confirm you have read the non-functional requirements." }) },
  { title: "Identify constraints", instruction: "Select the statements that are real constraints of THIS scenario. Some are decoys.",
    hints: ["Constraints come from the scenario text, not from general system-design folklore.", "A constraint limits your options; a wish list does not.", "Re-read the scenario’s constraints, traffic and budget sections."],
    gate: (s) => ({ met: s.constraintsSubmitted && s.constraintsPicked.length > 0, need: "Select at least one statement and submit." }) },
  { title: "Sketch the initial architecture", instruction: "On the blank canvas add at least 3 components and connect at least 2 of them. Start simple.",
    hints: ["Start with who calls whom: client → something → data.", "Add a component only when you can name the requirement it serves.", "Simplicity is rewarded: every extra part must be justified."],
    gate: (_s, c) => ({ met: c.arch.nodes.length >= 3 && c.arch.connections.length >= 2, need: `Canvas has ${c.arch.nodes.length} component(s) and ${c.arch.connections.length} connection(s); need ≥ 3 and ≥ 2.` }) },
  { title: "Explain your key decisions", instruction: "Record at least one ADR with a clear decision and a reason (≥ 20 characters each).",
    hints: ["Write the decision as ‘We will …’.", "A reason names the requirement and what it costs.", "Add one alternative you rejected and why."],
    gate: (_s, c) => ({ met: c.adrs.some((a) => a.decision.trim().length >= 20 && a.reason.trim().length >= 20), need: "No ADR has both a decision and a reason of at least 20 characters." }) },
  { title: "Run architecture validation", instruction: "Open the Validate tab and run validation on your design, then read at least one finding.",
    hints: ["Warnings are context-dependent: decide which apply to you.", "Higher severity first, but read the context note.", "Each finding names the Foundations topic that explains it."],
    gate: (s) => ({ met: s.validated, need: "Run validation from the Challenge panel." }) },
  { title: "Inject a failure", instruction: "Use the Failure Lab to inject at least one failure into your architecture and read the result.",
    hints: ["Pick the failure your design is most proud of surviving.", "What does the trace say activated — and what did not?", "If a protection is missing the lab will say so."],
    gate: (s) => ({ met: s.failuresInjected.length > 0, need: "Run at least one failure in the Failure Lab." }) },
  { title: "Improve the architecture", instruction: "Change your design in response to what you saw (not just moving boxes).",
    hints: ["Fix the highest-impact weakness first.", "Prefer configuring an existing component over adding a new one.", "Re-run the same failure afterwards to see if the outcome changed."],
    gate: (s, c) => ({ met: s.archAtFailure !== null && archFingerprint(c.arch) !== s.archAtFailure, need: "The structure and configuration are unchanged since the failure run (moving components does not count)." }) },
  { title: "Compare initial and final versions", instruction: "Compare your first sketch with your improved design.",
    hints: ["What did each added part cost?", "Would the first version have been fine for a small launch?", "Name one thing that got worse as the design improved."],
    gate: (s) => ({ met: s.compared, need: "Open the comparison below." }) },
  { title: "Generate the final review", instruction: "Generate the completion summary. It is built from your real work, not a score.",
    hints: ["Unresolved items are the most useful part.", "Failures not handled are study guides.", "Write one follow-up ADR for the biggest gap."],
    gate: (s) => ({ met: s.passed.length >= 10 && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every((i) => s.passed.includes(i)), need: "Complete steps 1–10 first." }) },
];

export const startChallenge = (scenarioId: string): ChallengeState => ({
  scenarioId, step: 0, ack: [], constraintsPicked: [], constraintsSubmitted: false, hints: {}, initialSnapshot: null,
  validated: false, failuresInjected: [], archAtFailure: null, compared: false, finalized: false, passed: [],
});

export const acknowledge = (s: ChallengeState, step: number): ChallengeState => (s.ack.includes(step) ? s : { ...s, ack: [...s.ack, step] });

export function submitConstraints(s: ChallengeState, picks: string[]): ChallengeState {
  return { ...s, constraintsPicked: [...new Set(picks)], constraintsSubmitted: picks.length > 0 };
}

export function revealHint(s: ChallengeState, step: number): ChallengeState {
  const cur = s.hints[step] ?? 0;
  return cur >= 3 ? s : { ...s, hints: { ...s.hints, [step]: cur + 1 } };
}

export const recordValidation = (s: ChallengeState): ChallengeState => ({ ...s, validated: true });
export const recordFailure = (s: ChallengeState, id: FailureId): ChallengeState => (s.failuresInjected.includes(id) ? s : { ...s, failuresInjected: [...s.failuresInjected, id] });

/** Compare only counts when there really is a difference to compare. */
export function recordCompare(s: ChallengeState, current: Architecture): { state: ChallengeState; ok: boolean; reason: string } {
  if (!s.initialSnapshot) return { state: s, ok: false, reason: "No initial sketch was captured yet." };
  if (archFingerprint(s.initialSnapshot) === archFingerprint(current)) return { state: s, ok: false, reason: "Your current design is identical to your initial sketch; improve it first." };
  return { state: { ...s, compared: true }, ok: true, reason: "" };
}

export function tryAdvance(s: ChallengeState, c: GateCtx): { state: ChallengeState; advanced: boolean; reason: string } {
  if (s.finalized || s.step >= CHALLENGE_STEPS.length - 1) return { state: s, advanced: false, reason: "No further steps." };
  const gate = CHALLENGE_STEPS[s.step].gate(s, c);
  if (!gate.met) return { state: s, advanced: false, reason: gate.need };
  let next: ChallengeState = { ...s, step: s.step + 1, passed: s.passed.includes(s.step) ? s.passed : [...s.passed, s.step] };
  if (s.step === 4) next = { ...next, initialSnapshot: c.arch };
  if (s.step === 7) next = { ...next, archAtFailure: archFingerprint(c.arch) };
  return { state: next, advanced: true, reason: "" };
}

export function finalize(s: ChallengeState, c: GateCtx): { state: ChallengeState; ok: boolean; reason: string } {
  if (s.step !== CHALLENGE_STEPS.length - 1) return { state: s, ok: false, reason: "Finish the earlier steps first." };
  const g = CHALLENGE_STEPS[s.step].gate(s, c);
  if (!g.met) return { state: s, ok: false, reason: g.need };
  return { state: { ...s, finalized: true, passed: [...s.passed, s.step] }, ok: true, reason: "" };
}

export function constraintOptions(sc: Scenario): string[] {
  return [...sc.constraints, ...sc.decoyConstraints].sort((a, b) => a.localeCompare(b));
}

export function constraintFeedback(s: ChallengeState, sc: Scenario): { correct: string[]; wrong: string[]; missed: string[] } {
  return {
    correct: s.constraintsPicked.filter((p) => sc.constraints.includes(p)),
    wrong: s.constraintsPicked.filter((p) => sc.decoyConstraints.includes(p)),
    missed: sc.constraints.filter((c) => !s.constraintsPicked.includes(c)),
  };
}

export interface ChallengeSummary {
  requirementsAddressed: string[];
  requirementsUnresolved: Array<{ text: string; missing: string[] }>;
  failuresSurvived: FailureId[];
  failuresNotHandled: FailureId[];
  failuresNotApplicable: FailureId[];
  decisionsRecorded: number;
  topicsPracticed: number[];
  furtherStudy: number[];
  hintsUsed: number;
  simplicity: { components: number; justified: number; unjustified: string[] };
  initialVsFinal: Array<{ label: string; initial: string; final: string }>;
  constraintFeedback: ReturnType<typeof constraintFeedback>;
}

export function challengeSummary(s: ChallengeState, sc: Scenario, arch: Architecture, adrs: Adr[], capBase: CapacityInputs): ChallengeSummary {
  const ctxFor = (a: Architecture, r: { id: string }) => ({ linkedAdrCount: adrs.filter((d) => d.relatedRequirementIds.includes(r.id)).length, a });
  const evals = sc.requirements.map((r) => ({ r, e: evaluateRequirement(arch, r, { linkedAdrCount: ctxFor(arch, r).linkedAdrCount }) }));
  const fail = runAllFailures(arch, fromArchitecture(arch, capBase));
  const surv = fail.filter((f) => f.applicable && SURVIVED.includes(f.outcome));
  const notH = fail.filter((f) => f.applicable && !SURVIVED.includes(f.outcome));
  const na = fail.filter((f) => !f.applicable);
  const required = kindsRequiredBy(sc.requirements);
  const justified = arch.nodes.filter((n) => str(n, "justification").trim().length >= 8 || required.has(n.kind) || KIND_DEFS[n.kind].costUnits === 0).length;
  const unjustified = arch.nodes.filter((n) => !(str(n, "justification").trim().length >= 8 || required.has(n.kind) || KIND_DEFS[n.kind].costUnits === 0)).map((n) => n.name);
  const addressed = evals.filter((x) => x.e.status === "evidenced");
  const initial = s.initialSnapshot;
  const fi = initial ? countBySeverity(validateArchitecture(initial, sc)) : null;
  const ff = countBySeverity(validateArchitecture(arch, sc));
  const evCount = (a: Architecture | null) => (a ? sc.requirements.filter((r) => evaluateRequirement(a, r, { linkedAdrCount: 0 }).status === "evidenced").length : 0);
  return {
    requirementsAddressed: addressed.map((x) => x.r.text),
    requirementsUnresolved: evals.filter((x) => x.e.status !== "evidenced").map((x) => ({ text: x.r.text, missing: x.e.needs.filter((n) => !n.met).map((n) => n.text) })),
    failuresSurvived: surv.map((f) => f.failureId),
    failuresNotHandled: notH.map((f) => f.failureId),
    failuresNotApplicable: na.map((f) => f.failureId),
    decisionsRecorded: adrs.length,
    topicsPracticed: [...new Set(addressed.flatMap((x) => x.r.topics))].sort((a, b) => a - b),
    furtherStudy: [...new Set([...evals.filter((x) => x.e.status !== "evidenced").flatMap((x) => x.r.topics), ...notH.flatMap((f) => getFailure(f.failureId).topics)])].sort((a, b) => a - b),
    hintsUsed: Object.values(s.hints).reduce((t, n) => t + n, 0),
    simplicity: { components: arch.nodes.length, justified, unjustified },
    initialVsFinal: [
      { label: "Components", initial: String(initial?.nodes.length ?? 0), final: String(arch.nodes.length) },
      { label: "Connections", initial: String(initial?.connections.length ?? 0), final: String(arch.connections.length) },
      { label: "Requirements with evidence", initial: `${evCount(initial)}/${sc.requirements.length}`, final: `${addressed.length}/${sc.requirements.length}` },
      { label: "Critical + high findings", initial: fi ? String(fi.critical + fi.high) : "—", final: String(ff.critical + ff.high) },
    ],
    constraintFeedback: constraintFeedback(s, sc),
  };
}
