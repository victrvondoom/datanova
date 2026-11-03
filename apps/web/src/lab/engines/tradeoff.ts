/**
 * Task 15 — Cost-Risk-Complexity Frontier.
 *
 * A transparent trade-off explorer. Cost is computed from DECLARED cost
 * assumptions (never presented as cloud pricing); risk exposure is severity x
 * likelihood with an explicit mitigation factor; complexity counts deployable,
 * stateful, and integration surface. Architectures are compared as points on
 * a frontier — never reduced to one opaque score.
 */

import type { ArchitectureModel } from "../model";
import { STATEFUL_KINDS } from "../model";

export interface CostAssumptions {
  /** modeled monthly cost per CPU unit */
  costPerCpuUnit: number;
  /** modeled monthly cost per GB storage */
  costPerGBStorage: number;
  /** modeled monthly cost per GB memory */
  costPerGBMemory: number;
  /** fixed operational overhead per deployable component */
  costPerComponent: number;
}

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  costPerCpuUnit: 8,
  costPerGBStorage: 0.08,
  costPerGBMemory: 0.4,
  costPerComponent: 10,
};

export interface CostBreakdown {
  componentId: string;
  cpu: number;
  storage: number;
  memory: number;
  overhead: number;
  total: number;
}

export function monthlyCost(m: ArchitectureModel, a: CostAssumptions = DEFAULT_COST_ASSUMPTIONS): { total: number; breakdown: CostBreakdown[] } {
  const breakdown: CostBreakdown[] = m.components.map((c) => {
    const cpu = Number(c.config.cpuUnits ?? 0) * a.costPerCpuUnit;
    const storage = Number(c.config.storageGB ?? 0) * a.costPerGBStorage;
    const memory = Number(c.config.memoryMB ?? 0) / 1024 * a.costPerGBMemory;
    const overhead = c.kind === "client" ? 0 : a.costPerComponent;
    return { componentId: c.id, cpu, storage, memory, overhead, total: cpu + storage + memory + overhead };
  });
  return { total: Math.round(breakdown.reduce((s, b) => s + b.total, 0) * 100) / 100, breakdown };
}

// ---------------------------------------------------------------------------
// Risk model
// ---------------------------------------------------------------------------

export interface RiskItem {
  id: string;
  description: string;
  /** 1..5 */
  severity: number;
  /** 0..1 — an ASSUMPTION, never a measurement */
  likelihood: number;
  /** component/edge that mitigates this risk, if any */
  mitigatedBy?: string;
}

export interface RiskExposure {
  id: string;
  gross: number;
  net: number;
  mitigated: boolean;
}

/** Net exposure is reduced by the documented MITIGATION_FACTOR when a mitigation exists. */
export const MITIGATION_FACTOR = 0.4;

export function riskExposure(risks: RiskItem[]): { total: number; items: RiskExposure[] } {
  const items = risks.map((r) => {
    const gross = r.severity * r.likelihood;
    const net = r.mitigatedBy ? gross * MITIGATION_FACTOR : gross;
    return { id: r.id, gross, net: Math.round(net * 100) / 100, mitigated: !!r.mitigatedBy };
  });
  return { total: Math.round(items.reduce((s, i) => s + i.net, 0) * 100) / 100, items };
}

// ---------------------------------------------------------------------------
// Complexity model
// ---------------------------------------------------------------------------

export interface ComplexityBreakdown {
  deployables: number;
  stateful: number;
  integrationPoints: number;
  externalDependencies: number;
  score: number;
}

export function complexity(m: ArchitectureModel): ComplexityBreakdown {
  const deployables = m.components.filter((c) => c.kind !== "client").length;
  const stateful = m.components.filter((c) => STATEFUL_KINDS.includes(c.kind)).length;
  const integrationPoints = m.connections.length;
  const externalDependencies = m.components.filter((c) => c.kind === "external").length;
  return {
    deployables, stateful, integrationPoints, externalDependencies,
    score: Math.round((deployables + 2 * stateful + 0.1 * integrationPoints + externalDependencies) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Frontier + sensitivity
// ---------------------------------------------------------------------------

export interface FrontierPoint {
  archId: string;
  cost: number;
  riskExposure: number;
  complexity: number;
  /** reliability proxy: isolation fraction x redundancy, 0..1 (modeled) */
  reliabilityProxy: number;
  /** dominated points are worse or equal on every axis than some other point */
  dominated: boolean;
}

export function frontier(
  models: ArchitectureModel[], risksOf: (m: ArchitectureModel) => RiskItem[],
  costs: CostAssumptions = DEFAULT_COST_ASSUMPTIONS,
): FrontierPoint[] {
  const points: FrontierPoint[] = models.map((m) => {
    const iso = m.connections.filter((c) => c.failureBehavior === "isolated").length / Math.max(1, m.connections.length);
    const redundancy = Math.min(1, m.components.filter((c) => Number(c.config.replicas ?? 1) >= 2).length / Math.max(1, m.components.length));
    return {
      archId: m.id,
      cost: monthlyCost(m, costs).total,
      riskExposure: riskExposure(risksOf(m)).total,
      complexity: complexity(m).score,
      reliabilityProxy: Math.round((0.7 * iso + 0.3 * redundancy) * 100) / 100,
      dominated: false,
    };
  });
  points.forEach((p) => {
    p.dominated = points.some((q) => q !== p &&
      q.cost <= p.cost && q.riskExposure <= p.riskExposure && q.complexity <= p.complexity &&
      q.reliabilityProxy >= p.reliabilityProxy &&
      (q.cost < p.cost || q.riskExposure < p.riskExposure || q.complexity < p.complexity || q.reliabilityProxy > p.reliabilityProxy));
  });
  return points;
}

export interface SensitivityResult {
  assumption: keyof CostAssumptions;
  multiplier: number;
  /** arch ids ordered by cost BEFORE the assumption change */
  beforeRanking: string[];
  afterRanking: string[];
  rankingChanged: boolean;
}

/** Task 15.5 — change one cost assumption and observe whether comparisons flip. */
export function costSensitivity(
  models: ArchitectureModel[], assumption: keyof CostAssumptions, multiplier: number,
): SensitivityResult {
  const before = [...models].sort((a, b) => monthlyCost(a).total - monthlyCost(b).total).map((m) => m.id);
  const changed: CostAssumptions = { ...DEFAULT_COST_ASSUMPTIONS, [assumption]: DEFAULT_COST_ASSUMPTIONS[assumption] * multiplier };
  const after = [...models].sort((a, b) => monthlyCost(a, changed).total - monthlyCost(b, changed).total).map((m) => m.id);
  return { assumption, multiplier, beforeRanking: before, afterRanking: after, rankingChanged: before.join() !== after.join() };
}
