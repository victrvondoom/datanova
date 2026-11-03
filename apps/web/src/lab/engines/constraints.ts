/**
 * Task 05 — Constraint and Assumption Discovery Engine.
 *
 * Surfaces missing context before recommendations: which constraint
 * categories are unspecified, which assumptions are unverified, and which
 * stated requirements conflict with the architecture's communication patterns.
 */

import type { ArchitectureModel, Finding, RequirementCategory } from "../model";
import { finding } from "../model";

/** Task 05.1 — constraint taxonomy: what a complete design context covers. */
export interface ConstraintCategoryInfo {
  category: RequirementCategory;
  whyItMatters: string;
  /** what a specified requirement for this category should mention */
  example: string;
}

export const CONSTRAINT_TAXONOMY: ConstraintCategoryInfo[] = [
  { category: "latency", whyItMatters: "Without a latency target, timeouts and queue choices cannot be justified.", example: "p95 upload ack <= 800 ms" },
  { category: "throughput", whyItMatters: "Peak and burst rates determine worker counts and queue capacity.", example: "50 uploads/sec peak, bursts of 2x for 60 s" },
  { category: "availability", whyItMatters: "'Highly available' is not measurable; a target defines the error budget.", example: "99.9% over rolling 30 days" },
  { category: "consistency", whyItMatters: "Read-after-write and staleness bounds decide sync vs async vs cache.", example: "status reads are read-after-write; analytics may lag 24 h" },
  { category: "security", whyItMatters: "Trust boundaries and encryption must be explicit, not incidental.", example: "all document bytes encrypted in transit and at rest" },
  { category: "privacy", whyItMatters: "Data classes drive retention, deletion, and exposure analysis.", example: "documents are sensitive; delete within 30 days" },
  { category: "cost", whyItMatters: "A budget cap turns 'more replicas' into a trade-off, not a default.", example: "modeled monthly cost <= budget assumption" },
  { category: "deployment", whyItMatters: "Deployment limits bound component count and platform choice.", example: "single region; managed services preferred" },
  { category: "ops-skill", whyItMatters: "Operational skill limits which technologies a team can run safely.", example: "team can operate Postgres but not a self-managed Kafka" },
  { category: "regulatory", whyItMatters: "Compliance obligations constrain storage, retention, and deletion.", example: "deletion requests honored within 30 days" },
];

export interface MissingContext {
  category: RequirementCategory;
  whyItMatters: string;
}

/** Task 05.2 — detect categories with no requirement at all. */
export function missingContext(m: ArchitectureModel): MissingContext[] {
  const present = new Set(m.requirements.map((r) => r.category));
  return CONSTRAINT_TAXONOMY
    .filter((t) => !present.has(t.category))
    .map((t) => ({ category: t.category, whyItMatters: t.whyItMatters }));
}

/** Task 05.4 — requirement-vs-architecture conflicts. */
export interface ConstraintConflict {
  requirementId: string;
  conflict: string;
  evidence: string[];
}

const IMMEDIATE = /immediate|read-after-write|strong(ly)? consistent|synchronous/i;
const SLOW_OR_BACKGROUND = /background|long-running|seconds|minutes|batch|eventual/i;

export function findConflicts(m: ArchitectureModel): ConstraintConflict[] {
  const conflicts: ConstraintConflict[] = [];
  const hasImmediateConsistency = m.requirements.some((r) => IMMEDIATE.test(r.statement));
  const slowOp = m.operations.find((o) => SLOW_OR_BACKGROUND.test(o.description ?? "") || SLOW_OR_BACKGROUND.test(o.name));

  // Conflict 1: immediate consistency required, but a mapped operation crosses an async/event hop.
  if (hasImmediateConsistency) {
    const immediateReqs = m.requirements.filter((r) => IMMEDIATE.test(r.statement)).map((r) => r.id);
    m.operations.forEach((op) => {
      const asyncHops = m.connections.filter(
        (cn) => cn.operationIds.includes(op.id) && cn.kind !== "sync",
      );
      const opHasImmediateReq = op.requirementIds.some((rid) => immediateReqs.includes(rid));
      if (opHasImmediateReq && asyncHops.length > 0) {
        conflicts.push({
          requirementId: immediateReqs.find((rid) => op.requirementIds.includes(rid)) as string,
          conflict: `Operation "${op.name}" must satisfy an immediate-consistency requirement but contains ${asyncHops.length} asynchronous/event hop(s): ${asyncHops.map((h) => `${h.from} -> ${h.to}`).join(", ")}`,
          evidence: [`connection:${asyncHops[0].id}`, `operation:${op.id}`],
        });
      }
    });
  }

  // Conflict 2: strict synchronous completion combined with a long-running workflow.
  const syncDeadline = m.requirements.find((r) => /within \d+ ?ms|deadline|synchronous completion/i.test(r.statement));
  if (syncDeadline && slowOp) {
    conflicts.push({
      requirementId: syncDeadline.id,
      conflict: `"${syncDeadline.statement}" conflicts with long-running operation "${slowOp.name}" — a synchronous completion cannot wait for it.`,
      evidence: [`requirement:${syncDeadline.id}`, `operation:${slowOp.id}`],
    });
  }

  // Conflict 3: same operation required both immediate and eventual by two requirements.
  m.operations.forEach((op) => {
    const immediate = op.requirementIds.find((rid) => {
      const r = m.requirements.find((x) => x.id === rid);
      return r && IMMEDIATE.test(r.statement);
    });
    const eventual = op.requirementIds.find((rid) => {
      const r = m.requirements.find((x) => x.id === rid);
      return r && /eventual|may lag|stale/i.test(r.statement);
    });
    if (immediate && eventual) {
      conflicts.push({
        requirementId: immediate,
        conflict: `Operation "${op.name}" is required to be immediate (${immediate}) and eventually consistent (${eventual}) at the same time.`,
        evidence: [`requirement:${immediate}`, `requirement:${eventual}`, `operation:${op.id}`],
      });
    }
  });
  return conflicts;
}

/** Task 05.5 — guided clarification questions derived from actual gaps. */
export interface Clarification {
  category: RequirementCategory;
  question: string;
  howAnswersChangeTheDesign: string;
}

export function clarifications(m: ArchitectureModel): Clarification[] {
  const out: Clarification[] = [];
  missingContext(m).forEach((mc) => {
    const info = CONSTRAINT_TAXONOMY.find((t) => t.category === mc.category);
    out.push({
      category: mc.category,
      question: `What is the ${mc.category} constraint for this system? (e.g. "${info?.example}")`,
      howAnswersChangeTheDesign: info?.whyItMatters ?? "",
    });
  });
  findConflicts(m).forEach((c) => {
    out.push({
      category: "consistency",
      question: `Requirement ${c.requirementId} conflicts with the current design: ${c.conflict}. Which behavior is actually required?`,
      howAnswersChangeTheDesign: "The answer decides between synchronous paths, compensating UI states, or relaxing the consistency requirement.",
    });
  });
  return out;
}

/** Findings view combining gaps, conflicts, and unverified assumptions. */
export function analyzeConstraints(m: ArchitectureModel): Finding[] {
  const findings: Finding[] = [];
  missingContext(m).forEach((mc) => {
    findings.push(finding(
      "constraints", `constraints-missing:${mc.category}`, "warning",
      `No ${mc.category} constraint is recorded`,
      mc.whyItMatters,
      [{ ref: `model:${m.id}`, detail: `no requirement with category "${mc.category}"` }],
    ));
  });
  findConflicts(m).forEach((c, i) => {
    findings.push(finding(
      "constraints", `constraints-conflict:${i}`, "critical",
      `Requirement conflict: ${c.requirementId}`,
      c.conflict,
      c.evidence.map((e) => ({ ref: e, detail: "conflict evidence" })),
    ));
  });
  m.assumptions
    .filter((a) => a.status === "unverified")
    .forEach((a) => {
      findings.push(finding(
        "constraints", `constraints-assumption:${a.id}`, "info",
          `Assumption ${a.id} is unverified`,
        `"${a.statement}" (source: ${a.source}, confidence ${a.confidence}, owner: ${a.owner}; status: unverified). Conclusions depending on it are provisional.`,
        [{ ref: `assumption:${a.id}`, detail: "status: unverified" }],
      ));
    });
  return findings;
}
