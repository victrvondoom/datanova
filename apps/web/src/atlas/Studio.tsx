/**
 * Datanova Atlas — Architecture Studio (Campaign 06, Tasks 07, 12-15, 24, 25, 26).
 * The flagship workstation: object navigator, real 3D spatial canvas (with an
 * honest 2D fallback), inspector, operational dock, minimap, editing with
 * undo/redo, scenario console, and snapshot comparison — all driven by the
 * canonical model and existing engines.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Crosshair, LayoutGrid, MousePointer2,
  Play, Sparkles, Trash2, Undo2, Redo2, Boxes, Camera, Plus, GitCompare,
} from "lucide-react";
import type { ArchitectureModel, Finding } from "../lab/model";
import { diffModels, parseModel, serializeModel, validateModel } from "../lab/model";
import { critiqueArchitecture } from "../lab/engines/critic";
import { scenarioTemplate, runScenario } from "../lab/engines/scenario";
import { blastRadius } from "../lab/engines/blastradius";
import { recoveryTimeline, recoveryBottlenecks } from "../lab/engines/recovery-timeline";
import { toVisGraph, type VisGraph } from "./graph";
import { layeredLayout, layoutBounds, applyUserLayout, type UserLayout } from "./layout";
import { computeLayer, MAP_MODES, REALITY_MAP_MODES, ALL_MAP_MODES, type MapMode, type LayerContext, type LayerResult } from "./layers";
import { AtlasScene } from "./scene";
import { ABadge, AButton, ADialog, AInput, ASelect, AAnnouncer } from "./ui";
import type { PanelPrefs, Project } from "./state";

const KIND_LABEL: Record<string, string> = {
  client: "Client", gateway: "Gateway", service: "Service", worker: "Worker", queue: "Queue",
  cache: "Cache", database: "Database", objectstore: "Object store", broker: "Broker",
  analytics: "Analytics", external: "External",
};
const KINDS = Object.keys(KIND_LABEL);

interface DockTab { id: string; label: string }

export const StudioView: React.FC<{
  model: ArchitectureModel;
  project: Project;
  panels: PanelPrefs;
  onPanels: (updater: (p: PanelPrefs) => PanelPrefs) => void;
  onSave: (m: ArchitectureModel) => void;
  onUnsaved: () => void;
  onNavigate: (s: "experiments" | "validation" | "exchange") => void;
}> = ({ model, project, panels, onPanels, onSave, onUnsaved, onNavigate }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<AtlasScene | null>(null);
  const [mode, setMode] = useState<MapMode>(panels.mode);
  const [selection, setSelection] = useState<{ id: string; kind: "node" | "edge" } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string>("");
  const [diagnostics, setDiagnostics] = useState<{ drawCalls: number; triangles: number; webgl: boolean; fps: number }>({ drawCalls: 0, triangles: 0, webgl: false, fps: 0 });
  const [is2D, setIs2D] = useState(panels.is2D);
  const [scenario, setScenario] = useState<{
    summary: string; saturated: boolean; peakRps: number;
    results: { expectationId: string; outcome: string; detail: string }[];
    failed: string[]; impacted: string[];
    recording: import("../lab/engines/flightrecorder").Recording;
  } | null>(null);
  const [dockTab, setDockTab] = useState("events");
  const [navQuery, setNavQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState("service");
  const [addName, setAddName] = useState("");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [localAnnounce, setLocalAnnounce] = useState("");
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const [userLayout, setUserLayout] = useState<UserLayout | null>(null);
  const [simStep, setSimStep] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<"zone" | "group" | "type" | "none">("zone");

  const graph = useMemo<VisGraph>(() => toVisGraph(model), [model]);
  const baseLayout = useMemo(() => layeredLayout(graph), [graph]);
  const layout = useMemo(() => applyUserLayout(baseLayout, userLayout), [baseLayout, userLayout]);

  const maxStep = useMemo(() => {
    if (!scenario) return 0;
    const eventMax = scenario.recording.events.length > 0
      ? Math.max(...scenario.recording.events.map((e) => e.t), scenario.recording.events.length)
      : 0;
    return Math.max(eventMax, 10);
  }, [scenario]);

  const activeEvents = useMemo(() => {
    if (!scenario) return [];
    if (simStep === null) return scenario.recording.events;
    return scenario.recording.events.filter((e) => e.t <= simStep);
  }, [scenario, simStep]);

  const activeFailed = useMemo(() => {
    if (!scenario) return [];
    if (simStep === null) return scenario.failed;
    return activeEvents
      .filter((e) => e.type === "fault" || (e.type === "status-change" && e.to === "down"))
      .map((e) => e.componentId)
      .filter(Boolean) as string[];
  }, [scenario, simStep, activeEvents]);

  const pushHistory = useCallback((m: ArchitectureModel): void => {
    undoStack.current.push(serializeModel(m));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setHistoryState({ undo: undoStack.current.length, redo: 0 });
  }, []);

  const findings = useMemo<Finding[]>(() => critiqueArchitecture(model).findings, [model]);

  const layerCtx = useMemo<LayerContext>(() => ({
    selected: selection?.kind === "node" ? selection.id : undefined,
    scenario: scenario ? {
      saturated: scenario.saturated, peakRps: scenario.peakRps,
      expectationResults: scenario.results, impactedOperations: scenario.impacted,
      failedComponents: activeFailed,
    } : null,
    failure: selection && mode === "failure" ? (() => {
      const origin = selection.kind === "node" ? selection.id : graph.nodes[0]?.id;
      if (!origin) return null;
      const br = blastRadius(model, origin, "down");
      const down = Object.entries(br.affectedComponents).filter(([, s]) => s.status === "down").map(([id]) => id);
      const degraded = Object.entries(br.affectedComponents).filter(([, s]) => s.status === "degraded").map(([id]) => id);
      return { origin, downComponents: down, degradedComponents: degraded, impactedOperations: br.impactedOperations.map((o) => o.operationId) };
    })() : null,
    recovery: scenario ? (() => {
      const tl = recoveryTimeline(model, scenario.recording);
      return {
        phases: tl.components.map((c) => ({ componentId: c.componentId, stage: c.finalPhase })),
        bottlenecks: recoveryBottlenecks(tl).map((b) => b.componentId),
      };
    })() : null,
    findings,
    evidenceCounts: Object.fromEntries(
      findings.map((f) => f.evidence.map((e) => e.ref.replace("component:", ""))).flat()
        .filter((r) => !r.includes(":"))
        .map((r) => [r, (findings.filter((f) => f.evidence.some((e) => e.ref === `component:${r}`)).length)]),
    ),
  }), [selection, scenario, activeFailed, mode, graph, model, findings]);

  const layer = useMemo<LayerResult>(() => computeLayer(graph, model, mode, layerCtx), [graph, model, mode, layerCtx]);

  // ——— 3D mount lifecycle (Task 09.3) ———
  useEffect(() => {
    if (is2D || !containerRef.current) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const scene = new AtlasScene(containerRef.current, {
      onHover: (id, kind) => {
        if (!id) { setHoverInfo(""); return; }
        const node = graph.nodes.find((n) => n.id === id);
        const edge = graph.edges.find((e) => e.id === id);
        setHoverInfo(node ? `${node.label} (${KIND_LABEL[node.type]})` : edge ? `connection ${edge.from} → ${edge.to} (${edge.kind})` : id);
        void kind;
      },
      onSelect: (id, kind, additive) => {
        if (!id) { setSelection(null); return; }
        setSelection({ id, kind: kind ?? "node" });
        if (additive && kind === "node") sceneRef.current?.focusNode(id);
      },
      onFocus: (id) => sceneRef.current?.focusNode(id),
      onDiagnostics: (d) => setDiagnostics((prev) => ({ ...d, fps: prev.fps })),
      onNodeDragEnd: (id, x, z) => {
        setUserLayout((prev) => ({ moved: { ...(prev?.moved ?? {}), [id]: { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 } } }));
        setLocalAnnounce(`Position updated for ${id}.`);
      },
    }, reducedMotion);
    sceneRef.current = scene;
    scene.build(graph, layout);
    scene.applyLayer(layer, new Set(selection ? [selection.id] : []));
    setDiagnostics((d) => ({ ...d, webgl: scene.webglAvailable, fps: scene.lastFrameStats.fps }));
    const resizeObserver = new ResizeObserver(() => scene.resize());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => { resizeObserver.disconnect(); scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is2D]); // mount per 2D/3D toggle; graph/layout/layer updates flow through the effects below

  useEffect(() => { sceneRef.current?.build(graph, layout); }, [graph, layout]);
  useEffect(() => { sceneRef.current?.applyLayer(layer, new Set(selection ? [selection.id] : [])); }, [layer, selection]);
  useEffect(() => { if (panels.cameraPreset) sceneRef.current?.preset(panels.cameraPreset); }, [panels.cameraPreset]);

  // ——— editing operations (Task 24) ———
  const applyEdit = useCallback((m: ArchitectureModel, announce: string): void => {
    const problems = validateModel(m);
    if (problems.length > 0) {
      setLocalAnnounce(`Edit rejected — model invalid: ${problems[0].path} ${problems[0].message}`);
      return;
    }
    pushHistory(model);
    onUnsaved();
    onSave(m);
    setLocalAnnounce(announce);
  }, [model, pushHistory, onUnsaved, onSave]);

  const addComponent = (): void => {
    if (!addName.trim()) return;
    const id = `c-${addKind}-${model.components.length + 1}`;
    if (model.components.some((c) => c.id === id)) { setLocalAnnounce("Component id collision — rename an existing component first."); return; }
    const m: ArchitectureModel = {
      ...model,
      components: [...model.components, {
        id, kind: addKind as never, name: addName.trim(), purpose: "Added in Atlas Studio",
        zoneId: model.zones[0]?.id, config: {}, requirementIds: [],
      }],
    };
    applyEdit(m, `Added ${addName.trim()} (${KIND_LABEL[addKind]}).`);
    setAddOpen(false); setAddName("");
    setSelection({ id, kind: "node" });
  };

  const connect = (from: string, to: string): void => {
    if (from === to) { setConnectFrom(null); return; }
    const id = `cn-${from}-${to}`;
    if (model.connections.some((c) => c.id === id)) { setLocalAnnounce("That connection already exists."); setConnectFrom(null); return; }
    const m: ArchitectureModel = {
      ...model,
      connections: [...model.connections, {
        id, from, to, kind: "sync", criticality: 3, failureBehavior: "blocks",
        operationIds: [], requirementIds: [],
      }],
    };
    applyEdit(m, `Connected ${from} → ${to} (sync). Edit properties in the inspector.`);
    setConnectFrom(null);
    setSelection({ id, kind: "edge" });
  };

  const deleteSelected = (): void => {
    if (!selection) return;
    if (selection.kind === "node") {
      const m: ArchitectureModel = {
        ...model,
        components: model.components.filter((c) => c.id !== selection.id),
        connections: model.connections.filter((c) => c.from !== selection.id && c.to !== selection.id),
      };
      applyEdit(m, `Deleted component ${selection.id} and its connections.`);
    } else {
      const m: ArchitectureModel = { ...model, connections: model.connections.filter((c) => c.id !== selection.id) };
      applyEdit(m, `Deleted connection ${selection.id}.`);
    }
    setConfirmDelete(false);
    setSelection(null);
  };

  const undo = (): void => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(serializeModel(model));
    onSave(parseModel(prev));
    setHistoryState({ undo: undoStack.current.length, redo: redoStack.current.length });
    setLocalAnnounce("Undo applied.");
  };
  const redo = (): void => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(serializeModel(model));
    onSave(parseModel(next));
    setHistoryState({ undo: undoStack.current.length, redo: redoStack.current.length });
    setLocalAnnounce("Redo applied.");
  };

  const renameSelected = (name: string): void => {
    if (!selection || selection.kind !== "node" || !name.trim()) return;
    applyEdit({ ...model, components: model.components.map((c) => (c.id === selection.id ? { ...c, name: name.trim() } : c)) }, "Component renamed.");
  };
  const setConfig = (key: string, value: string): void => {
    if (!selection || selection.kind !== "node") return;
    const numeric = Number(value);
    const parsed = value !== "" && Number.isFinite(numeric) ? numeric : value;
    applyEdit({
      ...model,
      components: model.components.map((c) => (c.id === selection.id ? { ...c, config: { ...c.config, [key]: parsed } } : c)),
    }, `Property ${key} updated.`);
  };

  const updateSelectedConnection = useCallback((patch: Partial<import("../lab/model").Connection>): void => {
    if (!selection || selection.kind !== "edge") return;
    const m: ArchitectureModel = {
      ...model,
      connections: model.connections.map((c) => (c.id === selection.id ? { ...c, ...patch } : c)),
    };
    applyEdit(m, "Updated connection properties.");
  }, [selection, model, applyEdit]);

  const runBurst = (): void => {
    const s = scenarioTemplate("burst-overload", model, 120);
    const result = runScenario(model, s);
    setSimStep(null);
    setScenario({
      summary: `burst-overload @ 120 rps — ${result.allPassed ? "all expectations pass" : "expectation failures"}; ${result.expectationResults.length} expectation(s)`,
      saturated: result.workload.saturated,
      peakRps: 120,
      results: result.expectationResults,
      failed: Object.entries(result.faults.combinedStatus).filter(([, st]) => st === "down").map(([id]) => id),
      impacted: blastRadius(model, "meta-db", "down").impactedOperations.map((o) => o.operationId),
      recording: result.faults.recording,
    });
    setDockTab("scenario");
    setMode("traffic");
    onPanels((p) => ({ ...p, mode: "traffic" }));
    setLocalAnnounce(`Scenario run: ${result.expectationResults.filter((r) => r.outcome === "pass").length}/${result.expectationResults.length} expectations pass.`);
  };

  const takeSnapshot = (): void => {
    setSnapshot(serializeModel(model));
    setLocalAnnounce("Snapshot captured — mutate the architecture and compare.");
  };
  const compareSnapshot = (): void => {
    if (!snapshot) { setLocalAnnounce("No snapshot captured yet."); return; }
    setCompareOpen(true);
  };
  const diff = useMemo(() => (snapshot ? diffModels(parseModel(snapshot), model) : []), [snapshot, model]);

  const events = useMemo(() => {
    const list: { at: string; kind: string; text: string }[] = [
      { at: "session", kind: "open", text: `Studio opened on ${model.name} (v${project.version})` },
    ];
    if (scenario) list.push({ at: "session", kind: "scenario", text: scenario.summary });
    if (selection) list.push({ at: "session", kind: "select", text: `Selected ${selection.kind} ${selection.id}` });
    return list;
  }, [model.name, project.version, scenario, selection]);

  const bounds = useMemo(() => layoutBounds(layout), [layout]);
  const selectedComponent = selection?.kind === "node" ? model.components.find((c) => c.id === selection.id) : undefined;
  const selectedConnection = selection?.kind === "edge" ? model.connections.find((c) => c.id === selection.id) : undefined;

  const navItems = useMemo(() => graph.nodes
    .filter((n) => (typeFilter === "all" || n.type === typeFilter) && (!navQuery || n.label.toLowerCase().includes(navQuery.toLowerCase()) || n.id.includes(navQuery)))
    .sort((a, b) => {
      if (groupBy === "zone") return (a.zoneId ?? "").localeCompare(b.zoneId ?? "") || a.id.localeCompare(b.id);
      if (groupBy === "group") {
        const ga = String(model.components.find((c) => c.id === a.id)?.config.group ?? "");
        const gb = String(model.components.find((c) => c.id === b.id)?.config.group ?? "");
        return ga.localeCompare(gb) || a.id.localeCompare(b.id);
      }
      if (groupBy === "type") return a.type.localeCompare(b.type) || a.id.localeCompare(b.id);
      return a.id.localeCompare(b.id);
    }), [graph.nodes, typeFilter, navQuery, groupBy, model.components]);

  const dockTabs: DockTab[] = [
    { id: "events", label: "Events" },
    { id: "scenario", label: "Scenario" },
    { id: "findings", label: `Findings (${findings.length})` },
    { id: "legend", label: "Legend" },
  ];

  return (
    <div className="flex h-full min-h-0 text-slate-200">
      <AAnnouncer message={localAnnounce} />

      {/* ——— Left: object navigator ——— */}
      {panels.navigator && (
        <aside aria-label="Object navigator" className="w-56 shrink-0 border-r border-slate-800/80 bg-slate-900/50 flex flex-col min-h-0">
          <div className="p-2 space-y-1.5 border-b border-slate-800/80">
            <AInput aria-label="Filter components" placeholder="Filter…" value={navQuery} onChange={(e) => setNavQuery(e.target.value)} />
            <div className="grid grid-cols-2 gap-1">
              <ASelect aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </ASelect>
              <ASelect aria-label="Group components" value={groupBy} onChange={(e) => setGroupBy(e.target.value as "zone" | "group" | "type" | "none")}>
                <option value="zone">By Zone</option>
                <option value="group">By Group</option>
                <option value="type">By Type</option>
                <option value="none">Flat</option>
              </ASelect>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {navItems.length === 0 && <li className="px-2 py-3 text-[11px] text-slate-500">No components match the filter.</li>}
            {navItems.map((n, idx) => {
              const st = layer.nodes[n.id];
              const comp = model.components.find((c) => c.id === n.id);
              const groupLabel = groupBy === "zone" ? (n.zoneId ? (graph.zones.find((z) => z.id === n.zoneId)?.label ?? n.zoneId) : "Unzoned")
                : groupBy === "group" ? (comp?.config.group ? String(comp.config.group) : "Ungrouped")
                : groupBy === "type" ? KIND_LABEL[n.type]
                : null;
              const prev = idx > 0 ? navItems[idx - 1] : null;
              const prevComp = prev ? model.components.find((c) => c.id === prev.id) : null;
              const prevLabel = prev ? (
                groupBy === "zone" ? (prev.zoneId ? (graph.zones.find((z) => z.id === prev.zoneId)?.label ?? prev.zoneId) : "Unzoned")
                : groupBy === "group" ? (prevComp?.config.group ? String(prevComp.config.group) : "Ungrouped")
                : groupBy === "type" ? KIND_LABEL[prev.type]
                : null
              ) : null;
              const showHeader = groupLabel && groupLabel !== prevLabel;
              return (
                <React.Fragment key={n.id}>
                  {showHeader && (
                    <li className="px-2 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800/40 rounded">
                      {groupLabel}
                    </li>
                  )}
                  <li>
                    <button
                      onClick={() => { setSelection({ id: n.id, kind: "node" }); sceneRef.current?.focusNode(n.id); }}
                      aria-current={selection?.id === n.id ? "true" : undefined}
                      className={`w-full text-left rounded px-2 py-1.5 text-xs transition-colors ${
                        selection?.id === n.id ? "bg-sky-500/20 text-sky-200 border border-sky-500/40"
                        : "text-slate-300 hover:bg-slate-800/70 border border-transparent"
                      }`}>
                      <span className="font-semibold block truncate">{n.label}</span>
                      <span className="text-[10px] text-slate-500">{KIND_LABEL[n.type]} · {n.id}{st?.badge ? ` · ${st.badge}` : ""}</span>
                    </button>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
          <div className="p-1.5 border-t border-slate-800/80 flex gap-1">
            <AButton className="flex-1" onClick={() => setAddOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={11} aria-hidden /> Add</span></AButton>
            <AButton aria-label="Collapse navigator" onClick={() => onPanels((p) => ({ ...p, navigator: false }))}><ChevronLeft size={11} aria-hidden /></AButton>
          </div>
        </aside>
      )}

      {/* ——— Center column ——— */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Canvas toolbar (Task 5.1 spec) */}
        <div role="toolbar" aria-label="Canvas tools" className="h-10 shrink-0 border-b border-slate-800/80 bg-slate-900/60 flex items-center gap-1 px-2 overflow-x-auto">
          <label htmlFor="mode-select" className="sr-only">Map mode</label>
          <select id="mode-select" value={mode} onChange={(e) => { setMode(e.target.value as MapMode); onPanels((p) => ({ ...p, mode: e.target.value as MapMode })); }}
            className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-xs text-slate-100">
            <optgroup label="Architecture Modes">
              {MAP_MODES.map((m) => <option key={m.mode} value={m.mode}>{m.label}</option>)}
            </optgroup>
            <optgroup label="Operational Reality Modes">
              {REALITY_MAP_MODES.map((m) => <option key={m.mode} value={m.mode}>{m.label}</option>)}
            </optgroup>
          </select>
          <span className="w-px h-5 bg-slate-700 mx-1" />
          <AButton aria-label="Focus selection" disabled={!selection} onClick={() => selection && sceneRef.current?.focusNode(selection.id)}><Crosshair size={12} aria-hidden /></AButton>
          <AButton aria-label="Fit to view" onClick={() => sceneRef.current?.fitToView()}><MaximizeIcon /></AButton>
          <AButton aria-label="Isometric view" onClick={() => { sceneRef.current?.preset("iso"); onPanels((p) => ({ ...p, cameraPreset: "iso" })); }}><Camera size={12} aria-hidden /></AButton>
          <AButton aria-label="Top-down view" onClick={() => { sceneRef.current?.preset("top"); onPanels((p) => ({ ...p, cameraPreset: "top" })); }}><LayoutGrid size={12} aria-hidden /></AButton>
          <span className="w-px h-5 bg-slate-700 mx-1" />
          <AButton variant={connectFrom ? "primary" : "default"} onClick={() => setConnectFrom(connectFrom ? null : (selection?.kind === "node" ? selection.id : graph.nodes[0]?.id ?? null))}
            title="Connect: select a source node, then pick the target">
            <span className="inline-flex items-center gap-1"><MousePointer2 size={11} aria-hidden /> {connectFrom ? `Connect from ${connectFrom}…` : "Connect"}</span>
          </AButton>
          <AButton aria-label={historyState.undo > 0 ? "Undo" : "Undo (nothing)"} disabled={historyState.undo === 0} onClick={undo}><Undo2 size={12} aria-hidden /></AButton>
          <AButton aria-label={historyState.redo > 0 ? "Redo" : "Redo (nothing)"} disabled={historyState.redo === 0} onClick={redo}><Redo2 size={12} aria-hidden /></AButton>
          <span className="w-px h-5 bg-slate-700 mx-1" />
          <AButton variant="primary" onClick={runBurst}><span className="inline-flex items-center gap-1"><Play size={11} aria-hidden /> Run scenario</span></AButton>
          <AButton onClick={takeSnapshot}><span className="inline-flex items-center gap-1"><Sparkles size={11} aria-hidden /> Snapshot</span></AButton>
          <AButton disabled={!snapshot} onClick={compareSnapshot}><span className="inline-flex items-center gap-1"><GitCompare size={11} aria-hidden /> Compare</span></AButton>
          {userLayout && Object.keys(userLayout.moved).length > 0 && (
            <AButton onClick={() => { setUserLayout(null); setLocalAnnounce("Layout reset to deterministic grid."); }} title="Reset user-arranged node positions">
              Reset layout
            </AButton>
          )}
          <span className="ml-auto flex items-center gap-1">
            <AButton aria-pressed={is2D} onClick={() => { setIs2D(!is2D); onPanels((p) => ({ ...p, is2D: !is2D })); }}
              title="Toggle the accessible 2D map">{is2D ? "2D" : "3D"}</AButton>
          </span>
        </div>

        {/* Viewport */}
        <div className="flex-1 min-h-0 relative bg-slate-950">
          {is2D ? (
            <div role="img" aria-label={`2D architecture map — ${graph.nodes.length} components, ${graph.edges.length} connections`}
              className="absolute inset-0 overflow-auto p-4">
              <svg width={Math.max(bounds.maxX - bounds.minX, 400)} height={Math.max(bounds.maxZ - bounds.minZ, 300)}
                viewBox={`${bounds.minX} ${bounds.minZ} ${bounds.maxX - bounds.minX} ${bounds.maxZ - bounds.minZ}`}
                className="max-w-none">
                {graph.edges.map((e) => {
                  const a = layout.positions[e.from]; const b = layout.positions[e.to];
                  if (!a || !b) return null;
                  const st = layer.edges[e.id];
                  return <line key={e.id} x1={a.x} y1={a.z} x2={b.x} y2={b.z}
                    stroke={st?.emphasis === "critical" ? "#f43f5e" : st?.emphasis === "dimmed" ? "#1e293b" : st?.emphasis === "warning" ? "#f59e0b" : "#475569"}
                    strokeWidth={st?.emphasis === "critical" ? 3 : 2}
                    markerEnd="" role="presentation" />;
                })}
                {graph.nodes.map((n) => {
                  const p = layout.positions[n.id];
                  if (!p) return null;
                  const st = layer.nodes[n.id];
                  const sel = selection?.id === n.id;
                  return (
                    <g key={n.id} tabIndex={0} role="button" aria-label={`${n.label}, ${KIND_LABEL[n.type]}${st?.badge ? `, ${st.badge}` : ""}`}
                      onClick={() => setSelection({ id: n.id, kind: "node" })}
                      onKeyDown={(e) => { if (e.key === "Enter") setSelection({ id: n.id, kind: "node" }); }}
                      className="cursor-pointer">
                      <rect x={p.x - 5} y={p.z - 3.4} width={10} height={6.8} rx={1.4}
                        fill={st?.emphasis === "critical" ? "#7f1d1d" : st?.emphasis === "warning" ? "#78350f" : st?.emphasis === "dimmed" ? "#0f172a" : "#1e293b"}
                        stroke={sel ? "#22d3ee" : "#475569"} strokeWidth={sel ? 0.8 : 0.3} />
                      <text x={p.x} y={p.z + 0.6} textAnchor="middle" fontSize={2.6} fill="#cbd5e1">
                        {n.label.slice(0, 14)}
                      </text>
                      {st?.badge && <text x={p.x} y={p.z - 2.6} textAnchor="middle" fontSize={2.2} fill="#fbbf24">{st.badge}</text>}
                    </g>
                  );
                })}
              </svg>
              <p className="text-[11px] text-slate-500 mt-2">
                2D accessible map — same canonical graph as the 3D scene; press Tab to walk components with the keyboard.
              </p>
            </div>
          ) : (
            <div ref={containerRef} className="absolute inset-0" data-testid="atlas-3d-canvas" aria-label="3D architecture canvas" />
          )}

          {/* status strip */}
          <div className="absolute left-2 bottom-2 right-2 flex items-center gap-2 pointer-events-none">
            <span className="rounded bg-slate-900/90 border border-slate-700 px-2 py-1 text-[10px] text-slate-300 max-w-[60%] truncate">
              {layer.summary}{hoverInfo ? ` · hovering: ${hoverInfo}` : ""}
            </span>
            {!is2D && (
              <span className="ml-auto rounded bg-slate-900/90 border border-slate-700 px-2 py-1 text-[10px] text-slate-400">
                {diagnostics.webgl ? `WebGL · ${diagnostics.drawCalls} calls · ${diagnostics.triangles.toLocaleString()} tris` : "WebGL unavailable — switch to 2D"}
              </span>
            )}
          </div>

          {/* ——— Synchronized 2D minimap (Task 23) ——— */}
          {panels.minimap && (
            <div className="absolute right-2 top-2 rounded-lg border border-slate-700 bg-slate-900/90 p-1.5 z-10"
              aria-label="Minimap — synchronized overview of the architecture">
              <svg width={148} height={104} role="img"
                aria-label={`Minimap: ${graph.nodes.length} components — click a dot to focus it`}>
                {(() => {
                  const b = bounds;
                  const sx = (x: number): number => 6 + ((x - b.minX) / (b.maxX - b.minX)) * 136;
                  const sz = (z: number): number => 6 + ((z - b.minZ) / (b.maxZ - b.minZ)) * 92;
                  return (
                    <>
                      {graph.edges.map((e) => {
                        const a = layout.positions[e.from]; const c = layout.positions[e.to];
                        if (!a || !c) return null;
                        return <line key={e.id} x1={sx(a.x)} y1={sz(a.z)} x2={sx(c.x)} y2={sz(c.z)} stroke="#334155" strokeWidth={0.8} />;
                      })}
                      {graph.nodes.map((n) => {
                        const pos = layout.positions[n.id];
                        if (!pos) return null;
                        const sel = selection?.id === n.id;
                        return (
                          <circle key={n.id} cx={sx(pos.x)} cy={sz(pos.z)} r={sel ? 4 : 2.6}
                            fill={sel ? "#22d3ee" : layer.nodes[n.id]?.emphasis === "critical" ? "#f43f5e" : "#64748b"}
                            stroke={sel ? "#a5f3fc" : "none"} strokeWidth={sel ? 1 : 0}
                            className="cursor-pointer" role="button" aria-label={`Focus ${n.label}`}
                            onClick={() => { setSelection({ id: n.id, kind: "node" }); sceneRef.current?.focusNode(n.id); }} />
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
              <div className="text-[9px] text-slate-500 text-center mt-0.5">minimap · click to focus</div>
            </div>
          )}

          {/* connect-target picker */}
          {connectFrom && (
            <div className="absolute top-2 left-2 right-2 rounded-lg border border-sky-500/50 bg-slate-900/95 p-2 flex items-center gap-2 flex-wrap z-10">
              <span className="text-xs text-sky-200 font-semibold">Connect from <strong>{connectFrom}</strong> to…</span>
              <AButton onClick={() => setConnectFrom(null)}>Cancel</AButton>
              <div className="flex gap-1 flex-wrap">
                {graph.nodes.filter((n) => n.id !== connectFrom).slice(0, 12).map((n) => (
                  <AButton key={n.id} onClick={() => connect(connectFrom, n.id)}>{n.label}</AButton>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ——— Bottom operational dock ——— */}
        {panels.dock && (
          <div aria-label="Operational dock" className="shrink-0 border-t border-slate-800/80 bg-slate-900/60 flex flex-col" style={{ height: panels.dockHeight }}>
            <div role="tablist" aria-label="Dock sections" className="flex items-center gap-1 px-2 border-b border-slate-800/80">
              {dockTabs.map((t) => (
                <button key={t.id} role="tab" aria-selected={dockTab === t.id}
                  onClick={() => setDockTab(t.id)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold border-b-2 -mb-px ${
                    dockTab === t.id ? "border-sky-400 text-sky-200" : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}>{t.label}</button>
              ))}
              <AButton className="ml-auto" aria-label="Collapse dock" onClick={() => onPanels((p) => ({ ...p, dock: false }))}><ChevronsDown size={11} aria-hidden /></AButton>
            </div>
            <div className="flex-1 overflow-y-auto p-2 text-[11px] text-slate-300">
              {dockTab === "events" && (
                <ul className="space-y-1">
                  {events.map((e, i) => <li key={i}><span className="text-slate-500">[{e.kind}]</span> {e.text}</li>)}
                </ul>
              )}
              {dockTab === "scenario" && (scenario ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-200">{scenario.summary}</p>
                    <span className="text-[10px] font-mono text-sky-300">t = {simStep ?? maxStep} ms</span>
                  </div>
                  {maxStep > 0 && (
                    <div className="p-2 bg-slate-800/60 rounded border border-slate-700/60 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Simulation Time Scrubber:</span>
                        <span>{activeEvents.length} / {scenario.recording.events.length} events processed</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={maxStep}
                        value={simStep ?? maxStep}
                        onChange={(e) => setSimStep(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                        aria-label="Simulation step scrubber"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                        <span>0 ms (start)</span>
                        <span>{Math.round(maxStep / 2)} ms</span>
                        <span>{maxStep} ms (peak)</span>
                      </div>
                    </div>
                  )}
                  {activeFailed.length > 0 && (
                    <div className="text-[11px] text-rose-300 bg-rose-950/30 border border-rose-900/40 rounded px-2 py-1">
                      Active failures at t={simStep ?? maxStep}ms: {activeFailed.join(", ")}
                    </div>
                  )}
                  {scenario.results.map((r) => (
                    <p key={r.expectationId}>
                      <span className={r.outcome === "pass" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>[{r.outcome}]</span> {r.expectationId}: {r.detail}
                    </p>
                  ))}
                  <AButton onClick={() => onNavigate("experiments")}>Open the Experiments console for full scenario control</AButton>
                </div>
              ) : <p className="text-slate-500">No scenario run yet — press “Run scenario”.</p>)}
              {dockTab === "findings" && (
                <ul className="space-y-1">
                  {findings.length === 0 && <li className="text-slate-500">No critic findings — the model satisfies every rule.</li>}
                  {findings.map((f) => (
                    <li key={f.id}>
                      <ABadge status={f.severity === "critical" ? "bad" : f.severity === "warning" ? "warn" : "info"} label={f.severity} /> {f.title}
                      <span className="text-slate-500"> — {f.detail.slice(0, 120)}…</span>
                    </li>
                  ))}
                </ul>
              )}
              {dockTab === "legend" && (
                <ul className="space-y-1">
                  {layer.legend.map((l, i) => (
                    <li key={i}><span className="font-semibold text-slate-200">{l.label}</span> — {l.description}</li>
                  ))}
                  <li className="text-slate-500">Mode: {ALL_MAP_MODES.find((m) => m.mode === mode)?.purpose}</li>
                </ul>
              )}
            </div>
          </div>
        )}
        {!panels.dock && (
          <button aria-label="Expand dock" onClick={() => onPanels((p) => ({ ...p, dock: true }))}
            className="h-7 shrink-0 border-t border-slate-800/80 bg-slate-900/60 text-[10px] text-slate-400 hover:text-slate-200">
            <ChevronsUp size={11} aria-hidden className="inline mr-1" /> Show operational dock
          </button>
        )}
      </div>

      {/* ——— Right: inspector ——— */}
      {panels.inspector && (
        <aside aria-label="Inspector" className="shrink-0 border-l border-slate-800/80 bg-slate-900/50 overflow-y-auto"
          style={{ width: panels.inspectorWidth }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 sticky top-0 bg-slate-900/95">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Inspector</h3>
            <AButton aria-label="Collapse inspector" onClick={() => onPanels((p) => ({ ...p, inspector: false }))}><ChevronRight size={11} aria-hidden /></AButton>
          </div>
          {!selection && (
            <div className="p-3 space-y-2 text-[11px] text-slate-400">
              <p>Select a component or connection — in the canvas, the navigator, or the 2D map.</p>
              <ABadge status="info" label={`${graph.nodes.length} components`} /> <ABadge status="info" label={`${graph.edges.length} connections`} />
              {graph.unresolved.length > 0 && <ABadge status="warn" label={`${graph.unresolved.length} unresolved`} />}
            </div>
          )}
          {selectedComponent && (
            <div className="p-3 space-y-3 text-xs">
              <div>
                <div className="text-sm font-bold text-slate-100">{selectedComponent.name}</div>
                <div className="text-[10px] text-slate-500">{KIND_LABEL[selectedComponent.kind]} · {selectedComponent.id}</div>
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Name (edit + save)</span>
                <AInput defaultValue={selectedComponent.name}
                  onBlur={(e) => { if (e.target.value !== selectedComponent.name) renameSelected(e.target.value); }}
                  aria-label="Component name" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Assigned Zone</span>
                <ASelect
                  value={selectedComponent.zoneId ?? ""}
                  onChange={(e) => {
                    const z = e.target.value || undefined;
                    applyEdit({
                      ...model,
                      components: model.components.map((c) => (c.id === selectedComponent.id ? { ...c, zoneId: z } : c)),
                    }, `Assigned ${selectedComponent.name} to ${z ? (model.zones.find((x) => x.id === z)?.name ?? z) : "unzoned"}.`);
                  }}
                  aria-label="Component trust zone">
                  <option value="">(No zone assigned)</option>
                  {model.zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </ASelect>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Domain / Logical Tag</span>
                <AInput
                  defaultValue={String(selectedComponent.config.group ?? "")}
                  placeholder="e.g. Ingestion, Core, Storage"
                  onBlur={(e) => setConfig("group", e.target.value.trim())}
                  aria-label="Component logical tag"
                />
              </label>
              <InspectorSection title="Properties" defaultOpen>
                {Object.entries(selectedComponent.config).length === 0 && <Empty />}
                {Object.entries(selectedComponent.config).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-400 w-24 truncate">{k}</span>
                    <AInput defaultValue={String(v)} aria-label={`${k} value`}
                      onBlur={(e) => { if (e.target.value !== String(v)) setConfig(k, e.target.value); }} />
                  </label>
                ))}
              </InspectorSection>
              <InspectorSection title="Dependencies">
                <p className="text-slate-400">In: {model.connections.filter((c) => c.to === selectedComponent.id).map((c) => c.from).join(", ") || "none"}</p>
                <p className="text-slate-400">Out: {model.connections.filter((c) => c.from === selectedComponent.id).map((c) => c.to).join(", ") || "none"}</p>
                {model.connections.some((c) => c.to === selectedComponent.id || c.from === selectedComponent.id) && (
                  <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-slate-800">
                    {model.connections.filter((c) => c.to === selectedComponent.id).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelection({ id: c.id, kind: "edge" })}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] border border-slate-700"
                        title={`Inspect connection ${c.id}`}>
                        🔗 {c.from}
                      </button>
                    ))}
                    {model.connections.filter((c) => c.from === selectedComponent.id).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelection({ id: c.id, kind: "edge" })}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] border border-slate-700"
                        title={`Inspect connection ${c.id}`}>
                        🔗 {c.to}
                      </button>
                    ))}
                  </div>
                )}
                {layer.focusPaths.length > 0 && (
                  <p className="mt-1 text-slate-400 text-[10px]">Traced paths: {layer.focusPaths.slice(0, 3).map((p) => p.join(" → ")).join(" | ")}</p>
                )}
              </InspectorSection>
              <InspectorSection title="Data">
                {model.dataEntities.filter((d) => d.ownerComponentId === selectedComponent.id).map((d) => (
                  <p key={d.id} className="text-slate-400">Owns <strong>{d.name}</strong></p>
                ))}
                <p className="text-slate-500">Access: {model.connections.filter((c) => c.from === selectedComponent.id && c.access).map((c) => `${c.to} (${c.access})`).join(", ") || "none declared"}</p>
              </InspectorSection>
              <InspectorSection title="Trust">
                <p className="text-slate-400">Zone: {model.zones.find((z) => z.id === selectedComponent.zoneId)?.name ?? "unzoned"}</p>
                <p className="text-slate-400">Cross-boundary: {model.connections.filter((c) => (c.from === selectedComponent.id || c.to === selectedComponent.id)).filter((c) => {
                  const other = c.from === selectedComponent.id ? c.to : c.from;
                  return model.components.find((x) => x.id === other)?.zoneId !== selectedComponent.zoneId;
                }).map((c) => c.id).join(", ") || "none"}</p>
              </InspectorSection>
              <InspectorSection title="Evidence">
                {findings.filter((f) => f.evidence.some((e) => e.ref === `component:${selectedComponent.id}`)).map((f) => (
                  <p key={f.id} className="text-slate-400"><ABadge status={f.severity === "critical" ? "bad" : "warn"} label={f.severity} /> {f.title}</p>
                ))}
                {findings.filter((f) => f.evidence.some((e) => e.ref === `component:${selectedComponent.id}`)).length === 0 && <p className="text-slate-500">No findings reference this component.</p>}
                <AButton className="mt-1" onClick={() => onNavigate("validation")}>Open Validation Room</AButton>
              </InspectorSection>
              <div className="flex gap-1 pt-2 border-t border-slate-800">
                <AButton variant="danger" onClick={() => setConfirmDelete(true)}>
                  <span className="inline-flex items-center gap-1"><Trash2 size={11} aria-hidden /> Delete</span>
                </AButton>
                <AButton onClick={() => sceneRef.current?.focusNode(selectedComponent.id)}>
                  <span className="inline-flex items-center gap-1"><Crosshair size={11} aria-hidden /> Locate</span>
                </AButton>
              </div>
            </div>
          )}
          {selectedConnection && (
            <div className="p-3 space-y-3 text-xs">
              <div>
                <div className="text-sm font-bold text-slate-100">Connection</div>
                <div className="text-[10px] text-slate-500">{selectedConnection.from} → {selectedConnection.to}</div>
              </div>
              <div className="flex gap-1">
                <AButton className="text-[10px] py-0.5" onClick={() => sceneRef.current?.focusNode(selectedConnection.from)}>
                  From: {selectedConnection.from}
                </AButton>
                <AButton className="text-[10px] py-0.5" onClick={() => sceneRef.current?.focusNode(selectedConnection.to)}>
                  To: {selectedConnection.to}
                </AButton>
              </div>
              <InspectorSection title="Properties" defaultOpen>
                <label className="block space-y-1 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Interaction Kind</span>
                  <ASelect
                    value={selectedConnection.kind}
                    onChange={(e) => updateSelectedConnection({ kind: e.target.value as "sync" | "async" | "event" })}
                    aria-label="Connection kind">
                    <option value="sync">Sync (RPC / HTTP)</option>
                    <option value="async">Async (Worker / Message)</option>
                    <option value="event">Event (Publish / Subscribe)</option>
                  </ASelect>
                </label>
                <label className="block space-y-1 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Criticality (1-5)</span>
                  <ASelect
                    value={String(selectedConnection.criticality)}
                    onChange={(e) => updateSelectedConnection({ criticality: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 })}
                    aria-label="Connection criticality">
                    <option value="1">1 — Trivial / Optional</option>
                    <option value="2">2 — Low Impact</option>
                    <option value="3">3 — Moderate</option>
                    <option value="4">4 — Critical Path</option>
                    <option value="5">5 — Essential (Blocks)</option>
                  </ASelect>
                </label>
                <label className="block space-y-1 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Failure Behavior</span>
                  <ASelect
                    value={selectedConnection.failureBehavior}
                    onChange={(e) => updateSelectedConnection({ failureBehavior: e.target.value as "blocks" | "degrades" | "isolated" })}
                    aria-label="Failure behavior">
                    <option value="blocks">Blocks (fails upstream caller)</option>
                    <option value="degrades">Degrades (graceful degradation)</option>
                    <option value="isolated">Isolated (failure is contained)</option>
                  </ASelect>
                </label>
                <label className="block space-y-1 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Latency SLA (ms)</span>
                  <AInput
                    type="number"
                    defaultValue={String(selectedConnection.latencyMs ?? "")}
                    placeholder="e.g. 25"
                    onBlur={(e) => updateSelectedConnection({ latencyMs: e.target.value ? Number(e.target.value) : undefined })}
                    aria-label="Latency SLA ms"
                  />
                </label>
                <p className="text-slate-400 text-[10px]">Controls: {selectedConnection.controls?.join(", ") || "none declared"}</p>
              </InspectorSection>
              <InspectorSection title="Operations">
                <p className="text-slate-400">{selectedConnection.operationIds.join(", ") || "not mapped to an operation"}</p>
              </InspectorSection>
              <AButton variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={11} aria-hidden /> Delete connection</AButton>
            </div>
          )}
        </aside>
      )}
      {!panels.inspector && (
        <button aria-label="Expand inspector" onClick={() => onPanels((p) => ({ ...p, inspector: true }))}
          className="w-7 shrink-0 border-l border-slate-800/80 bg-slate-900/60 text-slate-400 hover:text-slate-200 text-[10px]">
          <ChevronLeft size={11} aria-hidden />
        </button>
      )}

      {/* dialogs */}
      {addOpen && (
        <ADialog title="Add component" onClose={() => setAddOpen(false)}>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Type</span>
              <ASelect value={addKind} onChange={(e) => setAddKind(e.target.value)} aria-label="Component type">
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </ASelect>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Name</span>
              <AInput value={addName} onChange={(e) => setAddName(e.target.value)} aria-label="Component name" placeholder="e.g. Notification service" />
            </label>
            <p className="text-[11px] text-slate-400">The component is validated against the canonical schema and appears in the navigator and the 3D scene immediately.</p>
            <div className="flex justify-end gap-2">
              <AButton onClick={() => setAddOpen(false)}>Cancel</AButton>
              <AButton variant="primary" disabled={!addName.trim()} onClick={addComponent}>Add component</AButton>
            </div>
          </div>
        </ADialog>
      )}
      {confirmDelete && (
        <ADialog title="Delete selected object?" onClose={() => setConfirmDelete(false)}>
          <p className="text-xs text-slate-300 mb-3">
            This removes <strong>{selection?.id}</strong> from the canonical model{selection?.kind === "node" ? " and all of its connections" : ""}.
            The edit is undoable (Undo button) until the workspace is reloaded.
          </p>
          <div className="flex justify-end gap-2">
            <AButton onClick={() => setConfirmDelete(false)}>Cancel</AButton>
            <AButton variant="danger" onClick={deleteSelected}>Delete</AButton>
          </div>
        </ADialog>
      )}
      {compareOpen && (
        <ADialog title="Snapshot comparison" onClose={() => setCompareOpen(false)}>
          <p className="text-[11px] text-slate-400 mb-2">Semantic diff of the snapshot against the current model (layout changes never appear here).</p>
          {diff.length === 0 ? (
            <p className="text-xs text-emerald-300">No architecture changes since the snapshot.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto text-xs space-y-1">
              {diff.map((d, i) => (
                <li key={i}>
                  <ABadge status={d.type === "added" ? "ok" : d.type === "removed" ? "bad" : "warn"} label={d.type} /> {d.target}:{d.id} — {d.detail}
                </li>
              ))}
            </ul>
          )}
        </ADialog>
      )}
    </div>
  );
};

const InspectorSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => (
  <details open={defaultOpen} className="rounded-md border border-slate-700/60 bg-slate-900/60">
    <summary className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer">{title}</summary>
    <div className="px-2 pb-2">{children}</div>
  </details>
);

const MaximizeIcon: React.FC = () => <Boxes size={12} aria-hidden />;

const Empty: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <p className="text-slate-500 text-[11px]">No declared config properties.{children}</p>
);
