/**
 * Task 36 — Architecture Explanation Compiler.
 *
 * Generates explanations strictly from the canonical model + verified rules:
 * every claim resolves to a component, requirement, ADR, causal rule, or
 * assumption that EXISTS in the model. Nonexistent references are a bug, and
 * the grounding check makes that testable.
 */

import type { ArchitectureModel } from "../model";
import { causalLinks } from "./graph";
import { analyzeLatency } from "./latency";
import { blastRadius } from "./blastradius";

export type DetailLevel = "concise" | "intermediate" | "advanced";

export interface ComponentExplanation {
  componentId: string;
  componentKind: string;
  level: DetailLevel;
  /** one-paragraph explanation at the requested depth */
  text: string;
  supportsRequirements: { id: string; statement: string; acceptance: string }[];
  failureImplications: string[];
  tradeoffs: string[];
  /** assumption ids/statements the explanation relies on */
  assumptionsUsed: { id: string; statement: string; status: string }[];
  /** every non-model reference cited (for grounding checks) */
  sources: string[];
  uncertainties: string[];
}

export function explainComponent(m: ArchitectureModel, componentId: string, level: DetailLevel): ComponentExplanation | null {
  const c = m.components.find((x) => x.id === componentId);
  if (!c) return null;
  const reqs = c.requirementIds
    .map((rid) => m.requirements.find((r) => r.id === rid))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const links = causalLinks(m).filter((l) => l.cause === componentId || l.effect === `component:${componentId}.duplicateSideEffects` ||
    l.relation.includes(c.name));
  const failureImplications = links.map((l) => l.relation);
  const adrs = m.adrs.filter((a) => a.requirementIds.some((r) => c.requirementIds.includes(r)));
  const tradeoffs = adrs.flatMap((a) => a.alternatives.map((alt) => `${a.id}: "${alt.title}" rejected — ${alt.rejectedBecause}`));
  const br = blastRadius(m, componentId, "down");
  const ops = br.impactedOperations.map((o) => o.operationName);

  const sources = [
    `component:${componentId}`,
    ...reqs.map((r) => `requirement:${r.id}`),
    ...adrs.map((a) => `adr:${a.id}`),
    ...links.map((l) => `connection:${l.connectionId}`),
  ];

  const assumptionsUsed = m.assumptions.map((a) => ({ id: a.id, statement: a.statement, status: a.status }));

  const parts: string[] = [];
  parts.push(`${c.name} is a ${c.kind}${c.purpose ? ` whose purpose is: ${c.purpose}` : " (no purpose recorded)"}.`);
  if (level !== "concise") {
    if (reqs.length > 0) parts.push(`It exists to support ${reqs.map((r) => `${r.id} ("${r.statement}")`).join("; ")}.`);
    if (failureImplications.length > 0) {
      parts.push(`Modeled causal behavior: ${failureImplications.slice(0, 4).join("; ")}.`);
    }
    if (ops.length > 0) {
      parts.push(`If it fails, the modeled blast radius covers: ${ops.join(", ")}.`);
    }
  }
  if (level === "advanced") {
    if (tradeoffs.length > 0) parts.push(`Trade-offs on record: ${tradeoffs.slice(0, 3).join("; ")}.`);
    const la = m.latencyBudget && m.operations.some((o) =>
      m.connections.some((cn) => cn.operationIds.includes(o.id) && (cn.from === componentId || cn.to === componentId)))
      ? `Its hops carry declared latency assumptions (connection.latencyMs) used by the latency budget composer.` : null;
    if (la) parts.push(la);
    const unverified = assumptionsUsed.filter((a) => a.status === "unverified");
    if (unverified.length > 0) {
      parts.push(`Claims depending on unverified assumptions: ${unverified.map((a) => a.id).join(", ")} — treat them as provisional.`);
    }
  }

  return {
    componentId, componentKind: c.kind, level,
    text: parts.join(" "),
    supportsRequirements: reqs.map((r) => ({ id: r.id, statement: r.statement, acceptance: r.acceptance })),
    failureImplications,
    tradeoffs,
    assumptionsUsed,
    sources,
    uncertainties: level === "concise" ? [] :
      ["Causal statements come from the educational rule set, not from production observation."],
  };
}

/**
 * Task 36.5 — grounding check: an explanation must never reference
 * nonexistent entities. Returns problems (empty = fully grounded).
 */
export function checkGrounding(m: ArchitectureModel, e: ComponentExplanation): string[] {
  const problems: string[] = [];
  const compIds = new Set(m.components.map((c) => c.id));
  const reqIds = new Set(m.requirements.map((r) => r.id));
  const adrIds = new Set(m.adrs.map((a) => a.id));
  const connIds = new Set(m.connections.map((c) => c.id));
  if (!compIds.has(e.componentId)) problems.push(`explanation is about unknown component ${e.componentId}`);
  e.sources.forEach((s) => {
    const [kind, id] = s.split(":");
    if (kind === "component" && !compIds.has(id)) problems.push(`source references unknown component ${id}`);
    if (kind === "requirement" && !reqIds.has(id)) problems.push(`source references unknown requirement ${id}`);
    if (kind === "adr" && !adrIds.has(id)) problems.push(`source references unknown ADR ${id}`);
    if (kind === "connection" && !connIds.has(id)) problems.push(`source references unknown connection ${id}`);
  });
  e.supportsRequirements.forEach((r) => {
    if (!reqIds.has(r.id)) problems.push(`requirement ${r.id} does not exist`);
  });
  return problems;
}

/** Level filter used by the UI's progressive disclosure (Task 44.2). */
export const LEVEL_ORDER: Record<DetailLevel, number> = { concise: 0, intermediate: 1, advanced: 2 };

export function explanationAtMaxLevel(m: ArchitectureModel, componentId: string, maxLevel: DetailLevel): ComponentExplanation | null {
  const allowed: DetailLevel[] = ["concise", "intermediate", "advanced"]
    .filter((l) => LEVEL_ORDER[l as DetailLevel] <= LEVEL_ORDER[maxLevel]) as DetailLevel[];
  const top = allowed[allowed.length - 1];
  return explainComponent(m, componentId, top);
}
