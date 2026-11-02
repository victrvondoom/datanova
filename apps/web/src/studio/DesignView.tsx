import React, { useMemo, useState } from "react";
import { Button } from "../trail/ui";
import { CONN_LABELS, ConnType, Kind, addNode, connect, deleteNode, disconnect, emptyArchitecture, moveNode, renameNode, setConnectionLabel, setGroup, setProp } from "./model";
import { Scenario } from "./scenarios";
import { Workspace } from "./store";
import { StudioApi } from "./useStudio";
import { validateArchitecture, countBySeverity } from "./validation";
import { BLUEPRINTS } from "./blueprints";
import { pruneNodeLinks } from "./adr";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { Library } from "./Library";
import { ScenarioPanel } from "./ScenarioPanel";
import { Status } from "./parts";

const CONN_TYPES: ConnType[] = ["sync", "async", "event", "data", "schedule"];

export const DesignView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario; go: (tab: string) => void; onRecordDecision: (nodeId: string) => void }> = ({ api, ws, scenario, go, onRecordDecision }) => {
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selConn, setSelConn] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connType, setConnType] = useState<ConnType>("sync");
  const [from, setFrom] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLoad, setConfirmLoad] = useState<"baseline" | null>(null);
  const arch = ws.arch;
  const findings = useMemo(() => validateArchitecture(arch, scenario), [arch, scenario]);
  const counts = countBySeverity(findings);
  const node = arch.nodes.find((n) => n.id === selNode) ?? null;
  const conn = arch.connections.find((c) => c.id === selConn) ?? null;
  const challenge = ws.mode === "challenge";

  const add = (k: Kind) => {
    api.setArch((a) => addNode(a, k));
    setSelNode(`n${arch.seq + 1}`); // ids are deterministic: the new component is the next in sequence
    setSelConn(null);
    setMsg({ kind: "info", text: `Added ${k.replace(/_/g, " ")}. Select it to configure and connect it.` });
  };

  const doConnect = (a: string, b: string, t: ConnType, label = ""): { ok: boolean; reason: string } => {
    const r = connect(arch, a, b, t, label);
    if (r.ok) api.setArch(() => r.arch);
    return { ok: r.ok, reason: r.reason };
  };

  const activate = (id: string) => {
    if (connectMode) {
      if (!from) { setFrom(id); setMsg({ kind: "info", text: `Source set. Now choose the destination for the ${CONN_LABELS[connType].toLowerCase()}.` }); return; }
      if (from === id) { setFrom(null); setMsg({ kind: "info", text: "Connection cancelled." }); return; }
      const r = doConnect(from, id, connType);
      setMsg(r.ok ? { kind: "ok", text: "Connected." } : { kind: "error", text: r.reason });
      setFrom(null);
      return;
    }
    setSelNode(id); setSelConn(null);
  };

  const del = (id: string) => {
    api.setArch((a) => deleteNode(a, id));
    api.update((w) => ({ ...w, adrs: pruneNodeLinks(w.adrs, deleteNode(w.arch, id)) }));
    setSelNode(null);
    setMsg({ kind: "info", text: "Component deleted. Use Undo to bring it back." });
  };

  return (
    <div className="space-y-4">
      <details className="rounded-xl border border-slate-600/40 bg-slate-800/40 p-3" open={arch.nodes.length === 0}>
        <summary className="cursor-pointer text-sm font-bold text-sky-300">Scenario brief — {scenario.name}</summary>
        <div className="mt-3"><ScenarioPanel scenario={scenario} reveal={challenge ? { functional: (ws.challenge?.step ?? 0) >= 1, nonFunctional: (ws.challenge?.step ?? 0) >= 2 } : undefined} /></div>
      </details>

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Canvas tools">
        <Button onClick={() => api.undo()} disabled={api.undoDepth === 0}>Undo</Button>
        <Button variant={connectMode ? "primary" : "ghost"} aria-pressed={connectMode} onClick={() => { setConnectMode((m) => !m); setFrom(null); setMsg(null); }}>{connectMode ? "Connect mode: ON" : "Connect mode"}</Button>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          Type
          <select className="rounded-md border border-slate-500/50 bg-slate-900/70 px-2 py-1.5 text-sm text-slate-100" value={connType} onChange={(e) => setConnType(e.target.value as ConnType)} aria-label="Connection type for connect mode">
            {CONN_TYPES.map((t) => <option key={t} value={t}>{CONN_LABELS[t]}</option>)}
          </select>
        </label>
        <Button variant="danger" onClick={() => { if (!confirmReset) { setConfirmReset(true); window.setTimeout(() => setConfirmReset(false), 4000); return; } setConfirmReset(false); api.setArch(() => emptyArchitecture()); setSelNode(null); setSelConn(null); setMsg({ kind: "info", text: "Canvas reset. Undo restores it." }); }}>{confirmReset ? "Confirm reset?" : "Reset canvas"}</Button>
        {!challenge && (
          <Button onClick={() => { if (arch.nodes.length > 0 && confirmLoad !== "baseline") { setConfirmLoad("baseline"); window.setTimeout(() => setConfirmLoad(null), 4000); return; } setConfirmLoad(null); const bp = BLUEPRINTS[scenario.id]; if (bp) api.setArch(() => bp.baseline()); setSelNode(null); setSelConn(null); setMsg({ kind: "info", text: "Loaded the naive first draft — a starting point, not a recommended design." }); }}>
            {confirmLoad === "baseline" ? "Replace canvas?" : "Load naive first draft"}
          </Button>
        )}
        <Button variant="primary" onClick={() => { const r = api.saveNow(); setMsg(r.ok ? { kind: "ok", text: "Saved to this browser." } : { kind: "error", text: `Save failed: ${r.error}` }); }}>Save</Button>
        <button type="button" className="ml-auto text-xs text-sky-300 underline focus-visible:ring-2 focus-visible:ring-sky-400" onClick={() => go("validate")}>
          {findings.length === 0 ? "No findings" : `${findings.length} findings (${counts.critical} critical, ${counts.high} high)`} →
        </button>
      </div>
      {msg && <Status kind={msg.kind}>{msg.text}</Status>}

      <Library onAdd={add} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Canvas
            arch={arch} autoFit="width" heightClass="h-[30rem]" selectedNodeId={selNode} selectedConnId={selConn} connectMode={connectMode} connectFrom={from}
            onSelectNode={setSelNode} onSelectConn={(id) => { setSelConn(id); setSelNode(null); }}
            onActivateNode={activate} onMoveNode={(id, x, y) => api.setArch((a) => moveNode(a, id, x, y), { undoable: false })} onDeleteNode={del}
          />
          {arch.nodes.length > 0 && arch.connections.length === 0 && <p className="mt-2 text-xs text-amber-300">Components exist but nothing is connected yet. Use Connect mode, or the “Connect this component to…” form in the inspector.</p>}
        </div>
        <Inspector
          arch={arch} node={node} conn={conn} findings={findings}
          onRename={(id, v) => api.setArch((a) => renameNode(a, id, v), { undoable: false })}
          onGroup={(id, v) => api.setArch((a) => setGroup(a, id, v), { undoable: false })}
          onProp={(id, k, v) => api.setArch((a) => setProp(a, id, k, v), { undoable: false })}
          onDelete={del}
          onConnect={(a, b, t, l) => doConnect(a, b, t, l)}
          onDisconnect={(id) => { api.setArch((a) => disconnect(a, id)); setSelConn(null); }}
          onLabel={(id, l) => api.setArch((a) => setConnectionLabel(a, id, l), { undoable: false })}
          onSelectConn={(id) => { setSelConn(id); setSelNode(null); }}
          onRecordDecision={onRecordDecision}
        />
      </div>
    </div>
  );
};
