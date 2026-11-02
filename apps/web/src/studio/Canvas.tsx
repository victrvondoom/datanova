/**
 * Architecture canvas: SVG with pointer + keyboard interaction.
 * Presentation only — every edit is dispatched to the pure model via callbacks.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SysState } from "../trail/ui";
import { Architecture, ArchNode, KIND_DEFS } from "./model";
import { EdgeState } from "./failures";
import { CATEGORY_COLOR, CONN_STYLE, KIND_ABBR, NODE_H, NODE_W, STATE_VISUAL } from "./visual";

export interface CanvasProps {
  arch: Architecture;
  selectedNodeId?: string | null;
  selectedConnId?: string | null;
  connectFrom?: string | null;
  connectMode?: boolean;
  readOnly?: boolean;
  nodeStates?: Record<string, SysState>;
  edgeStates?: Record<string, EdgeState>;
  highlightNodes?: string[];
  highlightEdges?: string[];
  animate?: boolean;
  heightClass?: string;
  /** 'width': fit to container width on mount; 'both': keep the whole diagram visible (read-only views) */
  autoFit?: "width" | "both";
  onSelectNode?: (id: string | null) => void;
  onSelectConn?: (id: string | null) => void;
  onActivateNode?: (id: string) => void;
  onMoveNode?: (id: string, x: number, y: number) => void;
  onDeleteNode?: (id: string) => void;
}

const EDGE_COLOR: Record<EdgeState, string> = { ok: "", failed: "#f43f5e", degraded: "#f59e0b", retrying: "#f59e0b" };
const EDGE_ICON: Record<EdgeState, string> = { ok: "", failed: " ✗", degraded: " ⚠", retrying: " ↻" };

function clip(n: { x: number; y: number }, tx: number, ty: number): { x: number; y: number } {
  const cx = n.x + NODE_W / 2;
  const cy = n.y + NODE_H / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const s = Math.min(NODE_W / 2 / Math.abs(dx || 1e-9), NODE_H / 2 / Math.abs(dy || 1e-9));
  return { x: cx + dx * s, y: cy + dy * s };
}

export const Canvas: React.FC<CanvasProps> = ({
  arch, selectedNodeId, selectedConnId, connectFrom, connectMode, readOnly, nodeStates, edgeStates, highlightNodes, highlightEdges, animate,
  heightClass = "h-[28rem]", autoFit, onSelectNode, onSelectConn, onActivateNode, onMoveNode, onDeleteNode,
}) => {
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);
  const panRef = useRef<{ px: number; py: number; sl: number; st: number } | null>(null);

  const pos = (n: ArchNode): { x: number; y: number } => (drag && drag.id === n.id ? { x: drag.x, y: drag.y } : { x: n.x, y: n.y });
  const byId = useMemo(() => new Map(arch.nodes.map((n) => [n.id, n])), [arch.nodes]);
  // editable canvases keep room to grow; read-only ones hug their content so "fit" can fill the box
  const W = Math.max(readOnly ? 320 : 900, ...arch.nodes.map((n) => n.x + NODE_W + (readOnly ? 30 : 80)));
  const H = Math.max(readOnly ? 160 : 460, ...arch.nodes.map((n) => n.y + NODE_H + (readOnly ? 30 : 80)));

  useEffect(() => {
    if (selectedNodeId) wrap.current?.querySelector<SVGGElement>(`[data-node="${selectedNodeId}"]`)?.focus({ preventScroll: true });
  }, [selectedNodeId]);

  const fit = (mode: "width" | "both" = "width") => {
    const w = wrap.current?.clientWidth ?? W;
    const h = wrap.current?.clientHeight ?? H;
    const zw = (w - 8) / W;
    const z = mode === "both" ? Math.min(zw, (h - 8) / H) : zw;
    setZoom(Math.max(0.35, Math.min(mode === "both" ? 1.1 : 1, z)));
    if (wrap.current) { wrap.current.scrollLeft = 0; wrap.current.scrollTop = 0; }
  };
  // auto-fit: on mount (and, for read-only views, whenever the diagram changes size)
  useEffect(() => {
    if (!autoFit) return;
    const id = window.requestAnimationFrame(() => fit(autoFit));
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFit, readOnly ? W : 0, readOnly ? H : 0]);

  const groups = useMemo(() => {
    const m = new Map<string, ArchNode[]>();
    for (const n of arch.nodes) if (n.group) m.set(n.group, [...(m.get(n.group) ?? []), n]);
    return [...m.entries()];
  }, [arch.nodes]);

  const onNodeDown = (e: React.PointerEvent<SVGGElement>, n: ArchNode) => {
    e.stopPropagation();
    (e.currentTarget as SVGGElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: n.id, px: e.clientX, py: e.clientY, ox: n.x, oy: n.y, moved: false };
  };
  const onNodeMove = (e: React.PointerEvent<SVGGElement>) => {
    const d = dragRef.current;
    if (!d || readOnly) return;
    const dx = (e.clientX - d.px) / zoom;
    const dy = (e.clientY - d.py) / zoom;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setDrag({ id: d.id, x: Math.max(0, Math.round(d.ox + dx)), y: Math.max(0, Math.round(d.oy + dy)) });
  };
  const onNodeUp = (n: ArchNode) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved && drag) onMoveNode?.(n.id, drag.x, drag.y);
    else onActivateNode?.(n.id);
    setDrag(null);
  };

  const onKey = (e: React.KeyboardEvent<SVGGElement>, n: ArchNode) => {
    const step = e.shiftKey ? 40 : 10;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivateNode?.(n.id); }
    else if (!readOnly && e.key.startsWith("Arrow")) {
      e.preventDefault();
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      onMoveNode?.(n.id, n.x + dx, n.y + dy);
    } else if (!readOnly && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); onDeleteNode?.(n.id); }
    else if (e.key === "Escape") onSelectNode?.(null);
  };

  const hlN = new Set(highlightNodes ?? []);
  const hlE = new Set(highlightEdges ?? []);

  return (
    <div className="rounded-xl border border-slate-600/40 bg-slate-900/70">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-700/60 px-2 py-1.5 text-xs">
        <button type="button" className="rounded border border-slate-500/50 px-2 py-1 text-slate-200 hover:bg-slate-700/60 focus-visible:ring-2 focus-visible:ring-sky-400" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}>−</button>
        <span data-testid="zoom-level" className="min-w-[3rem] text-center font-mono text-slate-300" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" className="rounded border border-slate-500/50 px-2 py-1 text-slate-200 hover:bg-slate-700/60 focus-visible:ring-2 focus-visible:ring-sky-400" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}>+</button>
        <button type="button" className="rounded border border-slate-500/50 px-2 py-1 text-slate-200 hover:bg-slate-700/60 focus-visible:ring-2 focus-visible:ring-sky-400" onClick={() => fit("width")}>Fit width</button>
        <button type="button" className="rounded border border-slate-500/50 px-2 py-1 text-slate-200 hover:bg-slate-700/60 focus-visible:ring-2 focus-visible:ring-sky-400" onClick={() => setZoom(1)}>100%</button>
        <span className="ml-auto hidden text-slate-400 sm:inline">Drag to move · arrow keys nudge · Delete removes · drag empty space to pan</span>
      </div>
      <div
        ref={wrap}
        className={`${heightClass} overflow-auto touch-pan-x touch-pan-y`}
        data-testid="canvas-scroll"
        onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as Element).getAttribute("data-bg") === "1") panRef.current = { px: e.clientX, py: e.clientY, sl: wrap.current?.scrollLeft ?? 0, st: wrap.current?.scrollTop ?? 0 }; }}
        onPointerMove={(e) => { const p = panRef.current; if (p && wrap.current && e.buttons === 1) { wrap.current.scrollLeft = p.sl - (e.clientX - p.px); wrap.current.scrollTop = p.st - (e.clientY - p.py); } }}
        onPointerUp={() => { panRef.current = null; }}
      >
        <svg
          width={W * zoom} height={H * zoom} viewBox={`0 0 ${W} ${H}`} role="group"
          aria-label={`Architecture canvas with ${arch.nodes.length} components and ${arch.connections.length} connections`}
          data-testid="canvas"
        >
          <defs>
            {(Object.keys(CONN_STYLE) as Array<keyof typeof CONN_STYLE>).map((k) => (
              <marker key={k} id={`m-${k}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill={CONN_STYLE[k].color} /></marker>
            ))}
            <marker id="m-failed" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#f43f5e" /></marker>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1e293b" strokeWidth="1" /></pattern>
          </defs>
          <rect data-bg="1" width={W} height={H} fill="url(#grid)" onClick={() => { onSelectNode?.(null); onSelectConn?.(null); }} />
          {arch.nodes.length === 0 && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fill="#64748b" fontSize="15">Empty canvas — add components from the library, then connect them.</text>
          )}
          {groups.map(([g, ns]) => {
            const x1 = Math.min(...ns.map((n) => pos(n).x)) - 14, y1 = Math.min(...ns.map((n) => pos(n).y)) - 28;
            const x2 = Math.max(...ns.map((n) => pos(n).x + NODE_W)) + 14, y2 = Math.max(...ns.map((n) => pos(n).y + NODE_H)) + 14;
            return (
              <g key={g}>
                <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx="12" fill="rgba(148,163,184,0.05)" stroke="#64748b" strokeDasharray="4 4" />
                <text x={x1 + 10} y={y1 + 16} fill="#94a3b8" fontSize="11" fontWeight="600">Group: {g}</text>
              </g>
            );
          })}
          {/* policy guard lines */}
          {arch.nodes.map((n) => {
            const t = KIND_DEFS[n.kind].policy ? byId.get(String(n.props.target)) : undefined;
            if (!t) return null;
            const a = pos(n), b = pos(t);
            return <line key={`g-${n.id}`} x1={a.x + NODE_W / 2} y1={a.y + NODE_H / 2} x2={b.x + NODE_W / 2} y2={b.y + NODE_H / 2} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="1 4" />;
          })}
          {arch.connections.map((c) => {
            const f = byId.get(c.from), t = byId.get(c.to);
            if (!f || !t) return null;
            const fp = pos(f), tp = pos(t);
            const p1 = clip(fp, tp.x + NODE_W / 2, tp.y + NODE_H / 2);
            const p2 = clip(tp, fp.x + NODE_W / 2, fp.y + NODE_H / 2);
            const s = CONN_STYLE[c.type];
            const es = edgeStates?.[c.id] ?? "ok";
            const color = EDGE_COLOR[es] || s.color;
            const sel = selectedConnId === c.id;
            const flowing = animate && hlE.has(c.id);
            return (
              <g key={c.id}>
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={sel ? 4 : es === "ok" ? 2 : 3}
                  strokeDasharray={flowing ? undefined : s.dash || undefined} markerEnd={es === "failed" ? "url(#m-failed)" : `url(#m-${c.type})`}
                  className={flowing ? "studio-flow" : undefined} opacity={hlE.size && !hlE.has(c.id) ? 0.35 : 1}
                />
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="16" style={{ cursor: "pointer" }}
                  data-testid={`conn-${c.id}`} role="button" tabIndex={0} aria-label={`${f.name} to ${t.name}: ${s.label}${c.label ? `, ${c.label}` : ""}. Press Enter to inspect.`}
                  onClick={(e) => { e.stopPropagation(); onSelectConn?.(c.id); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectConn?.(c.id); } }} />
                {(c.label || es !== "ok") && (
                  <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 6} fill={es === "ok" ? "#cbd5e1" : color} fontSize="10" textAnchor="middle" paintOrder="stroke" stroke="#0f172a" strokeWidth="3">
                    {c.label}{EDGE_ICON[es]}
                  </text>
                )}
              </g>
            );
          })}
          {arch.nodes.map((n) => {
            const def = KIND_DEFS[n.kind];
            const p = pos(n);
            const st = nodeStates?.[n.id];
            const sv = st && st !== "healthy" ? STATE_VISUAL[st] : undefined;
            const sel = selectedNodeId === n.id;
            const src = connectFrom === n.id;
            const stroke = sv ? sv.color : CATEGORY_COLOR[def.category];
            const dim = hlN.size > 0 && !hlN.has(n.id) && !sv;
            return (
              <g
                key={n.id} data-node={n.id} data-testid={`node-${n.id}`} tabIndex={0} role="button" transform={`translate(${p.x},${p.y})`} opacity={dim ? 0.45 : 1}
                aria-pressed={sel}
                aria-label={`${n.name}, ${def.label}${sv ? `, ${sv.label}` : ""}${n.group ? `, group ${n.group}` : ""}. ${connectMode ? "Press Enter to use in connection." : "Press Enter to select; arrow keys move; Delete removes."}`}
                style={{ cursor: readOnly ? "pointer" : "grab", touchAction: "none", outline: "none" }}
                onPointerDown={(e) => onNodeDown(e, n)} onPointerMove={onNodeMove} onPointerUp={() => onNodeUp(n)} onKeyDown={(e) => onKey(e, n)}
              >
                <rect width={NODE_W} height={NODE_H} rx="9" fill="#1e293b" stroke={stroke} strokeWidth={sel || src ? 4 : sv ? 3 : 2} strokeDasharray={def.policy ? "6 3" : undefined} />
                {(sel || src) && <rect x={-5} y={-5} width={NODE_W + 10} height={NODE_H + 10} rx="12" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray={src ? "5 3" : undefined} pointerEvents="none" />}
                <rect width="6" height={NODE_H} rx="3" fill={CATEGORY_COLOR[def.category]} />
                <text x="16" y="22" fill="#f1f5f9" fontSize="13" fontWeight="600">{n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name}</text>
                <text x="16" y="39" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace, monospace">
                  {KIND_ABBR[n.kind]}{typeof n.props.instances === "number" ? ` ×${n.props.instances}` : ""}
                </text>
                {sv && (
                  <text x="16" y="54" fill={sv.color} fontSize="11" fontWeight="700">{sv.icon} {sv.label}</text>
                )}
                {src && <text x={NODE_W - 8} y="16" textAnchor="end" fill="#38bdf8" fontSize="10" fontWeight="700">SOURCE</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-700/60 px-3 py-2 text-[11px] text-slate-300" aria-label="Connection legend">
        {(Object.keys(CONN_STYLE) as Array<keyof typeof CONN_STYLE>).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <svg width="30" height="8" aria-hidden="true"><line x1="0" y1="4" x2="30" y2="4" stroke={CONN_STYLE[k].color} strokeWidth="2" strokeDasharray={CONN_STYLE[k].dash || undefined} /></svg>
            {CONN_STYLE[k].label}
          </span>
        ))}
      </div>
    </div>
  );
};
