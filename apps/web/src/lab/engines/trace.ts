/**
 * Task 27 — Distributed Trace Reconstruction Lab.
 *
 * Generates ILLUSTRATIVE traces from the latency model (never claiming they
 * came from real infrastructure), renders them as parent-child span trees
 * with async links, and diagnoses what breaks when correlation ids are not
 * propagated across an async hop.
 */

import type { ArchitectureModel } from "../model";
import { analyzeLatency } from "./latency";

export interface Span {
  spanId: string;
  parentId: string | null;
  componentId: string;
  name: string;
  startMs: number;
  durationMs: number;
  kind: "sync" | "async-link";
  status: "ok" | "error" | "unknown";
  /** false when correlation context did not reach this span */
  correlationOk: boolean;
}

export interface Trace {
  traceId: string;
  operationId: string;
  spans: Span[];
  /** true if any span lost correlation context */
  broken: boolean;
  note: string;
}

/** Task 27.2 — synthesize a trace from the modeled critical path. */
export function generateTrace(m: ArchitectureModel, operationId: string): Trace {
  const la = analyzeLatency(m, operationId);
  const spans: Span[] = [];
  let t = 0;
  let parent: string | null = null;
  let correlationOk = true;
  let broken = false;
  let prevComponent: string | null = null;

  la.criticalPath?.hops.forEach((h, i) => {
    const comp = m.components.find((c) => c.id === h.to);
    if (prevComponent && m.components.find((c) => c.id === prevComponent)?.telemetry?.tracePropagation !== true) {
      correlationOk = false;
      broken = true;
    }
    const spanId = `span-${i + 1}`;
    const duration = h.connMs + h.procMs;
    spans.push({
      spanId, parentId: parent,
      componentId: h.to,
      name: `${comp?.name ?? h.to} ${h.procMs > 0 ? "(process)" : "(call)"}`,
      startMs: t, durationMs: duration,
      kind: "sync", status: "ok", correlationOk,
    });
    t += duration;
    parent = spanId;
    prevComponent = h.to;
  });

  // async hops get linked spans with a MODELED completion delay
  let asyncIndex = 0;
  la.asyncHops.forEach((hop, i) => {
    const [from, to] = hop.split(" -> ");
    const fromComp = m.components.find((c) => c.id === from);
    const toComp = m.components.find((c) => c.id === to);
    const propagated = fromComp?.telemetry?.tracePropagation === true;
    if (!propagated) broken = true;
    spans.push({
      spanId: `span-async-${i + 1}`,
      parentId: spans[spans.length - 1]?.spanId ?? null,
      componentId: to,
      name: `${toComp?.name ?? to} (async work)`,
      startMs: t + 100, // modeled enqueue-to-start delay
      durationMs: 4000, // modeled processing (assumption ASM-2)
      kind: "async-link",
      status: propagated ? "ok" : "unknown",
      correlationOk: propagated,
    });
    asyncIndex += 1;
  });

  return {
    traceId: `trace-${operationId}-${asyncIndex}`,
    operationId,
    spans,
    broken,
    note: "ILLUSTRATIVE trace generated from declared latency assumptions (connection.latencyMs + budget allocations). This is not data from real infrastructure.",
  };
}

/** Task 27.4 — what a missing correlation id actually costs the debugger. */
export interface BrokenTraceDiagnosis {
  brokenAt: string;
  consequence: string;
  missingContext: string[];
}

export function diagnoseBrokenTrace(m: ArchitectureModel, trace: Trace): BrokenTraceDiagnosis | null {
  if (!trace.broken) return null;
  const brokenSpan = trace.spans.find((s) => !s.correlationOk);
  if (!brokenSpan) return null;
  return {
    brokenAt: `${brokenSpan.componentId} (${brokenSpan.spanId})`,
    consequence: "spans after this point cannot be joined to the user's request: the workflow appears as unrelated fragments, latency cannot be attributed, and failures cannot be tied back to the originating call",
    missingContext: [
      `correlation id was not propagated by the component before ${brokenSpan.componentId}`,
      `status of the downstream work is "${brokenSpan.status}" — unknown rather than observed`,
    ],
  };
}

/** Structural checks used by tests: parent-child integrity and ordering. */
export function validateTraceStructure(trace: Trace): string[] {
  const problems: string[] = [];
  const ids = new Set(trace.spans.map((s) => s.spanId));
  trace.spans.forEach((s) => {
    if (s.parentId && !ids.has(s.parentId)) problems.push(`${s.spanId}: parent ${s.parentId} missing`);
  });
  trace.spans.forEach((s) => {
    if (s.parentId) {
      const parent = trace.spans.find((x) => x.spanId === s.parentId) as Span;
      if (s.startMs < parent.startMs) problems.push(`${s.spanId}: starts before its parent`);
    }
  });
  return problems;
}
