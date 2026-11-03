/**
 * Task 01 — Architecture Intent Compiler.
 *
 * Connects architecture structure to the requirements it must satisfy and
 * finds the gaps in both directions: requirements with no architecture
 * support, components with no documented purpose, and decisions whose
 * original motivation is missing.
 */

import type { ArchitectureModel, Finding, Requirement } from "../model";
import { finding } from "../model";

/** Which entities reference a requirement (the intent-to-component mapping). */
export interface RequirementCoverage {
  requirementId: string;
  components: string[];
  connections: string[];
  adrs: string[];
  operations: string[];
  slos: string[];
}

export function coverageMap(m: ArchitectureModel): Record<string, RequirementCoverage> {
  const map: Record<string, RequirementCoverage> = {};
  const ensure = (rid: string): RequirementCoverage =>
    (map[rid] ??= { requirementId: rid, components: [], connections: [], adrs: [], operations: [], slos: [] });
  m.components.forEach((c) => c.requirementIds.forEach((r) => ensure(r).components.push(c.id)));
  m.connections.forEach((c) => c.requirementIds.forEach((r) => ensure(r).connections.push(c.id)));
  m.adrs.forEach((a) => a.requirementIds.forEach((r) => ensure(r).adrs.push(a.id)));
  m.operations.forEach((o) => o.requirementIds.forEach((r) => ensure(r).operations.push(o.id)));
  m.slos.forEach((s) => s.componentIds.forEach((cid) => {
    // SLOs cover the requirements of the operations their components serve
    m.connections
      .filter((cn) => cn.operationIds.length > 0 && (cn.from === cid || cn.to === cid))
      .forEach((cn) => cn.requirementIds.forEach((r) => ensure(r).slos.push(s.id)));
  }));
  return map;
}

export function isCovered(c: RequirementCoverage): boolean {
  return c.components.length + c.connections.length + c.adrs.length + c.operations.length + c.slos.length > 0;
}

/**
 * Intent coverage analysis (Task 01.3). Returns findings for:
 * - requirements with no architecture support (uncovered),
 * - components with no documented purpose (orphaned),
 * - ADRs whose motivation is missing,
 * - requirements flagged `unresolved` (kept visible, never hidden).
 */
export function analyzeIntent(m: ArchitectureModel): Finding[] {
  const findings: Finding[] = [];
  const coverage = coverageMap(m);

  m.requirements.forEach((r: Requirement) => {
    const c = coverage[r.id] ?? { requirementId: r.id, components: [], connections: [], adrs: [], operations: [], slos: [] };
    if (r.unresolved) {
      findings.push(finding(
        "intent", `intent-unresolved:${r.id}`, "info",
        `Requirement ${r.id} is explicitly unresolved`,
        `"${r.statement}" is recorded as unresolved — it is kept visible instead of being silently assumed satisfied.`,
        [{ ref: `requirement:${r.id}`, detail: "marked unresolved in the intent model" }],
      ));
    }
    if (!isCovered(c)) {
      findings.push(finding(
        "intent", `intent-uncovered:${r.id}`, r.kind === "functional" || r.kind === "nfr" ? "critical" : "warning",
        `Requirement ${r.id} has no architecture support`,
        `No component, connection, operation, ADR, or SLO references ${r.id}. The architecture does not yet claim to satisfy "${r.statement}".`,
        [{ ref: `requirement:${r.id}`, detail: `acceptance: ${r.acceptance}` }],
      ));
    } else if (c.components.length === 0 && c.connections.length === 0 && r.kind !== "risk") {
      findings.push(finding(
        "intent", `intent-indirect:${r.id}`, "info",
        `Requirement ${r.id} is supported only indirectly`,
        `${r.id} is referenced by ${c.operations.length} operation(s) and ${c.adrs.length} ADR(s) but by no concrete component or connection — coverage may be aspirational.`,
        [{ ref: `requirement:${r.id}`, detail: "no direct component/connection mapping" }],
      ));
    }
  });

  m.components.forEach((c) => {
    if (!c.purpose && c.requirementIds.length === 0) {
      findings.push(finding(
        "intent", `intent-orphan:${c.id}`, "warning",
        `Component "${c.name}" has no documented purpose`,
        `${c.id} declares neither a purpose nor any requirement mapping. Either it is unnecessary (design debt) or its motivation was never recorded.`,
        [{ ref: `component:${c.id}`, detail: `kind: ${c.kind}` }],
      ));
    } else if (!c.purpose) {
      findings.push(finding(
        "intent", `intent-nopurpose:${c.id}`, "info",
        `Component "${c.name}" supports requirements but has no free-text purpose`,
        `${c.id} maps to ${c.requirementIds.join(", ")} but has no purpose statement.`,
        [{ ref: `component:${c.id}`, detail: `requirements: ${c.requirementIds.join(", ")}` }],
      ));
    }
  });

  m.adrs.forEach((a) => {
    if (a.requirementIds.length === 0) {
      findings.push(finding(
        "intent", `intent-adr-unmotivated:${a.id}`, "warning",
        `ADR ${a.id} has no recorded motivation`,
        `"${a.title}" does not reference any requirement — its original motivation is missing from the design history.`,
        [{ ref: `adr:${a.id}`, detail: "no requirementIds" }],
      ));
    }
  });

  return findings;
}

/** Task 01.4 data: why a component exists, per the intent model. */
export interface ComponentIntent {
  componentId: string;
  purpose: string;
  supportsRequirements: string[];
  mitigatesRisks: string[];
  introducesTradeoffs: string[];
  inOperations: string[];
  decidedBy: string[];
}

export function explainComponent(m: ArchitectureModel, componentId: string): ComponentIntent | null {
  const c = m.components.find((x) => x.id === componentId);
  if (!c) return null;
  const inOps = m.operations
    .filter((o) => m.connections.some((cn) => cn.operationIds.includes(o.id) && (cn.from === componentId || cn.to === componentId)))
    .map((o) => o.id);
  return {
    componentId,
    purpose: c.purpose ?? "(no purpose recorded)",
    supportsRequirements: [...c.requirementIds],
    mitigatesRisks: m.requirements.filter((r) => r.kind === "risk" && c.requirementIds.includes(r.id)).map((r) => r.id),
    introducesTradeoffs: m.adrs
      .filter((a) => a.requirementIds.some((r) => c.requirementIds.includes(r)))
      .flatMap((a) => a.alternatives.map((alt) => `${a.id}: rejected "${alt.title}" — ${alt.rejectedBecause}`)),
    inOperations: inOps,
    decidedBy: m.adrs.filter((a) => a.requirementIds.some((r) => c.requirementIds.includes(r))).map((a) => a.id),
  };
}
