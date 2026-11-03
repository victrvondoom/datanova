/**
 * Task 26 — Architecture Observability Coverage Analyzer.
 *
 * Would this system be diagnosable during a failure? Telemetry expectations
 * are mapped to components, queues, retries, and async hops; gaps are found
 * where trace context, queue depth, retry behavior, or failure states are
 * unmeasured.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";

export interface ObservabilityGap {
  kind: "trace-propagation" | "queue-depth" | "retry-metrics" | "unlogged-critical" | "untraced-operation";
  componentId?: string;
  connectionId?: string;
  operationId?: string;
  detail: string;
}

export function observabilityGaps(m: ArchitectureModel): { gaps: ObservabilityGap[]; findings: Finding[] } {
  const gaps: ObservabilityGap[] = [];

  // trace context must survive async/event hops
  m.connections.filter((cn) => cn.kind !== "sync").forEach((cn) => {
    const from = m.components.find((c) => c.id === cn.from);
    const to = m.components.find((c) => c.id === cn.to);
    if (from?.telemetry?.tracePropagation !== true || to?.telemetry?.traces !== true) {
      gaps.push({
        kind: "trace-propagation", connectionId: cn.id,
        componentId: cn.from,
        detail: `async/event hop ${cn.from} -> ${cn.to}: trace context is ${from?.telemetry?.tracePropagation === true ? "propagated" : "NOT propagated by " + cn.from} and ${to?.telemetry?.traces === true ? "the consumer traces" : "the consumer does not trace"} — the workflow cannot be followed across this hop`,
      });
    }
  });

  // queues must expose depth
  m.components.filter((c) => c.kind === "queue").forEach((c) => {
    if (!(c.telemetry?.metrics ?? []).some((x) => /depth|size|backlog/i.test(x))) {
      gaps.push({
        kind: "queue-depth", componentId: c.id,
        detail: `queue "${c.name}" reports no depth/size metric — backlog growth is invisible until jobs time out`,
      });
    }
  });

  // retries must be counted
  m.components.filter((c) => Number(c.config.retryMax ?? 0) > 0).forEach((c) => {
    if (!(c.telemetry?.metrics ?? []).some((x) => /retr/i.test(x))) {
      gaps.push({
        kind: "retry-metrics", componentId: c.id,
        detail: `${c.name} retries up to ${c.config.retryMax} times but reports no retry metric — amplified load on dependencies is unmeasured`,
      });
    }
  });

  // critical edges should be observable at both ends
  m.connections.filter((cn) => cn.criticality >= 4).forEach((cn) => {
    const from = m.components.find((c) => c.id === cn.from);
    const to = m.components.find((c) => c.id === cn.to);
    if (from?.telemetry?.logs !== true && to?.telemetry?.logs !== true) {
      gaps.push({
        kind: "unlogged-critical", connectionId: cn.id,
        detail: `critical edge ${cn.from} -> ${cn.to} has no logging at either end — failures on this path cannot be attributed`,
      });
    }
  });

  // every business operation should have at least one tracing component
  m.operations.forEach((o) => {
    const traced = m.connections.some((cn) =>
      cn.operationIds.includes(o.id) &&
      (m.components.find((c) => c.id === cn.from)?.telemetry?.traces === true ||
       m.components.find((c) => c.id === cn.to)?.telemetry?.traces === true));
    if (!traced) {
      gaps.push({
        kind: "untraced-operation", operationId: o.id,
        detail: `operation "${o.name}" has no tracing on its path — latency cannot be attributed to components`,
      });
    }
  });

  const findings: Finding[] = gaps.map((g) => finding(
    "observability", `obs:${g.kind}:${g.componentId ?? g.connectionId ?? g.operationId}`, "warning",
    `Observability gap: ${g.kind.replace(/-/g, " ")}`,
    g.detail,
    [{ ref: g.componentId ? `component:${g.componentId}` : g.connectionId ? `connection:${g.connectionId}` : `operation:${g.operationId}`, detail: g.kind }],
  ));
  return { gaps, findings };
}
