/**
 * Multi-Agent Workflow Studio — Canvas / Board / Audit Trail / Infrastructure
 * Map, all driven by ONE persisted workflow model and its persisted run
 * records. Every visible state is derived from the run store; the UI never
 * invents execution states. Canvas animation runs only along edges whose
 * source completed in the CURRENT wave (real events, not decoration).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Columns3, ScrollText, Network, Play, Pause, Square, RotateCcw, Trash2,
  ChevronRight, CheckCircle2, XCircle, Clock, HelpCircle, X as XIcon, Search,
} from "lucide-react";
import { ABadge, AButton, APanel, ASelect, AAnnouncer, STATUS_CLS } from "../atlas/ui";
import { WORKFLOWS, workflowById } from "./workflows";
import { datasetFor } from "./datasets";
import { agentById } from "./catalog";
import { createRun, stepRun, resolveApproval, pauseRun, resumeRun, cancelRun, replayRun } from "./engine";
import { createRunStore, type RunStore } from "./store";
import { layoutNodes, canvasBounds, type NodePos } from "./layout";
import { probeInfrastructure, type InfraComponent } from "./infra";
import type {
  ExecutionMode, RunState, TaskRecord, WfEdge, WfNode, WorkflowDef,
} from "./types";

const TENANT = "demo-tenant";
const TABS = ["canvas", "board", "audit", "infra"] as const;
type Tab = (typeof TABS)[number];

const MODES: Array<{ id: ExecutionMode; label: string }> = [
  { id: "simulation", label: "Simulation (synthetic adapters)" },
  { id: "investigation", label: "Investigation only (no external actions)" },
  { id: "supervised", label: "Supervised (human gates on sensitive agents)" },
  { id: "red-team", label: "Red-team (adversarial payload defense)" },
];

const BOARD_COLUMNS: Array<{ id: TaskRecord["status"]; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "queued", label: "Queued" },
  { id: "running", label: "Running" },
  { id: "waiting-human", label: "Waiting for Human Approval" },
  { id: "recovering", label: "Recovering" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "blocked", label: "Blocked" },
  { id: "skipped", label: "Skipped (branch)" },
];

const NODE_KIND_STYLE: Record<string, { fill: string; stroke: string; icon: string }> = {
  data: { fill: "#0f172a", stroke: "#38bdf8", icon: "▦" },
  agent: { fill: "#111827", stroke: "#a78bfa", icon: "◆" },
  condition: { fill: "#1a1625", stroke: "#c084fc", icon: "◇" },
  approval: { fill: "#231a10", stroke: "#f59e0b", icon: "✓?" },
  output: { fill: "#0f1f16", stroke: "#34d399", icon: "★" },
};

const STATUS_DOT: Record<string, string> = {
  completed: "#34d399", running: "#38bdf8", queued: "#818cf8",
  waiting_human: "#f59e0b", recovering: "#fbbf24", failed: "#f87171",
  blocked: "#f87171", pending: "#64748b", skipped: "#475569",
};

export const AgentStudioView: React.FC = () => {
  const store: RunStore = useMemo(() => createRunStore(window.localStorage), []);
  const [runs, setRuns] = useState<RunState[]>(() => store.list(TENANT));
  const [activeRunId, setActiveRunId] = useState<string | null>(() => store.list(TENANT)[0]?.id ?? null);
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOWS[0].id);
  const [mode, setMode] = useState<ExecutionMode>("simulation");
  const [tab, setTab] = useState<Tab>("canvas");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<WfEdge | null>(null);
  const [announcer, setAnnouncer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infra, setInfra] = useState<InfraComponent[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, NodePos>>({});
  const [view, setView] = useState({ x: 40, y: 20, z: 0.72 });
  const dragRef = useRef<{ kind: "pan" | "node" | null; id?: string; sx: number; sy: number; ox: number; oy: number }>({ kind: null, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [search, setSearch] = useState("");

  const run = runs.find((r) => r.id === activeRunId) ?? null;
  const def: WorkflowDef = run?.defSnapshot ?? workflowById(workflowId) ?? WORKFLOWS[0];
  const dataset = datasetFor(def.id);
  // deterministic layout recomputation is cheap (~16 nodes) — no memo needed
  const positions = layoutNodes(def, overrides);

  const persist = useCallback((r: RunState): void => {
    store.save(r);
    setRuns((prev) => {
      const i = prev.findIndex((x) => x.id === r.id);
      const next = i >= 0 ? prev.map((x) => (x.id === r.id ? r : x)) : [r, ...prev];
      return next;
    });
  }, [store]);

  // execution loop: step the active run while it is running
  useEffect(() => {
    if (!run || run.status !== "running") return;
    const timer = window.setInterval(() => {
      setRuns((prev) => {
        const current = prev.find((r) => r.id === activeRunId);
        if (!current || current.status !== "running") return prev;
        const stepped = stepRun({ ...current, tasks: [...current.tasks], artifacts: [...current.artifacts], evidence: [...current.evidence], findings: [...current.findings], handoffs: [...current.handoffs], approvals: [...current.approvals], externalActions: [...current.externalActions], events: [...current.events] }, datasetFor(current.workflowId));
        store.save(stepped);
        return prev.map((r) => (r.id === stepped.id ? stepped : r));
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [run?.status, activeRunId, store]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "infra") probeInfrastructure().then(setInfra);
  }, [tab]);

  const startRun = (): void => {
    setError(null);
    const d = workflowById(workflowId)!;
    const runId = `run-${d.id}-${Date.now().toString(36)}`;
    const created = createRun(d, datasetFor(d.id), { tenantId: TENANT, mode, runId });
    if (!created.run) { setError(created.error ?? "run could not be created"); setAnnouncer(`Run refused: ${created.error}`); return; }
    persist(created.run);
    setActiveRunId(runId);
    setSelectedNode(null);
    setSelectedEdge(null);
    setOverrides({});
    setTab("canvas");
    setAnnouncer(`Workflow "${d.name}" started in ${mode} mode. ${d.nodes.filter((n) => n.kind === "agent").length} agents collaborating.`);
  };

  const onApprove = (decision: "approved" | "rejected"): void => {
    if (!run) return;
    const pending = run.approvals.find((a) => a.status === "requested");
    if (!pending) return;
    const r = resolveApproval({ ...run, approvals: run.approvals.map((a) => ({ ...a })), tasks: [...run.tasks], artifacts: [...run.artifacts], events: [...run.events] }, pending.id, decision, decision === "approved" ? "authorized by operator" : "rejected by operator");
    persist(r);
    setAnnouncer(`Human decision recorded: ${decision}. Execution ${decision === "approved" ? "resumed" : "recorded rejection"}.`);
  };

  const taskOf = (nodeId: string): TaskRecord | undefined => run?.tasks.find((t) => t.nodeId === nodeId);

  const selectNode = (nodeId: string): void => {
    setSelectedNode(nodeId);
    setSelectedEdge(null);
    if (tab === "board" || tab === "audit" || tab === "infra") setTab("canvas");
  };

  const countsFor = (nodeId: string): { done: number; running: number } => {
    if (!run) return { done: 0, running: 0 };
    const t = taskOf(nodeId);
    if (!t) return { done: 0, running: 0 };
    return {
      done: (t.status === "completed" || t.status === "skipped") ? 1 : 0,
      running: t.status === "running" ? 1 : 0,
    };
  };

  // ——— canvas helpers ———
  const onWheel = (e: React.WheelEvent): void => {
    setView((v) => ({ ...v, z: Math.min(1.6, Math.max(0.25, v.z * (e.deltaY > 0 ? 0.92 : 1.08))) }));
  };
  const startPan = (e: React.MouseEvent, kind: "pan" | "node", id?: string): void => {
    dragRef.current = kind === "pan"
      ? { kind, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }
      : { kind, id, sx: e.clientX, sy: e.clientY, ox: positions[id!].x, oy: positions[id!].y };
  };
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const d = dragRef.current;
      if (d.kind === "pan") setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
      if (d.kind === "node" && d.id) {
        const dx = (e.clientX - d.sx) / view.z;
        const dy = (e.clientY - d.sy) / view.z;
        setOverrides((o) => ({ ...o, [d.id!]: { x: d.ox + dx, y: d.oy + dy } }));
      }
    };
    const onUp = (): void => { dragRef.current = { kind: null, sx: 0, sy: 0, ox: 0, oy: 0 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [view.z]);

  const bounds = canvasBounds(positions);
  const fitToView = (): void => {
    const el = document.getElementById("agent-canvas-wrap");
    if (!el) return;
    const z = Math.min((el.clientWidth - 80) / bounds.w, (el.clientHeight - 80) / bounds.h, 1.2);
    setView({ x: 40, y: 30, z: Number(z.toFixed(2)) });
  };

  const pendingApproval = run?.approvals.find((a) => a.status === "requested") ?? null;

  const filteredNodes = def.nodes.filter((n) =>
    !search || n.label.toLowerCase().includes(search.toLowerCase()) || (n.agentId ?? "").includes(search.toLowerCase()));

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100" data-testid="agent-studio">
      <AAnnouncer message={announcer} />
      {/* ——— Studio toolbar ——— */}
      <header aria-label="Workflow studio toolbar" className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 bg-slate-900/60 px-4 py-2">
        <label htmlFor="wf-select" className="sr-only">Workflow</label>
        <ASelect id="wf-select" value={workflowId} onChange={(e) => { setWorkflowId(e.target.value); }} className="max-w-72">
          {WORKFLOWS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </ASelect>
        <nav aria-label="Studio views" className="flex items-center rounded-md border border-slate-700 bg-slate-800/60">
          {([["canvas", <Network size={13} key="c" />], ["board", <Columns3 size={13} key="b" />], ["audit", <ScrollText size={13} key="a" />], ["infra", <Bot size={13} key="i" />]] as Array<[Tab, React.ReactNode]>).map(([t, icon]) => (
            <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? "true" : undefined}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold ${tab === t ? "bg-sky-500/20 text-sky-200" : "text-slate-400 hover:text-slate-200"}`}>
              {icon} {t === "infra" ? "Infrastructure" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <label htmlFor="wf-mode" className="sr-only">Execution mode</label>
        <ASelect id="wf-mode" value={mode} onChange={(e) => setMode(e.target.value as ExecutionMode)} className="max-w-64">
          {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </ASelect>
        {!run || run.status === "completed" || run.status === "failed" || run.status === "cancelled" ? (
          <AButton variant="primary" onClick={startRun}><span className="inline-flex items-center gap-1"><Play size={12} aria-hidden /> Run Workflow</span></AButton>
        ) : (
          <>
            {run.status === "running" && <AButton onClick={() => persist(pauseRun({ ...run }))}><Pause size={12} aria-hidden /> Pause</AButton>}
            {run.status === "paused" && <AButton onClick={() => persist(resumeRun({ ...run }))}><Play size={12} aria-hidden /> Resume</AButton>}
            <AButton variant="danger" onClick={() => { persist(cancelRun({ ...run })); setAnnouncer("Workflow cancelled — tasks terminated safely."); }}>
              <Square size={12} aria-hidden /> Stop
            </AButton>
          </>
        )}
        {run && (
          <ABadge status={run.status === "completed" ? "ok" : run.status === "failed" || run.status === "cancelled" ? "bad" : run.status === "paused-approval" || run.status === "paused" ? "warn" : "info"}
            label={run.status} title={`Run ${run.id} · ${run.mode}`} />
        )}
        <span className="ml-auto flex items-center gap-2">
          {run && <span className="text-[10px] text-slate-400">case {run.caseLabel} · wave {run.wave} · {run.tasks.filter((t) => t.status === "completed").length}/{run.tasks.length} tasks</span>}
          <AButton aria-label="Replay latest run in read-only mode" onClick={() => {
            if (!run) return;
            const copy = replayRun({ ...run, id: `${run.id}-replay` });
            persist(copy);
            setActiveRunId(copy.id);
            setAnnouncer("Replay opened in read-only mode — the original run is unchanged.");
          }}><RotateCcw size={12} aria-hidden /> Replay</AButton>
          <AButton variant="danger" aria-label="Reset demo: delete all persisted runs in the demo workspace" onClick={() => {
            store.clear(TENANT);
            setRuns([]);
            setActiveRunId(null);
            setAnnouncer("Demo reset: all runs in the synthetic demo workspace deleted.");
          }}><Trash2 size={12} aria-hidden /> Reset demo</AButton>
        </span>
      </header>

      {error && (
        <p role="alert" className="border-b border-rose-500/40 bg-rose-500/10 px-4 py-1.5 text-xs text-rose-200">{error}</p>
      )}

      {/* ——— main area: canvas/board/audit/infra + inspector ——— */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {tab === "canvas" && (
            <div id="agent-canvas-wrap" className="relative h-full overflow-hidden bg-slate-950"
              onWheel={onWheel} onMouseDown={(e) => { if (e.button === 0) startPan(e, "pan"); }}>
              <svg role="img" aria-label={`Workflow canvas: ${def.name} — ${def.nodes.length} nodes, ${def.edges.length} connections. Use the object list below for a nonvisual equivalent.`}
                className="h-full w-full">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                  </marker>
                  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
                  {/* edges */}
                  {def.edges.map((e) => {
                    const from = positions[e.from];
                    const to = positions[e.to];
                    if (!from || !to) return null;
                    const state = run?.edgeStates[e.id] ?? "pending";
                    const sourceRunning = run?.tasks.find((t) => t.nodeId === e.from)?.status === "running";
                    const stroke = state === "inactive" ? "#334155" : sourceRunning ? "#38bdf8" : state === "delivered" ? "#475569" : "#334155";
                    const dashed = state === "inactive" || e.kind === "branch";
                    return (
                      <g key={e.id} onClick={(ev) => { ev.stopPropagation(); setSelectedEdge(e); setSelectedNode(null); }} style={{ cursor: "pointer" }}>
                        <path d={`M ${from.x + 150} ${from.y + 24} C ${from.x + 200} ${from.y + 24}, ${to.x - 50} ${to.y + 24}, ${to.x} ${to.y + 24}`}
                          fill="none" stroke={stroke} strokeWidth={sourceRunning ? 2.2 : 1.4}
                          strokeDasharray={dashed ? "6 4" : undefined}
                          markerEnd="url(#arrow)" className={sourceRunning ? "wf-flow-edge" : undefined} />
                        {e.label && (
                          <text x={(from.x + to.x) / 2 + 40} y={(from.y + to.y) / 2 + 14} fontSize="10" fill="#94a3b8" textAnchor="middle">{e.label}</text>
                        )}
                      </g>
                    );
                  })}
                  {/* nodes */}
                  {filteredNodes.map((n) => {
                    const p = positions[n.id];
                    if (!p) return null;
                    const t = taskOf(n.id);
                    const status = t?.status ?? "pending";
                    const style = NODE_KIND_STYLE[n.kind] ?? NODE_KIND_STYLE.agent;
                    const c = countsFor(n.id);
                    const isSelected = selectedNode === n.id;
                    const agent = n.agentId ? agentById(n.agentId) : undefined;
                    const hasFinding = run?.findings.some((f) => f.nodeId === n.id);
                    return (
                      <g key={n.id} transform={`translate(${p.x} ${p.y})`}
                        onMouseDown={(ev) => { ev.stopPropagation(); startPan(ev, "node", n.id); }}
                        onClick={(ev) => { ev.stopPropagation(); selectNode(n.id); }}
                        style={{ cursor: "pointer" }}
                        tabIndex={0} role="button"
                        aria-label={`${n.label}, ${n.kind}, status ${status}${c.done ? `, ${c.done} done` : ""}`}
                        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selectNode(n.id); } }}>
                        <rect width="150" height="48" rx="8" fill={style.fill} stroke={isSelected ? "#38bdf8" : style.stroke} strokeWidth={isSelected ? 2.5 : 1.4} />
                        <circle cx="14" cy="14" r="4" fill={STATUS_DOT[status] ?? "#64748b"} />
                        <text x="26" y="18" fontSize="11" fontWeight="700" fill="#e2e8f0">{n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label}</text>
                        <text x="26" y="32" fontSize="9" fill="#94a3b8">{agent ? agent.role : n.kind}</text>
                        <text x="128" y="41" fontSize="9" fill={c.done ? "#34d399" : c.running ? "#38bdfb" : "#64748b"}>
                          {c.done ? "✓ done" : c.running ? "▶ running" : status === "waiting-human" ? "✓?" : ""}
                        </text>
                        {n.sensitive && <text x="6" y="42" fontSize="9" fill="#f59e0b">⚑<title>sensitive — human approval required</title></text>}
                        {hasFinding && <circle cx="144" cy="8" r="3" fill="#f87171"><title>finding recorded</title></circle>}
                      </g>
                    );
                  })}
                </g>
              </svg>
              {/* minimap */}
              <svg aria-hidden className="absolute bottom-3 right-3 rounded border border-slate-700 bg-slate-900/90" width="150" height="96">
                <rect width="150" height="96" fill="#0f172a" />
                {def.nodes.map((n) => {
                  const p = positions[n.id];
                  if (!p) return null;
                  return <rect key={n.id} x={4 + (p.x / Math.max(bounds.w, 1)) * 138} y={4 + (p.y / Math.max(bounds.h, 1)) * 84}
                    width="5" height="5" rx="1" fill={STATUS_DOT[taskOf(n.id)?.status ?? "pending"] ?? "#64748b"} />;
                })}
              </svg>
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/80 p-1.5">
                <AButton aria-label="Zoom out" onClick={() => setView((v) => ({ ...v, z: Math.max(0.25, v.z * 0.9) }))}>−</AButton>
                <AButton aria-label="Zoom in" onClick={() => setView((v) => ({ ...v, z: Math.min(1.6, v.z * 1.1) }))}>+</AButton>
                <AButton onClick={fitToView}>Fit</AButton>
                <label className="sr-only" htmlFor="wf-search">Search nodes</label>
                <span className="relative">
                  <Search size={11} className="absolute left-1.5 top-1.5 text-slate-500" aria-hidden />
                  <input id="wf-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agents…"
                    className="w-40 rounded border border-slate-600 bg-slate-800/80 py-1 pl-6 pr-2 text-[11px] text-slate-100" />
                </span>
              </div>
              {!run && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="max-w-md rounded-lg border border-slate-700 bg-slate-900/90 p-4 text-center text-xs text-slate-300">
                    <strong>{def.name}</strong> — {def.description}<br />
                    <span className="text-slate-400">{def.nodes.filter((n) => n.kind === "agent").length} agents · {def.edges.length} connections · dataset: {dataset.label}</span><br />
                    Press <strong>Run Workflow</strong> to start a real execution — every agent on this canvas performs actual work.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "board" && (
            <div className="h-full overflow-auto p-3" role="region" aria-label="Task board">
              {!run && <p className="p-6 text-center text-xs text-slate-400">No active run. Start a workflow to populate the board with real agent tasks.</p>}
              {run && (
                <div className="grid grid-cols-3 gap-2 xl:grid-cols-5">
                  {BOARD_COLUMNS.map((col) => {
                    const tasks = run.tasks.filter((t) => t.status === col.id);
                    return (
                      <section key={col.id} aria-label={`${col.label} column`} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2">
                        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          {col.label} <span className="text-slate-500">({tasks.length})</span>
                        </h3>
                        <div className="space-y-1.5">
                          {tasks.map((t) => (
                            <button key={t.id} onClick={() => selectNode(t.nodeId)}
                              className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-left hover:border-sky-500/60">
                              <div className="text-[11px] font-semibold text-slate-100">{t.label}</div>
                              <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-400">
                                <span title="execution status">{t.status}</span>
                                {t.wave !== undefined && <span>· wave {t.wave}</span>}
                                {t.endTick !== undefined && <span>· ticks {t.endTick - (t.startedTick ?? 0)}</span>}
                              </div>
                              {t.latestOutput && <div className="mt-1 line-clamp-2 text-[9px] text-slate-400">{t.latestOutput}</div>}
                              {t.error && <div className="mt-1 text-[9px] text-rose-300">{t.error}</div>}
                              {t.nextAction && <div className="mt-1 text-[9px] text-amber-300">next: {t.nextAction}</div>}
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "audit" && (
            <div className="h-full overflow-auto p-3" role="region" aria-label="Audit trail">
              {!run && <p className="p-6 text-center text-xs text-slate-400">No run selected. Every event of a run is persisted here in order.</p>}
              {run && (
                <ol className="space-y-1" aria-label="Immutable chronological event log">
                  {run.events.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5">
                      <span className="w-10 shrink-0 text-right text-[9px] text-slate-500">t{e.tick}</span>
                      <ABadge status={e.type.includes("failed") || e.type.includes("reject") ? "bad" : e.type.includes("approv") || e.type.includes("completed") ? "ok" : e.type.includes("approval") || e.type.includes("withheld") ? "warn" : "info"} label={e.type} />
                      <span className="text-[11px] text-slate-300">{e.message}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab === "infra" && (
            <div className="h-full overflow-auto p-3" role="region" aria-label="Infrastructure map">
              <p className="mb-3 text-[11px] text-slate-400">
                Live topology of the actual runtime. Health is measured — the API is probed over HTTP; connectors are
                reported <strong>NOT CONNECTED</strong> because no credentials exist. A run travels: Web App →
                Orchestrator → Run/Event Store + Evidence Store. Nothing else participates.
              </p>
              {!infra && <p className="text-xs text-slate-400">Probing infrastructure…</p>}
              {infra && (
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {infra.map((c) => (
                    <div key={c.id} className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-100">{c.label}</h3>
                        <ABadge status={c.state === "healthy" ? "ok" : c.state === "offline" ? "bad" : c.state === "not-connected" ? "warn" : "info"} label={c.state.toUpperCase()} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">{c.detail}</p>
                      <p className="mt-1 text-[9px] text-slate-500">
                        probe: {c.probe}{c.lastCheck ? ` · checked ${new Date(c.lastCheck).toLocaleTimeString()}` : ""}
                        {c.participatesInRuns ? " · participates in runs" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ——— Right-side inspector ——— */}
        <aside aria-label="Agent inspector" className="w-80 shrink-0 overflow-y-auto border-l border-slate-800/80 bg-slate-900/40 p-3">
          {selectedEdge ? (
            <APanel title="Connection" subtitle={`${selectedEdge.kind} edge`}
              right={<button aria-label="Close edge inspector" onClick={() => setSelectedEdge(null)}><XIcon size={12} /></button>}>
              <dl className="space-y-1 text-[11px]">
                <div><dt className="text-slate-400">From</dt><dd>{def.nodes.find((n) => n.id === selectedEdge.from)?.label}</dd></div>
                <div><dt className="text-slate-400">To</dt><dd>{def.nodes.find((n) => n.id === selectedEdge.to)?.label}</dd></div>
                <div><dt className="text-slate-400">Type</dt><dd>{selectedEdge.kind}{selectedEdge.condition ? " · conditional" : ""}</dd></div>
                {selectedEdge.condition && (
                  <div><dt className="text-slate-400">Condition</dt>
                    <dd>{selectedEdge.condition.source} {selectedEdge.condition.operator} {String(selectedEdge.condition.value)}</dd></div>
                )}
                {run && <div><dt className="text-slate-400">State</dt><dd>{run.edgeStates[selectedEdge.id] ?? "pending"}</dd></div>}
              </dl>
            </APanel>
          ) : selectedNode ? (
            <NodeInspector nodeId={selectedNode} def={def} run={run} dataset={dataset} onClose={() => setSelectedNode(null)} />
          ) : (
            <div className="space-y-3">
              <APanel title={def.name} subtitle={`v${def.version} · ${def.nodes.filter((n) => n.kind === "agent").length} agents`}>
                <p className="text-[11px] text-slate-300">{def.description}</p>
                <p className="mt-2 text-[10px] text-slate-400"><strong>Objective:</strong> {def.objective}</p>
                <ul className="mt-2 space-y-0.5 text-[10px] text-slate-400">
                  <li>• Parallel groups: {def.parallelGroups.map((g) => g.label).join(" | ") || "none"}</li>
                  <li>• Completion: {def.completionConditions.join("; ")}</li>
                  <li>• Dataset: {dataset.label} (synthetic)</li>
                </ul>
              </APanel>
              {run && (
                <APanel title="Run" subtitle={`${run.id} · ${run.mode}`}>
                  <ul className="space-y-0.5 text-[10px] text-slate-300">
                    <li>Status: <strong>{run.status}</strong></li>
                    <li>Tasks: {run.tasks.filter((t) => t.status === "completed").length}/{run.tasks.length} completed</li>
                    <li>Handoffs: {run.handoffs.length} · Evidence: {run.evidence.length} · Findings: {run.findings.length}</li>
                    <li>External actions: {run.externalActions.map((a) => `${a.description} (${a.status})`).join("; ") || "none"}</li>
                    {run.outcome && <li className="text-emerald-300">Outcome: {run.outcome.summary}</li>}
                  </ul>
                </APanel>
              )}
              <p className="flex items-center gap-1 text-[10px] text-slate-500"><HelpCircle size={11} aria-hidden /> Select any node on the canvas, board or audit trail to inspect it.</p>
            </div>
          )}
        </aside>
      </div>

      {/* ——— human-approval checkpoint ——— */}
      {pendingApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Human approval required">
          <div className="w-full max-w-lg rounded-xl border border-amber-500/50 bg-slate-900 p-4 shadow-2xl">
            <h2 className="flex items-center gap-2 text-sm font-bold text-amber-200"><Clock size={14} aria-hidden /> Human approval required — execution is paused</h2>
            <p className="mt-2 text-xs text-slate-200">{pendingApproval.prompt}</p>
            <p className="mt-2 text-[10px] text-slate-400">
              Agents may only propose. Approving records a human decision artifact and resumes from this checkpoint;
              rejecting records the refusal and its consequences — nothing is fabricated.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <AButton variant="danger" onClick={() => onApprove("rejected")}><span className="inline-flex items-center gap-1"><XCircle size={12} aria-hidden /> Reject</span></AButton>
              <AButton variant="primary" onClick={() => onApprove("approved")}><span className="inline-flex items-center gap-1"><CheckCircle2 size={12} aria-hidden /> Approve</span></AButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Inspector section (module-level — never created during render). */
const InspectorSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-2 border-t border-slate-800 pt-2">
    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>
    <div className="mt-1 text-[11px] text-slate-200">{children}</div>
  </div>
);

const NodeInspector: React.FC<{ nodeId: string; def: WorkflowDef; run: RunState | null; dataset: { label: string }; onClose: () => void }> =
  ({ nodeId, def, run, dataset, onClose }) => {
    const node: WfNode | undefined = def.nodes.find((n) => n.id === nodeId);
    const agent = node?.agentId ? agentById(node.agentId) : undefined;
    const task = run?.tasks.find((t) => t.nodeId === nodeId);
    const incoming = def.edges.filter((e) => e.to === nodeId);
    const outgoing = def.edges.filter((e) => e.from === nodeId);
    const artifacts = run?.artifacts.filter((a) => a.nodeId === nodeId) ?? [];
    const evidence = run?.evidence.filter((e) => e.nodeId === nodeId) ?? [];
    const handoffsIn = run?.handoffs.filter((h) => h.targetNodeId === nodeId) ?? [];
    const handoffsOut = run?.handoffs.filter((h) => h.sourceNodeId === nodeId) ?? [];
    const findings = run?.findings.filter((f) => f.nodeId === nodeId) ?? [];
    if (!node) return null;
    return (
      <div className="space-y-1">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">{node.label}</h3>
            <p className="text-[10px] text-slate-400">{agent?.role ?? node.kind}{node.sensitive ? " · sensitive" : ""}{node.external ? " · external effect" : ""}</p>
          </div>
          <div className="flex items-center gap-1">
            <ABadge status={task?.status === "completed" ? "ok" : task?.status === "failed" || task?.status === "blocked" ? "bad"
              : task?.status === "waiting-human" ? "warn" : task?.status === "running" ? "info" : "unknown"}
              label={task?.status ?? "pending"} />
            <button aria-label="Close inspector" onClick={onClose}><XIcon size={12} className="text-slate-400" /></button>
          </div>
        </div>
        {agent && <p className="mt-1 text-[11px] text-slate-300">{agent.description}</p>}
        <InspectorSection title="Execution state">
          {task ? (
            <ul className="space-y-0.5 text-slate-300">
              <li>status: {task.status}{task.attempts > 1 ? ` · attempt ${task.attempts}` : ""}</li>
              {task.wave !== undefined && <li>wave {task.wave} · ticks {task.startedTick ?? "–"}→{task.endTick ?? "–"}</li>}
              {task.latestOutput && <li className="text-slate-200">output: {task.latestOutput}</li>}
              {task.error && <li className="text-rose-300">error: {task.error}</li>}
              {task.nextAction && <li className="text-amber-300">next: {task.nextAction}</li>}
            </ul>
          ) : <p className="text-slate-400">not yet executed (no run selected)</p>}
        </InspectorSection>
        <InspectorSection title="Connections">
          <ul className="space-y-0.5">
            {incoming.map((e) => (
              <li key={e.id} className="flex items-center gap-1 text-slate-300">
                <ChevronRight size={10} aria-hidden /> from {def.nodes.find((n) => n.id === e.from)?.label}
                {run?.edgeStates[e.id] && <span className={`text-[9px] ${run.edgeStates[e.id] === "delivered" ? "text-emerald-300" : run.edgeStates[e.id] === "inactive" ? "text-slate-500" : "text-slate-400"}`}>({run.edgeStates[e.id]})</span>}
              </li>
            ))}
            {outgoing.map((e) => (
              <li key={e.id} className="flex items-center gap-1 text-slate-300">
                <ChevronRight size={10} aria-hidden className="rotate-180" /> to {def.nodes.find((n) => n.id === e.to)?.label}
                {e.condition && <span className="text-[9px] text-purple-300">if {e.condition.source} {e.condition.operator} {String(e.condition.value)}</span>}
              </li>
            ))}
            {incoming.length + outgoing.length === 0 && <li className="text-slate-500">none</li>}
          </ul>
        </InspectorSection>
        {agent && (
          <>
            <InspectorSection title="Tools & permissions">
              <ul className="space-y-0.5">
                {agent.tools.map((t) => (
                  <li key={t.tool} className="flex items-center justify-between">
                    <span>{t.tool} <span className="text-slate-500">({t.permission})</span></span>
                    <span className={`text-[9px] ${t.configured ? "text-emerald-300" : "text-amber-300"}`}>
                      {t.configured ? "synthetic adapter" : `${t.adapter}: NOT CONNECTED`}
                    </span>
                  </li>
                ))}
              </ul>
            </InspectorSection>
            <InspectorSection title="Authority & policy">
              <ul className="space-y-0.5 text-slate-300">
                <li>financial authority: {agent.authorityLimit.currency} {agent.authorityLimit.max} {agent.authorityLimit.max === 0 && "(propose-only — can never finalize)"}</li>
                <li>retry policy: {agent.retry.maxRetries} retry · timeout {agent.timeoutTicks} ticks</li>
                <li>memory scope: {agent.memoryScope}</li>
                <li>model: {agent.model.kind} {agent.model.version} — no LLM inference</li>
              </ul>
            </InspectorSection>
            {agent.guidance && (
              <InspectorSection title="Guidance"><p className="text-slate-300">{agent.guidance}</p></InspectorSection>
            )}
          </>
        )}
        <InspectorSection title="Inputs & dependencies">
          {handoffsIn.length === 0 && <p className="text-slate-500">none yet</p>}
          {handoffsIn.map((h) => (
            <p key={h.id} className="text-slate-300">
              {h.sourceAgentId} → {h.targetAgentId}: {h.inputArtifactIds.length} artifact(s), {h.evidenceIds.length} evidence ref(s), op "{h.requestedOperation}"
            </p>
          ))}
        </InspectorSection>
        <InspectorSection title="Outputs produced">
          {artifacts.length === 0 && <p className="text-slate-500">none yet</p>}
          {artifacts.map((a) => (
            <details key={a.id} className="rounded border border-slate-800 p-1">
              <summary className="cursor-pointer text-[10px] text-sky-300">{a.id} ({a.kind})</summary>
              <pre className="mt-1 max-h-40 overflow-auto text-[9px] text-slate-300">{JSON.stringify(a.payload, null, 1)}</pre>
            </details>
          ))}
        </InspectorSection>
        <InspectorSection title="Evidence generated">
          {evidence.length === 0 && <p className="text-slate-500">none yet</p>}
          {evidence.map((e) => (
            <p key={e.id} className="text-slate-300"><span className={`mr-1 inline-block rounded border px-1 text-[9px] ${STATUS_CLS.info}`}>{e.claim}</span> ← {e.source}</p>
          ))}
        </InspectorSection>
        <InspectorSection title="Findings">
          {findings.length === 0 && <p className="text-slate-500">none</p>}
          {findings.map((f) => (
            <p key={f.id} className="text-slate-200"><strong>{f.severity}</strong>: {f.summary}{f.amount ? ` (${f.amount.currency} ${f.amount.value})` : ""}</p>
          ))}
        </InspectorSection>
        <InspectorSection title="Handoffs out">
          {handoffsOut.length === 0 && <p className="text-slate-500">none yet</p>}
          {handoffsOut.map((h) => <p key={h.id} className="text-slate-300">→ {h.targetAgentId} ({h.requestedOperation}, deadline t{h.deadlineTick})</p>)}
        </InspectorSection>
        <InspectorSection title="Case">
          <p className="text-slate-400">dataset: {dataset.label} (synthetic fixture)</p>
        </InspectorSection>
      </div>
    );
  };
