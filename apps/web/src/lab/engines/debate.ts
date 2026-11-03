/**
 * Task 39 — Architecture Decision Debate Workspace.
 *
 * System design is about competing alternatives under the SAME requirements.
 * Alternatives carry structured arguments (benefits, costs, risks, evidence,
 * preference conditions); consistency checks reject comparisons made under
 * inconsistent assumptions; a decision records an ADR with rejected options.
 */

import type { ArchitectureModel, Adr } from "../model";
import { newId } from "../model";

export interface DebateAlternative {
  id: string;
  title: string;
  approach: string;
  /** the assumptions this alternative depends on */
  assumptions: string[];
  benefits: string[];
  costs: string[];
  risks: string[];
  evidence: string[];
  /** under which conditions this alternative is preferable */
  preferableWhen: string;
}

export interface Debate {
  id: string;
  question: string;
  /** every alternative is compared against THESE requirements (same for all) */
  requirementIds: string[];
  alternatives: DebateAlternative[];
}

/** Task 39.5 — consistency: all alternatives must argue under the same requirements. */
export function checkDebateConsistency(debate: Debate): { consistent: boolean; problems: string[] } {
  const problems: string[] = [];
  if (debate.alternatives.length < 2) problems.push("a debate needs at least two alternatives");
  debate.alternatives.forEach((a) => {
    if (a.assumptions.length === 0) problems.push(`${a.id}: declares no assumptions — its benefits cannot be evaluated`);
    if (a.preferableWhen.length < 10) problems.push(`${a.id}: states no preference condition`);
    a.evidence.forEach((e) => {
      if (!/^(component|requirement|adr|connection|assumption|rule):/.test(e)) {
        problems.push(`${a.id}: evidence "${e}" is not a grounded reference`);
      }
    });
  });
  // no alternative may be declared superior via assumptions others were not given
  const assumptionCounts = debate.alternatives.map((a) => a.assumptions.length);
  if (Math.max(...assumptionCounts, 0) - Math.min(...assumptionCounts, 0) > 2) {
    problems.push("alternatives argue under very different assumption loads — the comparison is not fair");
  }
  return { consistent: problems.length === 0, problems };
}

/** Task 39.4 — record a decision as an ADR with rejected alternatives. */
export function recordDecision(
  debate: Debate, chosenAlternativeId: string, rationale: string,
): Adr {
  const chosen = debate.alternatives.find((a) => a.id === chosenAlternativeId);
  if (!chosen) throw new Error(`unknown alternative ${chosenAlternativeId}`);
  const rejected = debate.alternatives
    .filter((a) => a.id !== chosenAlternativeId)
    .map((a) => ({
      title: a.title,
      rejectedBecause: [
        `less preferable when: ${a.preferableWhen}`,
        ...a.costs.slice(0, 1).map((c) => `cost: ${c}`),
        ...a.risks.slice(0, 1).map((r) => `risk: ${r}`),
        rationale ? `decision rationale: ${rationale}` : "",
      ].filter(Boolean).join("; "),
    }));
  return {
    id: newId("ADR"),
    title: `Adopt: ${chosen.title} — ${debate.question}`,
    context: debate.question + " Requirements in scope: " + debate.requirementIds.join(", "),
    decision: chosen.approach + (rationale ? ` Rationale: ${rationale}` : ""),
    status: "accepted",
    requirementIds: [...debate.requirementIds],
    alternatives: rejected,
  };
}

/** Reference debate for the DocFlow processing-decoupling decision. */
export function processingDecouplingDebate(m: ArchitectureModel): Debate {
  const req = (id: string) => m.requirements.find((r) => r.id === id);
  return {
    id: "debate-decoupling",
    question: "How should document processing be decoupled from upload acknowledgement?",
    requirementIds: ["NFR-1", "NFR-2", "NFR-3"],
    alternatives: [
      {
        id: "alt-sync",
        title: "Process synchronously during upload",
        approach: "The upload request waits for processing to finish before acknowledging.",
        assumptions: ["processing finishes within the request deadline (contradicted by ASM-2: p95 12 s)"],
        benefits: ["simplest mental model", "no status model needed: the result is the response"],
        costs: ["p95 ack latency bounded by processing time"],
        risks: ["NFR-1 (800 ms ack) is violated by an order of magnitude", "worker outage fails every upload"],
        evidence: ["requirement:NFR-1", "assumption:ASM-2"],
        preferableWhen: "processing is measured in single-digit milliseconds and the deadline has 10x headroom",
      },
      {
        id: "alt-queue",
        title: "Buffer work in a durable queue",
        approach: "Upload stores the original, enqueues durable work, and acknowledges; workers process asynchronously and update status.",
        assumptions: ["processing time is seconds (ASM-2)", "a status read-after-write model exists (NFR-3 via meta-db)"],
        benefits: ["ack latency independent of processing time", "worker outages buffer instead of failing uploads", "workers scale independently"],
        costs: ["a new stateful component (queue) with capacity and DLQ policy", "completion is eventual: status polling or events needed"],
        risks: ["backlog growth under sustained overload (bounded by NFR-5 acceptance)"],
        evidence: ["requirement:NFR-1", "requirement:NFR-2", "adr:ADR-1", `requirement:${req("NFR-1") ? "NFR-3" : "NFR-3"}`],
        preferableWhen: "processing takes longer than the ack deadline and clients tolerate eventual completion",
      },
      {
        id: "alt-partial",
        title: "Hybrid: fast-path small documents, queue the rest",
        approach: "Documents under a size/time threshold are processed inline; everything else is queued.",
        assumptions: ["the document population is bimodal", "the threshold is configurable without redeploy"],
        benefits: ["most users get instant results", "big jobs still decouple"],
        costs: ["two code paths to test and operate", "threshold tuning becomes an operational task", "capacity planning needs both paths"],
        risks: ["the fast path can starve under load, degrading predictably but confusingly"],
        evidence: ["requirement:NFR-1", "rule:R-QUEUE-GROW"],
        preferableWhen: "the workload is measurably bimodal and the team can operate two paths",
      },
    ],
  };
}
