/**
 * Task 09 — Causal Failure Propagation Engine.
 *
 * Deterministic, event-recorded propagation of a single injected failure
 * through the canonical model, using explicit causal rules. The algorithm is a
 * fixpoint over monotone state variables with per-edge latency propagation,
 * so cyclic dependency graphs terminate with a stable modeled state.
 *
 * IMPORTANT (simulation honesty): these are educational, qualitative/semi-
 * quantitative causal models, not measurements of real infrastructure. Each
 * event names the rule that fired and its confidence.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";

export type ComponentStatus = "up" | "degraded" | "down";
export type FaultType = "down" | "slow";

export interface CausalRule {
  id: string;
  description: string;
  confidence: number;
}

export const CAUSAL_RULES: Record<string, CausalRule> = {
  "R-INIT-DOWN": { id: "R-INIT-DOWN", description: "Injected failure sets the target component down", confidence: 1 },
  "R-INIT-SLOW": { id: "R-INIT-SLOW", description: "Injected fault doubles the target's modeled latency factor and degrades it", confidence: 1 },
  "R-SYNC-BLOCK": { id: "R-SYNC-BLOCK", description: "A synchronous dependency that is down with failureBehavior=blocks takes its caller down", confidence: 0.9 },
  "R-SYNC-DEGRADE": { id: "R-SYNC-DEGRADE", description: "A dependency that is down with failureBehavior=degrades degrades its caller", confidence: 0.85 },
  "R-SYNC-DEP-DOWN-DEGRADES": { id: "R-SYNC-DEP-DOWN-DEGRADES", description: "A synchronous caller of a degraded dependency degrades as well", confidence: 0.8 },
  "R-LATENCY-PROP": { id: "R-LATENCY-PROP", description: "A degraded dependency multiplies the caller's modeled latency factor", confidence: 0.8 },
  "R-QUEUE-GROW": { id: "R-QUEUE-GROW", description: "A down worker with an upstream queue makes the queue depth grow", confidence: 0.9 },
  "R-RETRY-AMP": { id: "R-RETRY-AMP", description: "A caller with retries facing a degraded dependency multiplies that dependency's load factor", confidence: 0.7 },
  "R-ASYNC-NO-LOSS": { id: "R-ASYNC-NO-LOSS", description: "An isolated/asynchronous edge stops synchronous propagation", confidence: 0.9 },
};

export interface PropagationEvent {
  step: number;
  componentId: string;
  variable: "status" | "latencyFactor" | "queueDepth" | "loadFactor";
  change: string;
  ruleId: string;
  cause: string;
  /** causal path from the origin to this component */
  path: string[];
  confidence: number;
}

export interface CausalChain {
  originComponentId: string;
  originFault: FaultType;
  affectedComponentId: string;
  path: string[];
  endStatus: ComponentStatus;
  rulesFired: string[];
}

export interface PropagationResult {
  origin: { componentId: string; fault: FaultType };
  events: PropagationEvent[];
  finalStatus: Record<string, ComponentStatus>;
  latencyFactor: Record<string, number>;
  loadFactor: Record<string, number>;
  /** modeled queue depth growth per round the worker stays down (qualitative) */
  queueDepthRounds: Record<string, number>;
  chains: CausalChain[];
  assumptions: string[];
}

const MAX_STEPS = 200;

export function propagate(
  m: ArchitectureModel, injected: { componentId: string; fault: FaultType },
): PropagationResult {
  const status: Record<string, ComponentStatus> = {};
  const latency: Record<string, number> = {};
  const load: Record<string, number> = {};
  const queueRounds: Record<string, number> = {};
  m.components.forEach((c) => { status[c.id] = "up"; latency[c.id] = 1; load[c.id] = 1; });

  const events: PropagationEvent[] = [];
  const paths = new Map<string, string[]>(); // component -> causal path from origin
  const latencyEdgesUsed = new Set<string>();
  const ampEdgesUsed = new Set<string>();
  let step = 0;

  const push = (componentId: string, variable: PropagationEvent["variable"], change: string, ruleId: string, cause: string) => {
    step += 1;
    if (step > MAX_STEPS) return;
    events.push({
      step, componentId, variable, change, ruleId, cause,
      path: paths.get(componentId) ?? [injected.componentId],
      confidence: CAUSAL_RULES[ruleId]?.confidence ?? 0.5,
    });
  };

  const setStatus = (id: string, s: ComponentStatus, ruleId: string, cause: string) => {
    const prev = status[id];
    if (rank(s) > rank(prev)) {
      status[id] = s;
      const path = [...(paths.get(cause) ?? []), id];
      paths.set(id, path);
      push(id, "status", `${prev} -> ${s}`, ruleId, cause);
    }
  };

  // 1) apply the injected fault
  paths.set(injected.componentId, [injected.componentId]);
  if (injected.fault === "down") {
    status[injected.componentId] = "down";
    push(injected.componentId, "status", "up -> down", "R-INIT-DOWN", injected.componentId);
  } else {
    status[injected.componentId] = "degraded";
    latency[injected.componentId] = 2;
    push(injected.componentId, "status", "up -> degraded", "R-INIT-SLOW", injected.componentId);
    push(injected.componentId, "latencyFactor", "1 -> 2", "R-INIT-SLOW", injected.componentId);
  }

  // 2) fixpoint: propagate until nothing changes (bounded)
  let changed = true;
  let guard = 0;
  while (changed && guard < MAX_STEPS) {
    changed = false;
    guard += 1;
    for (const cn of m.connections) {
      const from = cn.from; const to = cn.to;
      if (to !== injected.componentId && status[to] === "up") continue;

      // --- status propagation over the edge ---
      if (status[to] === "down") {
        if (cn.kind === "sync" && cn.failureBehavior === "blocks") {
          if (status[from] !== "down") { setStatus(from, "down", "R-SYNC-BLOCK", to); changed = true; }
        } else if (cn.failureBehavior === "degrades" || cn.kind === "async") {
          if (status[from] === "up") { setStatus(from, "degraded", "R-SYNC-DEGRADE", to); changed = true; }
        } else if (cn.failureBehavior === "isolated" && !events.some((e) => e.componentId === from && e.variable === "status" && e.ruleId === "R-ASYNC-NO-LOSS")) {
          // propagation stops here by design; record it once for transparency
          push(from, "status", "unchanged (isolated edge)", "R-ASYNC-NO-LOSS", to);
        }
      } else if (status[to] === "degraded" && cn.kind === "sync" && status[from] === "up") {
        setStatus(from, "degraded", "R-SYNC-DEP-DOWN-DEGRADES", to);
        changed = true;
      }

      // --- latency propagation (each edge at most once per origin event; only
      //     synchronous edges: an async caller does not wait for the dependency) ---
      if (cn.kind === "sync" && status[to] === "degraded" && latency[to] > 1 && !latencyEdgesUsed.has(cn.id)) {
        latencyEdgesUsed.add(cn.id);
        const before = latency[from];
        latency[from] = before * latency[to];
        const path = [...(paths.get(to) ?? []), from];
        paths.set(from, path);
        push(from, "latencyFactor", `${before.toFixed(2)} -> ${latency[from].toFixed(2)}`, "R-LATENCY-PROP", to);
        if (status[from] === "up") setStatus(from, "degraded", "R-LATENCY-PROP", to);
      }

      // --- queue growth: queue -> down worker ---
      const queue = m.components.find((c) => c.id === from);
      if (queue?.kind === "queue" && status[to] === "down") {
        queueRounds[from] = (queueRounds[from] ?? 0) + 1;
        changed = true;
        push(from, "queueDepth", `rounds with full queue: ${queueRounds[from]}`, "R-QUEUE-GROW", to);
      }

      // --- retry amplification (each edge at most once) ---
      const caller = m.components.find((c) => c.id === from);
      const retries = Number(caller?.config.retryMax ?? 0);
      if (retries > 0 && status[to] !== "up" && !ampEdgesUsed.has(cn.id)) {
        ampEdgesUsed.add(cn.id);
        const before = load[to];
        load[to] = before * (1 + retries);
        push(to, "loadFactor", `${before.toFixed(2)} -> ${load[to].toFixed(2)} (retryMax=${retries} on ${from})`, "R-RETRY-AMP", from);
      }
    }
  }

  // 3) causal chains for every affected component
  const chains: CausalChain[] = m.components
    .filter((c) => c.id !== injected.componentId && status[c.id] !== "up")
    .map((c) => ({
      originComponentId: injected.componentId,
      originFault: injected.fault,
      affectedComponentId: c.id,
      path: paths.get(c.id) ?? [injected.componentId, c.id],
      endStatus: status[c.id],
      rulesFired: [...new Set(events.filter((e) => e.componentId === c.id).map((e) => e.ruleId))],
    }));

  return {
    origin: injected,
    events,
    finalStatus: status,
    latencyFactor: latency,
    loadFactor: load,
    queueDepthRounds: queueRounds,
    chains,
    assumptions: [
      "Qualitative educational model: statuses and factors are modeled variables, not measured values.",
      "Latency and retry amplification are propagated at most once per edge per injected fault, which bounds cyclic propagation.",
      "Queue depth is expressed as rounds-with-worker-down, not messages; real depth needs arrival and processing rates.",
    ],
  };
}

function rank(s: ComponentStatus): number {
  return s === "up" ? 0 : s === "degraded" ? 1 : 2;
}

/** Findings view (Task 09.3/09.4): the causal explanation for a failure. */
export function causalFindings(m: ArchitectureModel, injected: { componentId: string; fault: FaultType }): Finding[] {
  const r = propagate(m, injected);
  const name = (id: string) => m.components.find((c) => c.id === id)?.name ?? id;
  return r.chains.map((ch) => finding(
    "causal", `causal:${injected.componentId}:${ch.affectedComponentId}`,
    ch.endStatus === "down" ? "critical" : "warning",
    `${name(ch.affectedComponentId)} is ${ch.endStatus}`,
    `Causal path: ${ch.path.map(name).join(" -> ")}. Rules fired: ${ch.rulesFired.join(", ")}.`,
    ch.path.map((p) => ({ ref: `component:${p}`, detail: `step in causal chain` })),
  ));
}
