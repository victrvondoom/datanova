/**
 * Task 14 — Resource Saturation and Bottleneck Explorer.
 *
 * Uses Little's law (L = lambda * W) as the honest core of the educational
 * model: required concurrency = arrival rate * service time. Each declared
 * resource (connection pool, worker slots, CPU, queue capacity) gets a
 * utilization, the bottleneck is the max, and scaling experiments show whether
 * the bottleneck MOVES — teaching that scaling a non-bottleneck changes
 * nothing.
 */

import type { ArchitectureModel, Finding } from "../model";
import { cloneModel, finding } from "../model";

export interface ResourceUtilization {
  componentId: string;
  resource: string;
  required: number;
  available: number;
  utilization: number; // >1 means saturated
}

export interface SaturationAnalysis {
  rps: number;
  utilizations: ResourceUtilization[];
  bottleneck: ResourceUtilization | null;
  /** resources that are NOT the bottleneck (scaling them won't help) */
  slack: ResourceUtilization[];
  explanation: string;
  assumptions: string[];
}

/** Modeled resource requirements at a given request rate (Little's law). */
export function resourceUtilizations(m: ArchitectureModel, rps: number): ResourceUtilization[] {
  const out: ResourceUtilization[] = [];
  m.components.forEach((c) => {
    const syncIn = m.connections.filter((cn) => cn.kind === "sync" && cn.to === c.id);
    const meanMs = Math.max(...syncIn.map((cn) => cn.latencyMs ?? 0), 5);
    const requiredConcurrent = (rps * meanMs) / 1000; // L = lambda * W
    if (c.kind === "database" || c.kind === "objectstore") {
      const pool = Number(c.config.connPool ?? 20);
      out.push({ componentId: c.id, resource: "connPool", required: requiredConcurrent, available: pool, utilization: requiredConcurrent / pool });
    }
    if (c.kind === "worker") {
      const slots = Number(c.config.concurrency ?? 1);
      const jobMs = Number(c.config.processingMs ?? 4000);
      const requiredSlots = (rps * jobMs) / 1000;
      out.push({ componentId: c.id, resource: "workerSlots", required: requiredSlots, available: slots, utilization: requiredSlots / slots });
    }
    if (c.kind === "queue") {
      const cap = Number(c.config.capacity ?? 1000);
      const sustainedBacklog = Math.max(0, requiredConcurrent - 1) * 10; // crude backlog proxy
      out.push({ componentId: c.id, resource: "queueCapacity", required: sustainedBacklog, available: cap, utilization: sustainedBacklog / cap });
    }
    if (c.kind === "service" || c.kind === "gateway") {
      const cpu = Number(c.config.cpuUnits ?? 1);
      out.push({ componentId: c.id, resource: "cpuUnits", required: requiredConcurrent, available: cpu, utilization: requiredConcurrent / cpu });
    }
  });
  return out;
}

export function saturate(m: ArchitectureModel, rps: number): SaturationAnalysis {
  const utilizations = resourceUtilizations(m, rps);
  const bottleneck = utilizations.length === 0
    ? null
    : utilizations.reduce((a, b) => (b.utilization > a.utilization ? b : a));
  const slack = utilizations.filter((u) => u !== bottleneck && u.utilization < 0.7);
  return {
    rps,
    utilizations,
    bottleneck,
    slack,
    explanation: bottleneck
      ? `Bottleneck: ${bottleneck.componentId}.${bottleneck.resource} at ${Math.round(bottleneck.utilization * 100)}% modeled utilization (needs ${bottleneck.required.toFixed(1)} of ${bottleneck.available} available).` +
        (slack.length > 0
          ? ` Scaling ${slack.map((s) => `${s.componentId}.${s.resource} (${Math.round(s.utilization * 100)}%)`) .join(", ")} will NOT improve throughput until the bottleneck is relieved.`
          : " No resource has slack — several are near saturation.")
      : "No modeled resources at this rate.",
    assumptions: [
      "Required concurrency follows Little's law: rate * mean service time (uniform, no variance).",
      "Database service time is approximated by inbound synchronous connection latency; worker service time by config.processingMs (default 4s).",
      "Queue backlog is a crude proxy (10x the excess arrival concurrency), not a queueing-theory result.",
    ],
  };
}

export interface ScalingExperiment {
  scaled: ResourceUtilization;
  newBottleneck: ResourceUtilization | null;
  bottleneckMoved: boolean;
  note: string;
}

/** Task 14.4 — scale ONE resource and observe whether the bottleneck moves. */
export function scaleResource(
  m: ArchitectureModel, rps: number, componentId: string, resource: string, factor: number,
): { model: ArchitectureModel; result: ScalingExperiment } {
  const model = cloneModel(m);
  const c = model.components.find((x) => x.id === componentId);
  if (!c) throw new Error(`unknown component ${componentId}`);
  const key = resource === "connPool" ? "connPool"
    : resource === "workerSlots" ? "concurrency"
      : resource === "queueCapacity" ? "capacity" : resource;
  const before = Number(c.config[key] ?? 1);
  c.config[key] = Math.max(1, Math.round(before * factor));
  const after = saturate(model, rps);
  const scaled = after.utilizations.find((u) => u.componentId === componentId && u.resource === resource);
  const previous = saturate(m, rps).bottleneck;
  const bottleneckMoved = !!scaled && previous !== null &&
    (after.bottleneck?.componentId !== previous.componentId || after.bottleneck?.resource !== previous.resource);
  return {
    model,
    result: {
      scaled: scaled as ResourceUtilization,
      newBottleneck: after.bottleneck,
      bottleneckMoved,
      note: bottleneckMoved
        ? `Bottleneck moved from ${previous?.componentId}.${previous?.resource} to ${after.bottleneck?.componentId}.${after.bottleneck?.resource}.`
        : `Bottleneck unchanged (${after.bottleneck?.componentId}.${after.bottleneck?.resource}) — the scaled resource was not the constraint${scaled && scaled.utilization < 0.7 ? " (it now has slack)" : ""}.`,
    },
  };
}

/** Findings view: bottleneck explanation with evidence. */
export function saturationFindings(m: ArchitectureModel, rps: number): Finding[] {
  const s = saturate(m, rps);
  if (!s.bottleneck) return [];
  const saturated = s.utilizations.filter((u) => u.utilization >= 1);
  const findings: Finding[] = saturated.map((u) => finding(
    "resource", `resource-sat:${u.componentId}:${u.resource}`, u === s.bottleneck ? "critical" : "warning",
    `${u.componentId}.${u.resource} is saturated at ${Math.round(u.utilization * 100)}%`,
    `Modeled requirement ${u.required.toFixed(1)} exceeds availability ${u.available} at ${rps} rps (Little's law).`,
    [{ ref: `component:${u.componentId}`, detail: `resource: ${u.resource}` }],
  ));
  if (s.slack.length > 0) {
    findings.push(finding(
      "resource", "resource-slack", "info",
      "Scaling non-bottleneck resources will not help",
      s.explanation,
      s.slack.map((u) => ({ ref: `component:${u.componentId}`, detail: `${u.resource} at ${Math.round(u.utilization * 100)}%` })),
    ));
  }
  return findings;
}
