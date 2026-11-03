/**
 * Task 29 — Architecture Drift Detector.
 *
 * Compares the current architecture against an approved baseline snapshot,
 * classifies the drift, and determines which requirements, ADRs, and SLOs may
 * be invalidated — distinguishing harmless documentation drift from changes
 * that silently invalidate earlier verification.
 */

import {
  type ArchitectureModel, type Finding, type ModelChange, diffModels, finding,
} from "../model";

export interface DriftItem {
  change: ModelChange;
  significance: "harmless" | "review" | "invalidates";
  invalidatedRequirements: string[];
  invalidatedSlos: string[];
  invalidatedAdrs: string[];
  evidenceNeeded: string;
}

export interface DriftReport {
  baselineVersion: number;
  changes: DriftItem[];
  summary: Record<string, number>;
  findings: Finding[];
}

export function detectDrift(
  baseline: { version: number; model: ArchitectureModel },
  current: ArchitectureModel,
): DriftReport {
  const raw = diffModels(baseline.model, current);
  const items: DriftItem[] = raw.map((change) => {
    const comp =
      change.target === "component"
        ? (current.components.find((c) => c.id === change.id) ?? baseline.model.components.find((c) => c.id === change.id))
        : undefined;
    const conn =
      change.target === "connection"
        ? (current.connections.find((c) => c.id === change.id) ?? baseline.model.connections.find((c) => c.id === change.id))
        : undefined;

    const invalidatedRequirements = comp ? [...comp.requirementIds] : conn ? [...conn.requirementIds] : [];
    const relatedComponents = comp ? [comp.id] : conn ? [conn.from, conn.to] : [];
    const invalidatedSlos = current.slos
      .filter((s) => s.componentIds.some((cid) => relatedComponents.includes(cid))).map((s) => s.id);
    const invalidatedAdrs = current.adrs
      .filter((a) => a.requirementIds.some((r) => invalidatedRequirements.includes(r))).map((a) => a.id);

    if (change.classification === "documentation") {
      return {
        change, significance: "harmless" as const,
        invalidatedRequirements: [], invalidatedSlos: [], invalidatedAdrs: [],
        evidenceNeeded: "none — documentation-only change",
      };
    }
    if (change.classification === "security") {
      return {
        change, significance: "invalidates" as const,
        invalidatedRequirements, invalidatedSlos, invalidatedAdrs,
        evidenceNeeded: "re-run the trust-boundary and adversarial reviews; previous security review is void",
      };
    }
    if (change.classification === "behavioral" || change.classification === "reliability") {
      return {
        change, significance: "invalidates" as const,
        invalidatedRequirements, invalidatedSlos, invalidatedAdrs,
        evidenceNeeded: "re-run causal propagation, blast-radius, and latency/SLO analyses against the changed model",
      };
    }
    return {
      change, significance: "review" as const,
      invalidatedRequirements, invalidatedSlos, invalidatedAdrs,
      evidenceNeeded: change.classification === "cost"
        ? "confirm the cost assumption still holds within the budget constraint"
        : "structural change — re-verify intent coverage for the affected components",
    };
  });

  const summary: Record<string, number> = {};
  raw.forEach((c) => { summary[c.classification] = (summary[c.classification] ?? 0) + 1; });

  const findings: Finding[] = items
    .filter((i) => i.significance !== "harmless")
    .map((i) => finding(
      "drift", `drift:${i.change.target}:${i.change.id}:${i.change.type}`,
      i.significance === "invalidates" ? "critical" : "warning",
      `Drift (${i.change.classification}): ${i.change.detail}`,
      `${i.significance === "invalidates" ? "Earlier verification is INVALIDATED" : "Review required"}. ${i.evidenceNeeded}.`,
      [
        { ref: `${i.change.target}:${i.change.id}`, detail: i.change.detail },
        ...i.invalidatedRequirements.map((r) => ({ ref: `requirement:${r}`, detail: "may no longer hold" })),
        ...i.invalidatedSlos.map((s) => ({ ref: `slo:${s}`, detail: "mapping may no longer hold" })),
      ],
    ));

  return { baselineVersion: baseline.version, changes: items, summary, findings };
}
