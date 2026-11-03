/**
 * Task 40 — Design Under Constraints Mission.
 *
 * A realistic architecture exercise: incomplete information, hard constraints,
 * progressive reveal that forces revising earlier decisions, tracked
 * revisions, and an evaluation based on coverage, justified simplicity,
 * failure handling, and evidence — never raw component count.
 */

import type { ArchitectureModel, Requirement } from "../model";
import { analyzeIntent, coverageMap, isCovered } from "./intent";
import { extractGenome } from "./genome";
import { blastRadius } from "./blastradius";

export interface MissionConstraint {
  id: string;
  kind: "budget" | "deployables" | "ops-skill" | "deadline";
  statement: string;
  /** hard numeric bound where applicable (e.g. max deployables) */
  bound?: number;
}

export interface MissionStage {
  revealAt: "start" | "after-design" | "after-first-analysis";
  information: string;
  /** constraints that only apply after this reveal */
  constraintIds: string[];
}

export interface Mission {
  id: string;
  title: string;
  productScenario: string;
  requirements: Requirement[];
  constraints: MissionConstraint[];
  /** questions the learner must answer explicitly (unknowns) */
  unknowns: string[];
  successCriteria: string[];
  stages: MissionStage[];
}

/** Task 40.1–40.3 — the DocFlow mission with progressive reveal. */
export function docflowMission(): Mission {
  return {
    id: "mission-docflow",
    title: "DocFlow under pressure",
    productScenario:
      "A small team must launch a document-processing SaaS. Uploads arrive in bursts; processing takes seconds; " +
      "a regulated customer requires full data deletion within 30 days. The initial peak estimate may be wrong.",
    requirements: [
      { id: "M-1", kind: "functional", category: "functionality",
        statement: "Users can upload documents and retrieve processed results.",
        acceptance: "Upload acknowledged; processed result retrievable by id." },
      { id: "M-2", kind: "nfr", category: "latency",
        statement: "Upload acknowledgement within 800 ms at p95.",
        acceptance: "p95 ack <= 800 ms at the stated peak." },
      { id: "M-3", kind: "nfr", category: "availability",
        statement: "99.9% monthly availability for uploads.",
        acceptance: "Availability >= 99.9% over 30 days." },
      { id: "M-4", kind: "constraint", category: "regulatory",
        statement: "User data is fully deleted within 30 days of request.",
        acceptance: "Every store holding user documents is covered by a deletion workflow." },
      { id: "M-5", kind: "nfr", category: "consistency",
        statement: "Status reads are read-after-write.",
        acceptance: "Post-ack status reads never return the pre-upload state." },
    ],
    constraints: [
      { id: "MC-1", kind: "deployables", statement: "At most 8 deployable components (team of 4, one service per engineer).", bound: 8 },
      { id: "MC-2", kind: "budget", statement: "Modeled monthly infrastructure cost must stay under $250." },
      { id: "MC-3", kind: "ops-skill", statement: "The team can operate Postgres and one queue; no Kafka, no Kubernetes operators." },
      { id: "MC-4", kind: "deadline", statement: "Launch in 6 weeks: no component requiring more than 2 weeks of build time." },
      { id: "MC-5", kind: "budget", statement: "REVEALED AT FIRST ANALYSIS: the sales pipeline doubles the peak traffic estimate." },
    ],
    unknowns: [
      "What is the real peak upload rate? (assumption required, with source and confidence)",
      "Is the document content PII under the customer's contract, or only sensitive business data?",
      "How long will processing actually take per document at p95?",
    ],
    successCriteria: [
      "All five requirements are covered by mapped components with acceptance conditions",
      "Every component either maps to a requirement or carries a documented justification",
      "The metadata-db failure blast radius is analyzed and bounded",
      "Deletion covers every store that holds user documents",
      "The design fits MC-1..MC-4 and survives the MC-5 reveal with a justified revision",
    ],
    stages: [
      { revealAt: "start", information: "Base scenario with requirements M-1..M-5 and constraints MC-1..MC-4.", constraintIds: ["MC-1", "MC-2", "MC-3", "MC-4"] },
      { revealAt: "after-design", information: "Legal review: documents may contain personal data — deletion and encryption obligations apply to every copy.", constraintIds: [] },
      { revealAt: "after-first-analysis", information: "Sales update: the peak traffic estimate doubles. Revise your capacity decisions and record what changed and why.", constraintIds: ["MC-5"] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Task 40.4 — revision tracking
// ---------------------------------------------------------------------------

export interface RevisionRecord {
  stage: MissionStage["revealAt"];
  summary: string;
  changedAndWhy: string;
}

export function recordRevision(revisions: RevisionRecord[], stage: MissionStage["revealAt"], summary: string, changedAndWhy: string): RevisionRecord[] {
  return [...revisions, { stage, summary, changedAndWhy }];
}

// ---------------------------------------------------------------------------
// Task 40.5 — evaluation on coverage, simplicity, failure handling, evidence
// ---------------------------------------------------------------------------

export interface MissionEvaluation {
  requirementCoverage: { covered: string[]; uncovered: string[] };
  orphanComponents: string[];
  justifiedSimplicity: boolean;
  deployablesWithinBound: boolean | null;
  isolationQuality: { criticalOpsBounded: string[]; unboundedCriticalOps: string[] };
  deletionCoverage: { entity: string; covered: boolean }[];
  evidenceCount: number;
  revisionsTracked: boolean;
  overall: "accepted" | "needs-work";
  notes: string[];
}

export function evaluateMission(
  mission: Mission, model: ArchitectureModel, revisions: RevisionRecord[],
): MissionEvaluation {
  const cov = coverageMap(model);
  const covered: string[] = [];
  const uncovered: string[] = [];
  mission.requirements.forEach((r) => {
    const c = cov[r.id];
    if (c && isCovered(c)) covered.push(r.id); else uncovered.push(r.id);
  });

  const orphans = analyzeIntent(model)
    .filter((f) => f.id.startsWith("intent-orphan:"))
    .map((f) => f.id.split(":")[1]);

  const deployables = model.components.filter((c) => c.kind !== "client").length;
  const bound = mission.constraints.find((c) => c.bound !== undefined)?.bound;
  const deployablesWithinBound = bound === undefined ? null : deployables <= bound;

  const criticalOps = model.operations.filter((o) => o.criticality >= 4);
  const bounded: string[] = [];
  const unbounded: string[] = [];
  criticalOps.forEach((o) => {
    // an op is "bounded" if some component failure that impacts it is contained
    // by isolation or async buffering
    const contained = model.components.some((c) => {
      const br = blastRadius(model, c.id, "down");
      if (!br.impactedOperations.some((x) => x.operationId === o.id)) return false;
      return br.protectedByBoundaries.length > 0 || extractGenome(model).traits.find((t) => t.key === "queues") !== undefined && Number(extractGenome(model).traits.find((t) => t.key === "queues")?.value ?? 0) > 0;
    });
    (contained ? bounded : unbounded).push(o.id);
  });

  const deleteOp = model.operations.find((o) => /delete|remove|purge/i.test(o.name));
  const deletionCoverage = model.dataEntities.map((d) => {
    const holders = [d.ownerComponentId, ...(d.copies ?? []).map((c) => c.componentId)];
    const coveredHolders = deleteOp
      ? holders.filter((h) => model.connections.some((cn) =>
        cn.operationIds.includes(deleteOp.id) && (cn.from === h || cn.to === h)))
      : [];
    return { entity: d.id, covered: coveredHolders.length === holders.length };
  });

  const evidenceCount =
    model.adrs.length + model.assumptions.filter((a) => a.status !== "refuted").length + revisions.length;

  const notes: string[] = [];
  if (uncovered.length > 0) notes.push(`uncovered requirements: ${uncovered.join(", ")}`);
  if (orphans.length > 0) notes.push(`components without justification: ${orphans.join(", ")}`);
  if (deployablesWithinBound === false) notes.push("deployable count exceeds the mission bound");
  if (deletionCoverage.some((d) => !d.covered)) notes.push("deletion workflow does not cover every store");
  if (unbounded.length > 0) notes.push(`critical operations without modeled isolation: ${unbounded.join(", ")}`);
  if (revisions.length === 0) notes.push("no revisions recorded — the progressive reveal requires at least one recorded revision");

  const overall: MissionEvaluation["overall"] =
    uncovered.length === 0 && orphans.length === 0 && deployablesWithinBound !== false &&
    deletionCoverage.every((d) => d.covered) && revisions.length > 0
      ? "accepted"
      : "needs-work";

  return {
    requirementCoverage: { covered, uncovered },
    orphanComponents: orphans,
    justifiedSimplicity: orphans.length === 0,
    deployablesWithinBound,
    isolationQuality: { criticalOpsBounded: bounded, unboundedCriticalOps: unbounded },
    deletionCoverage,
    evidenceCount,
    revisionsTracked: revisions.length > 0,
    overall,
    notes,
  };
}
