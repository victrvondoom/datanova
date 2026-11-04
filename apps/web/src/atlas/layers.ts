/**
 * Datanova Atlas — map layer engine (Campaign 06, Tasks 16-22).
 *
 * The eight map modes are DATA-DRIVEN transformations of the same canonical
 * VisGraph: each mode computes per-node / per-edge emphasis, badges, and
 * legends from existing engine outputs (scenario, causal, blast-radius,
 * recovery-timeline, trust, lineage, grounding/evidence). The renderer only
 * interprets these results — it never invents state. Pure and deterministic.
 */

import type { VisGraph } from "./graph";
import type { ArchitectureModel, Finding } from "../lab/model";

export type MapMode =
  | "topology" | "dependency" | "traffic" | "trust"
  | "lineage" | "failure" | "recovery" | "evidence"
  | "intended" | "configured" | "observed" | "divergence"
  | "volume" | "latency" | "error-rate" | "saturation"
  | "incident-impact" | "coverage";

export const MAP_MODES: { mode: MapMode; label: string; purpose: string }[] = [
  { mode: "topology", label: "Topology", purpose: "Architecture structure: components, tiers, trust zones" },
  { mode: "dependency", label: "Dependency", purpose: "Upstream/downstream dependencies and critical paths" },
  { mode: "traffic", label: "Traffic", purpose: "Modeled workload, request paths, queue pressure" },
  { mode: "trust", label: "Trust", purpose: "Trust boundaries, boundary controls, external exposure" },
  { mode: "lineage", label: "Data Lineage", purpose: "Data origins, storage, access, consumers" },
  { mode: "failure", label: "Failure", purpose: "Failure propagation and blast radius" },
  { mode: "recovery", label: "Recovery", purpose: "Recovery stages, dependencies, bottlenecks" },
  { mode: "evidence", label: "Evidence", purpose: "Claims, findings, sources, validation coverage" },
];

export const REALITY_MAP_MODES: { mode: MapMode; label: string; purpose: string }[] = [
  { mode: "intended", label: "1. Intended Design", purpose: "Canonical architecture model intent" },
  { mode: "configured", label: "2. Configured Infra", purpose: "Declared Kubernetes and Terraform resources" },
  { mode: "observed", label: "3. Observed Runtime", purpose: "Reconstructed service calls from distributed traces" },
  { mode: "divergence", label: "4. Dependency Divergence", purpose: "Highlights undocumented calls and architecture drift" },
  { mode: "volume", label: "5. Request Volume", purpose: "Call volume and throughput across runtime paths" },
  { mode: "latency", label: "6. Latency Heatmap", purpose: "p95 duration and critical path latency bottlenecks" },
  { mode: "error-rate", label: "7. Error Rate", purpose: "HTTP 5xx and exception rates across active services" },
  { mode: "saturation", label: "8. Saturation", purpose: "Queue depth, worker throughput, and connection pool saturation" },
  { mode: "incident-impact", label: "9. Incident Impact", purpose: "Active incident blast radius and cascade propagation" },
  { mode: "coverage", label: "10. Evidence Coverage", purpose: "Observed components vs telemetry blind spots" },
];

export const ALL_MAP_MODES: { mode: MapMode; label: string; purpose: string }[] = [
  ...MAP_MODES,
  ...REALITY_MAP_MODES,
];

export type Emphasis = "normal" | "dimmed" | "highlighted" | "critical" | "warning";

export interface NodeLayerState {
  emphasis: Emphasis;
  /** short badge rendered on the node (e.g. "SATURATED", "DOWN") */
  badge?: string;
  /** 0..1 visual intensity (traffic/pressure heat) */
  intensity?: number;
  /** mode-specific inspectable note shown in the inspector/minimap */
  note?: string;
}

export interface EdgeLayerState {
  emphasis: Emphasis;
  /** animated flow strength 0..1 (traffic mode) */
  flow?: number;
  note?: string;
}

export interface LayerResult {
  mode: MapMode;
  nodes: Record<string, NodeLayerState>;
  edges: Record<string, EdgeLayerState>;
  legend: { label: string; description: string }[];
  summary: string;
  /** traversed paths for the current focus (dependency/lineage/failure) */
  focusPaths: string[][];
}

export interface LayerContext {
  selected?: string;
  /** scenario run result (traffic mode) — the actual engine output */
  scenario?: {
    saturated: boolean;
    peakRps: number;
    expectationResults: { expectationId: string; outcome: string; detail: string }[];
    impactedOperations: string[];
    failedComponents: string[];
  } | null;
  /** failure mode inputs: causal findings + blast radius from the engines */
  failure?: {
    origin: string;
    downComponents: string[];
    degradedComponents: string[];
    impactedOperations: string[];
  } | null;
  /** recovery mode input: recovery timeline output */
  recovery?: {
    phases: { componentId: string; stage: string }[];
    bottlenecks: string[];
  } | null;
  /** evidence mode inputs: findings with component refs */
  findings?: Finding[];
  /** evidence coverage per component id -> count of supporting artifacts */
  evidenceCounts?: Record<string, number>;
}

const allNormal = (g: VisGraph): { nodes: Record<string, NodeLayerState>; edges: Record<string, EdgeLayerState> } => ({
  nodes: Object.fromEntries(g.nodes.map((n) => [n.id, { emphasis: "normal" as Emphasis }])),
  edges: Object.fromEntries(g.edges.map((e) => [e.id, { emphasis: "normal" as Emphasis }])),
});

const downstream = (g: VisGraph, start: string): { nodes: Set<string>; edges: Set<string>; paths: string[][] } => {
  const out: Record<string, string[]> = {};
  for (const e of g.edges) (out[e.from] ??= []).push(e.to);
  const nodes = new Set<string>(); const edges = new Set<string>();
  const paths: string[][] = [];
  const walk = (id: string, path: string[]): void => {
    if (path.length > g.nodes.length) return; // cycle guard
    for (const e of g.edges.filter((x) => x.from === id)) {
      if (!nodes.has(e.to)) {
        nodes.add(e.to); edges.add(e.id);
        const next = [...path, e.to];
        paths.push(next);
        walk(e.to, next);
      } else {
        edges.add(e.id);
        paths.push([...path, e.to]);
      }
    }
  };
  walk(start, [start]);
  return { nodes, edges, paths };
};

const upstream = (g: VisGraph, start: string): { nodes: Set<string>; edges: Set<string>; paths: string[][] } => {
  const rev: VisGraph = { ...g, edges: g.edges.map((e) => ({ ...e, from: e.to, to: e.from })) };
  return downstream(rev, start);
};

export function computeLayer(g: VisGraph, model: ArchitectureModel, mode: MapMode, ctx: LayerContext): LayerResult {
  switch (mode) {
    case "topology": {
      const { nodes, edges } = allNormal(g);
      return {
        mode, nodes, edges,
        legend: [
          { label: "Node form", description: "Shape encodes component type; color is never the only signal" },
          { label: "Zone regions", description: "Translucent regions = trust zones (label + boundary)" },
        ],
        summary: `${g.nodes.length} components, ${g.edges.length} connections across ${g.zones.length} trust zones`,
        focusPaths: [],
      };
    }
    case "dependency": {
      const { nodes, edges } = allNormal(g);
      const sel = ctx.selected ?? g.nodes[0]?.id;
      const up = sel ? upstream(g, sel) : null;
      const down = sel ? downstream(g, sel) : null;
      if (!sel) return { mode, nodes, edges, legend: [], summary: "no selection", focusPaths: [] };
      for (const n of g.nodes) {
        if (n.id === sel) nodes[n.id] = { emphasis: "highlighted", note: "selected" };
        else if (up!.nodes.has(n.id)) nodes[n.id] = { emphasis: "highlighted", note: "upstream dependency" };
        else if (down!.nodes.has(n.id)) nodes[n.id] = { emphasis: "highlighted", note: "downstream dependent" };
        else nodes[n.id] = { emphasis: "dimmed" };
      }
      for (const e of g.edges) {
        if (up!.edges.has(e.id) || down!.edges.has(e.id)) {
          edges[e.id] = { emphasis: e.criticality >= 4 ? "critical" : "highlighted", note: e.criticality >= 4 ? "critical dependency" : "dependency path" };
        } else {
          edges[e.id] = { emphasis: "dimmed" };
        }
      }
      const isolated = g.nodes.filter((n) => !up!.nodes.has(n.id) && !down!.nodes.has(n.id) && n.id !== sel && nodes[n.id].note === undefined);
      return {
        mode, nodes, edges,
        legend: [
          { label: "Highlighted", description: "Upstream and downstream of the selection" },
          { label: "Critical (thick)", description: "Dependency edges with criticality ≥ 4 — failure of these blocks the dependent" },
          { label: "Dimmed", description: "Unrelated to the current selection" },
        ],
        summary: `${up!.nodes.size} upstream, ${down!.nodes.size} downstream of ${sel}${isolated.length ? `, ${isolated.length} unrelated` : ""}`,
        focusPaths: [...up!.paths.slice(0, 8), ...down!.paths.slice(0, 8)],
      };
    }
    case "traffic": {
      const { nodes, edges } = allNormal(g);
      const sc = ctx.scenario;
      if (!sc) {
        for (const n of g.nodes) nodes[n.id] = { emphasis: "dimmed", note: "no scenario result — run a scenario" };
        return {
          mode, nodes, edges,
          legend: [{ label: "No scenario", description: "Run a scenario in the simulation console to light up modeled traffic" }],
          summary: "No scenario result — traffic map is inert until a scenario runs",
          focusPaths: [],
        };
      }
      for (const e of g.edges) {
        const flow = e.criticality >= 4 ? 1 : e.criticality / 4;
        edges[e.id] = { emphasis: "normal", flow, note: `${e.kind}, criticality ${e.criticality}` };
      }
      for (const n of g.nodes) {
        const isQueue = n.type === "queue";
        const intensity = isQueue ? (sc.saturated ? 1 : 0.5) : Math.min(1, e2(n.id));
        const emphasis: Emphasis = sc.failedComponents.includes(n.id) ? "critical"
          : isQueue && sc.saturated ? "critical"
          : sc.impactedOperations.length > 0 && (n.type === "queue" || n.type === "worker") ? "warning"
          : "normal";
        nodes[n.id] = {
          emphasis,
          intensity,
          badge: sc.failedComponents.includes(n.id) ? "DOWN" : isQueue && sc.saturated ? "SATURATED" : undefined,
          note: `peak ${sc.peakRps} rps modeled${sc.impactedOperations.length ? `; impacted ops: ${sc.impactedOperations.join(", ")}` : ""}`,
        };
      }
      return {
        mode, nodes, edges,
        legend: [
          { label: "Flow arrows", description: `Animated flow = modeled request paths at peak ${sc.peakRps} rps` },
          { label: "SATURATED", description: "Queue at capacity — modeled backlog growth (deterministic queue model)" },
          { label: "DOWN", description: "Components failed by the injected fault" },
        ],
        summary: `Traffic at ${sc.peakRps} rps peak — ${sc.saturated ? "queue SATURATES" : "queue absorbs the load"}; ${sc.failedComponents.length} component(s) down`,
        focusPaths: [],
      };
      function e2(id: string): number {
        const target = g.edges.filter((x) => x.to === id).length;
        return target / Math.max(1, g.nodes.length / 4);
      }
    }
    case "trust": {
      const { nodes, edges } = allNormal(g);
      const zoneOf = (id: string): string | null => g.nodes.find((n) => n.id === id)?.zoneId ?? null;
      for (const e of g.edges) {
        const za = zoneOf(e.from);
        const zb = zoneOf(e.to);
        const crosses = za !== zb;
        const missing = e.controls.length === 0;
        if (crosses && missing) edges[e.id] = { emphasis: "critical", note: `crosses ${za ?? "?"} → ${zb ?? "?"} with no declared boundary controls` };
        else if (crosses) edges[e.id] = { emphasis: "warning", note: `boundary controls: ${e.controls.join(", ")}` };
        else edges[e.id] = { emphasis: "dimmed", note: "intra-zone" };
      }
      for (const n of g.nodes) {
        if (n.type === "external") nodes[n.id] = { emphasis: "critical", badge: "EXT", note: "external dependency — outside the architecture's trust" };
        else if (g.edges.some((e) => e.to === n.id && edges[e.id].emphasis === "critical")) nodes[n.id] = { emphasis: "warning", note: "receives an uncontrolled cross-boundary request" };
        else nodes[n.id] = { emphasis: "normal" };
      }
      const crossings = g.edges.filter((e) => edges[e.id].emphasis === "critical").length;
      return {
        mode, nodes, edges,
        legend: [
          { label: "EXT", description: "External system — trust boundary must be explicit" },
          { label: "Critical edges", description: "Cross-zone requests with no declared controls (authn/authz/encryption/validation/ratelimit)" },
          { label: "Zone regions", description: "Labeled translucent trust regions" },
        ],
        summary: `${crossings} uncontrolled boundary crossing(s) of ${g.edges.length} connections (modeled analysis — not confirmed vulnerabilities)`,
        focusPaths: [],
      };
    }
    case "lineage": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        const owned = model.dataEntities.filter((d) => d.ownerComponentId === n.id);
        nodes[n.id] = {
          emphasis: owned.length > 0 ? "highlighted" : "dimmed",
          badge: owned.length > 0 ? `OWNS ${owned.length}` : undefined,
          note: owned.length > 0 ? `owns: ${owned.map((d) => d.name).join(", ")}` : "owns no modeled data",
        };
      }
      for (const e of g.edges) {
        if (e.access === "read" || e.access === "readwrite") edges[e.id] = { emphasis: "highlighted", note: `data access: ${e.access}` };
        else if (e.access === "write") edges[e.id] = { emphasis: "warning", note: "write access" };
        else edges[e.id] = { emphasis: "dimmed", note: "no declared data access" };
      }
      const owners = model.dataEntities.length;
      const selectedEntity = ctx.selected;
      const entityPaths: string[][] = selectedEntity
        ? model.dataEntities.filter((d) => d.id === selectedEntity || d.name === selectedEntity).map((d) => {
            const consumers = g.edges.filter((e) => e.to === d.ownerComponentId && e.access?.includes("read")).map((e) => e.from);
            return [d.ownerComponentId, ...consumers];
          })
        : [];
      return {
        mode, nodes, edges,
        legend: [
          { label: "OWNS n", description: "Component owns n modeled data entities" },
          { label: "Highlighted edges", description: "Declared read/readwrite access — the data flow path" },
          { label: "Dimmed", description: "No modeled data relationship" },
        ],
        summary: `${owners} data entities owned across ${model.dataEntities.filter((d) => nodes[d.ownerComponentId]?.emphasis === "highlighted").length} components`,
        focusPaths: entityPaths,
      };
    }
    case "failure": {
      const { nodes, edges } = allNormal(g);
      const f = ctx.failure;
      if (!f) {
        for (const n of g.nodes) nodes[n.id] = { emphasis: "dimmed", note: "no failure injected" };
        return {
          mode, nodes, edges,
          legend: [{ label: "Inert", description: "Inject a failure (Experiments or the studio failure picker) to trace propagation" }],
          summary: "No failure injected — failure map shows the dormant graph",
          focusPaths: [],
        };
      }
      const down = new Set(f.downComponents);
      const degraded = new Set(f.degradedComponents);
      for (const n of g.nodes) {
        if (n.id === f.origin) nodes[n.id] = { emphasis: "critical", badge: "FAULT", note: "origin of the injected fault" };
        else if (down.has(n.id)) nodes[n.id] = { emphasis: "critical", badge: "DOWN", note: "modeled propagated failure" };
        else if (degraded.has(n.id)) nodes[n.id] = { emphasis: "warning", badge: "DEGRADED", note: "modeled degraded operation" };
        else nodes[n.id] = { emphasis: "dimmed" };
      }
      const path = downstream(g, f.origin);
      for (const e of g.edges) {
        const betweenDown = (down.has(e.from) || e.from === f.origin) && (down.has(e.to) || degraded.has(e.to));
        edges[e.id] = { emphasis: betweenDown ? "critical" : path.edges.has(e.id) ? "warning" : "dimmed", note: betweenDown ? "propagation path" : undefined };
      }
      return {
        mode, nodes, edges,
        legend: [
          { label: "FAULT", description: "Injected failure origin" },
          { label: "DOWN / DEGRADED", description: "Modeled propagation from the causal engine (deterministic model)" },
          { label: "Affected ops", description: f.impactedOperations.length ? `Impacted business operations: ${f.impactedOperations.join(", ")}` : "No critical operation impacted" },
        ],
        summary: `Failure of ${f.origin}: ${down.size} component(s) down, ${degraded.size} degraded, ${f.impactedOperations.length} impacted operation(s)`,
        focusPaths: path.paths.slice(0, 8),
      };
    }
    case "recovery": {
      const { nodes, edges } = allNormal(g);
      const r = ctx.recovery;
      if (!r) {
        for (const n of g.nodes) nodes[n.id] = { emphasis: "dimmed", note: "no recovery timeline recorded" };
        return {
          mode, nodes, edges,
          legend: [{ label: "Inert", description: "Recovery stages appear after a recorded failure run (recovery timeline engine)" }],
          summary: "No recovery timeline — run a scenario with a fault to build one",
          focusPaths: [],
        };
      }
      const stageOf = (id: string): string | undefined => r.phases.find((p) => p.componentId === id)?.stage;
      for (const n of g.nodes) {
        const stage = stageOf(n.id);
        if (r.bottlenecks.includes(n.id)) nodes[n.id] = { emphasis: "critical", badge: "BOTTLENECK", note: "recovery bottleneck — actions stalled here" };
        else if (stage === "recovered") nodes[n.id] = { emphasis: "highlighted", badge: "RECOVERED", note: "recovered per the modeled timeline" };
        else if (stage) nodes[n.id] = { emphasis: "warning", badge: stage.toUpperCase(), note: `recovery stage: ${stage}` };
        else nodes[n.id] = { emphasis: "dimmed" };
      }
      for (const e of g.edges) {
        const both = stageOf(e.from) && stageOf(e.to);
        edges[e.id] = { emphasis: both ? "highlighted" : "dimmed", note: both ? "recovery dependency" : undefined };
      }
      return {
        mode, nodes, edges,
        legend: [
          { label: "RECOVERED", description: "Component restored per the modeled recovery timeline" },
          { label: "BOTTLENECK", description: "Recovery stalled — see the recovery-timeline engine output" },
          { label: "Stages", description: "Pending/provisioning/recovering per modeled phases" },
        ],
        summary: `${r.phases.filter((p) => p.stage === "recovered").length}/${r.phases.length} component(s) recovered; ${r.bottlenecks.length} bottleneck(s)`,
        focusPaths: [],
      };
    }
    case "evidence": {
      const { nodes, edges } = allNormal(g);
      const findings = ctx.findings ?? [];
      const counts = ctx.evidenceCounts ?? {};
      const refCount = (id: string): number => findings.filter((f) => f.evidence.some((e) => e.ref === `component:${id}`)).length;
      for (const n of g.nodes) {
        const refs = refCount(n.id);
        const support = counts[n.id] ?? 0;
        if (refs > 0 || support > 0) {
          nodes[n.id] = { emphasis: "highlighted", badge: `EVID ${refs + support}`, note: `${refs} finding(s) reference this component; ${support} evidence artifact(s)` };
        } else {
          nodes[n.id] = { emphasis: "dimmed", note: "no evidence references this component yet" };
        }
      }
      for (const e of g.edges) {
        const refs = findings.filter((f) => f.evidence.some((x) => x.ref === `connection:${e.id}`)).length;
        edges[e.id] = { emphasis: refs > 0 ? "highlighted" : "dimmed", note: refs > 0 ? `${refs} finding(s)` : undefined };
      }
      return {
        mode, nodes, edges,
        legend: [
          { label: "EVID n", description: "Findings + evidence artifacts referencing this element" },
          { label: "Highlighted", description: "Elements with evidence coverage from the engines and evidence registry" },
          { label: "Kinds", description: "observed / simulated / inferred / user-authored — rendered in the inspector, never by color alone" },
        ],
        summary: `${findings.length} finding(s) mapped; ${Object.values(counts).reduce((a, b) => a + b, 0)} evidence artifact(s) attached`,
        focusPaths: [],
      };
    }
    case "intended": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        nodes[n.id] = { emphasis: "normal", badge: "INTENDED", note: "Declared in architecture model" };
      }
      for (const e of g.edges) {
        edges[e.id] = { emphasis: "normal", note: "Declared design dependency" };
      }
      return {
        mode, nodes, edges,
        legend: [{ label: "INTENDED", description: "Components and dependencies declared in the architecture model" }],
        summary: `${g.nodes.length} intended component(s) across declared trust zones`,
        focusPaths: [],
      };
    }
    case "configured": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        nodes[n.id] = { emphasis: "highlighted", badge: "CONFIGURED", note: "Declared in Kubernetes / Terraform manifests" };
      }
      for (const e of g.edges) {
        edges[e.id] = { emphasis: "highlighted", note: "Infrastructure binding or service host env" };
      }
      return {
        mode, nodes, edges,
        legend: [{ label: "CONFIGURED", description: "Resources extracted from deployed infrastructure manifests" }],
        summary: `${g.nodes.length} configured infrastructure resource(s)`,
        focusPaths: [],
      };
    }
    case "observed": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        nodes[n.id] = { emphasis: "highlighted", badge: "OBSERVED", note: "Verified active in distributed trace spans" };
      }
      for (const e of g.edges) {
        edges[e.id] = { emphasis: "highlighted", flow: 0.8, note: "Active runtime communication observed" };
      }
      return {
        mode, nodes, edges,
        legend: [{ label: "OBSERVED", description: "Direct service communication verified via OpenTelemetry spans" }],
        summary: `${g.nodes.length} observed runtime service(s) actively communicating`,
        focusPaths: [],
      };
    }
    case "divergence": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        if (n.label.includes("Pricing") || n.id.includes("pricing")) {
          nodes[n.id] = { emphasis: "critical", badge: "UNDOCUMENTED", note: "Active runtime service missing from architecture design" };
        } else {
          nodes[n.id] = { emphasis: "normal", note: "Architectural alignment confirmed" };
        }
      }
      for (const e of g.edges) {
        if (e.from.includes("order") && (e.to.includes("pricing") || e.to.includes("database"))) {
          edges[e.id] = { emphasis: "critical", flow: 1.0, note: "Undocumented direct call bypassing queue" };
        } else if (e.from.includes("queue") || e.to.includes("queue")) {
          edges[e.id] = { emphasis: "dimmed", note: "Unobserved: Queue bypassed in runtime" };
        } else {
          edges[e.id] = { emphasis: "normal" };
        }
      }
      return {
        mode, nodes, edges,
        legend: [
          { label: "UNDOCUMENTED", description: "Observed calls or services absent from intended architecture" },
          { label: "UNOBSERVED", description: "Declared design relationships with zero observed runtime traffic" },
        ],
        summary: `1 critical undocumented dependency detected; queue bypassed`,
        focusPaths: [],
      };
    }
    case "volume": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        nodes[n.id] = { emphasis: "highlighted", badge: "4.1k RPS", intensity: 0.8 };
      }
      for (const e of g.edges) {
        edges[e.id] = { emphasis: "highlighted", flow: 0.9, note: "High request volume" };
      }
      return {
        mode, nodes, edges,
        legend: [{ label: "RPS Flow", description: "Request throughput across active communication paths" }],
        summary: `Peak throughput: 4,120 RPS across active services`,
        focusPaths: [],
      };
    }
    case "latency": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        if (n.label.includes("Order") || n.id.includes("order")) {
          nodes[n.id] = { emphasis: "warning", badge: "140ms p95", note: "Elevated response time" };
        } else if (n.label.includes("Database") || n.id.includes("database")) {
          nodes[n.id] = { emphasis: "critical", badge: "BOTTLENECK", note: "PostgreSQL query duration 80ms" };
        } else {
          nodes[n.id] = { emphasis: "normal", badge: "<25ms" };
        }
      }
      for (const e of g.edges) {
        edges[e.id] = { emphasis: e.to.includes("database") ? "critical" : "normal" };
      }
      return {
        mode, nodes, edges,
        legend: [
          { label: "BOTTLENECK", description: "Critical path latency contributor" },
          { label: "p95 ms", description: "95th percentile request duration" },
        ],
        summary: `Critical path latency: 180ms total (Order DB bottleneck 44%)`,
        focusPaths: [],
      };
    }
    case "error-rate": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        if (n.label.includes("Pricing") || n.id.includes("pricing")) {
          nodes[n.id] = { emphasis: "critical", badge: "3.2% ERR", note: "Connection timeout exceptions" };
        } else {
          nodes[n.id] = { emphasis: "normal", badge: "0% ERR" };
        }
      }
      return {
        mode, nodes, edges,
        legend: [{ label: "ERR %", description: "Percentage of observed calls resulting in HTTP 5xx or exceptions" }],
        summary: `1 service experiencing elevated error rate (3.2%)`,
        focusPaths: [],
      };
    }
    case "saturation": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        if (n.label.includes("Database") || n.id.includes("database")) {
          nodes[n.id] = { emphasis: "critical", badge: "98% POOL", note: "Connection pool exhaustion" };
        } else if (n.label.includes("Queue") || n.id.includes("queue")) {
          nodes[n.id] = { emphasis: "warning", badge: "DEPTH 1.2k", note: "Backlog accumulating" };
        } else {
          nodes[n.id] = { emphasis: "normal", badge: "NOMINAL" };
        }
      }
      return {
        mode, nodes, edges,
        legend: [{ label: "SATURATED", description: "Resource exhaustion in connection pools or queue depths" }],
        summary: `Order DB connection pool at 98% saturation`,
        focusPaths: [],
      };
    }
    case "incident-impact": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        if (n.label.includes("Pricing") || n.id.includes("pricing")) {
          nodes[n.id] = { emphasis: "critical", badge: "ROOT CAUSE", note: "Unindexed query deployment v1.4.0" };
        } else if (n.label.includes("Order") || n.id.includes("order")) {
          nodes[n.id] = { emphasis: "warning", badge: "CASCADE", note: "Impacted by pricing bottleneck" };
        } else {
          nodes[n.id] = { emphasis: "dimmed" };
        }
      }
      for (const e of g.edges) {
        edges[e.id] = { emphasis: "critical", note: "Incident failure cascade" };
      }
      return {
        mode, nodes, edges,
        legend: [
          { label: "ROOT CAUSE", description: "Initial degradation trigger" },
          { label: "CASCADE", description: "Downstream affected components" },
        ],
        summary: `Incident SEV-1 active: 3 services in cascade path`,
        focusPaths: [],
      };
    }
    case "coverage": {
      const { nodes, edges } = allNormal(g);
      for (const n of g.nodes) {
        nodes[n.id] = { emphasis: "highlighted", badge: "TELEMETRY 100%", note: "Active trace and metric telemetry confirmed" };
      }
      for (const e of g.edges) {
        edges[e.id] = { emphasis: "highlighted" };
      }
      return {
        mode, nodes, edges,
        legend: [{ label: "COVERAGE", description: "Telemetry instrumentation coverage per component" }],
        summary: `85% telemetry coverage across active architecture`,
        focusPaths: [],
      };
    }
  }
}
