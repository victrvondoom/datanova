import React, { useState } from "react";
import { Architecture, ArchNode, CONN_LABELS, ConnType, Connection, KIND_DEFS, PropDef, canConnect } from "./model";
import { Finding } from "./validation";
import { Button } from "../trail/ui";
import { CheckField, NumField, SelectField, SeverityBadge, Status, TextField, TopicLinks } from "./parts";

const CONN_TYPES: ConnType[] = ["sync", "async", "event", "data", "schedule"];

export interface InspectorProps {
  arch: Architecture;
  node: ArchNode | null;
  conn: Connection | null;
  findings: Finding[];
  onRename: (id: string, v: string) => void;
  onGroup: (id: string, v: string) => void;
  onProp: (id: string, key: string, v: string | number | boolean) => void;
  onDelete: (id: string) => void;
  onConnect: (from: string, to: string, type: ConnType, label: string) => { ok: boolean; reason: string };
  onDisconnect: (connId: string) => void;
  onLabel: (connId: string, label: string) => void;
  onSelectConn: (id: string) => void;
  onRecordDecision: (nodeId: string) => void;
}

const PropEditor: React.FC<{ def: PropDef; node: ArchNode; arch: Architecture; onProp: InspectorProps["onProp"] }> = ({ def, node, arch, onProp }) => {
  const v = node.props[def.key];
  if (def.type === "number") return <NumField label={def.label} value={typeof v === "number" ? v : Number(def.default)} min={def.min} help={def.help} onCommit={(n) => onProp(node.id, def.key, n)} />;
  if (def.type === "boolean") return <CheckField label={def.label} checked={v === true} help={def.help} onChange={(b) => onProp(node.id, def.key, b)} />;
  if (def.type === "select") return <SelectField label={def.label} value={String(v)} options={def.options ?? []} help={def.help} onChange={(s) => onProp(node.id, def.key, s)} />;
  if (def.type === "target")
    return (
      <SelectField label={def.label} value={String(v ?? "")} help="Reliability policies guard one component. Choose it here." onChange={(s) => onProp(node.id, def.key, s)}
        options={[{ value: "", label: "— choose a component —" }, ...arch.nodes.filter((n) => n.id !== node.id && !KIND_DEFS[n.kind].policy).map((n) => ({ value: n.id, label: `${n.name} (${KIND_DEFS[n.kind].label})` }))]} />
    );
  return <TextField label={def.label} value={String(v ?? "")} help={def.help} onChange={(s) => onProp(node.id, def.key, s)} />;
};

export const Inspector: React.FC<InspectorProps> = (p) => {
  const { arch, node, conn } = p;
  const [toId, setToId] = useState("");
  const [type, setType] = useState<ConnType>("sync");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (conn) {
    const f = arch.nodes.find((n) => n.id === conn.from);
    const t = arch.nodes.find((n) => n.id === conn.to);
    return (
      <section className="space-y-3 rounded-xl border border-slate-600/40 bg-slate-800/60 p-4" aria-label="Connection inspector" data-testid="inspector">
        <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">Connection</h3>
        <p className="text-sm text-slate-200">{f?.name} → {t?.name}</p>
        <p className="text-xs text-slate-400">{CONN_LABELS[conn.type]}</p>
        <TextField label="Connection label" value={conn.label} onChange={(v) => p.onLabel(conn.id, v)} placeholder="e.g. enqueue job" />
        <Button variant="danger" onClick={() => p.onDisconnect(conn.id)}>Disconnect</Button>
      </section>
    );
  }
  if (!node)
    return (
      <section className="rounded-xl border border-dashed border-slate-600/50 bg-slate-800/30 p-4 text-sm text-slate-400" aria-label="Properties inspector" data-testid="inspector">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-sky-300">Properties</h3>
        Select a component or a connection to inspect and configure it.
      </section>
    );
  const def = KIND_DEFS[node.kind];
  const out = arch.connections.filter((c) => c.from === node.id);
  const inn = arch.connections.filter((c) => c.to === node.id);
  const mine = p.findings.filter((f) => f.nodeIds.includes(node.id));
  const candidate = arch.nodes.filter((n) => n.id !== node.id && !def.policy && !KIND_DEFS[n.kind].policy);
  const chk = toId ? canConnect(arch, node.id, toId, type) : null;
  const nameOf = (id: string) => arch.nodes.find((n) => n.id === id)?.name ?? id;
  return (
    <section className="space-y-4 rounded-xl border border-slate-600/40 bg-slate-800/60 p-4" aria-label="Properties inspector" data-testid="inspector">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">{def.label}</h3>
        <p className="text-xs text-slate-400">{def.short}</p>
        <div className="mt-1 text-xs"><TopicLinks topics={def.topics} /></div>
      </div>
      <TextField label="Name" value={node.name} onChange={(v) => p.onRename(node.id, v)} />
      <TextField label="Group (optional)" value={node.group} onChange={(v) => p.onGroup(node.id, v)} help="Components sharing a group name are boxed together." />
      <div className="space-y-3 border-t border-slate-700/60 pt-3">
        {def.props.map((d) => <PropEditor key={d.key} def={d} node={node} arch={arch} onProp={p.onProp} />)}
      </div>

      {mine.length > 0 && (
        <div className="border-t border-slate-700/60 pt-3">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Findings about this component</h4>
          <ul className="space-y-1.5">
            {mine.slice(0, 5).map((f) => (
              <li key={f.id} className="text-xs text-slate-300"><SeverityBadge severity={f.severity} /> <span className="ml-1">{f.detected}</span></li>
            ))}
          </ul>
        </div>
      )}

      {!def.policy && (
        <div className="space-y-2 border-t border-slate-700/60 pt-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Connections</h4>
          {out.length + inn.length === 0 && <p className="text-xs text-slate-500">No connections yet.</p>}
          <ul className="space-y-1 text-xs">
            {[...out.map((c) => ({ c, dir: "→" })), ...inn.map((c) => ({ c, dir: "←" }))].map(({ c, dir }) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded border border-slate-700/60 px-2 py-1">
                <button type="button" className="text-left text-slate-200 hover:text-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400" onClick={() => p.onSelectConn(c.id)}>
                  {dir} {nameOf(dir === "→" ? c.to : c.from)} <span className="text-slate-400">· {CONN_LABELS[c.type]}{c.label ? ` · ${c.label}` : ""}</span>
                </button>
                <button type="button" className="rounded border border-rose-500/50 px-1.5 py-0.5 text-rose-300 hover:bg-rose-500/20 focus-visible:ring-2 focus-visible:ring-rose-400" aria-label={`Disconnect ${dir === "→" ? "to" : "from"} ${nameOf(dir === "→" ? c.to : c.from)}`} onClick={() => p.onDisconnect(c.id)}>Disconnect</button>
              </li>
            ))}
          </ul>
          <fieldset className="space-y-2 rounded-lg border border-slate-700/60 p-2">
            <legend className="px-1 text-xs font-semibold text-slate-300">Connect this component to…</legend>
            <SelectField label="Destination" value={toId} onChange={(v) => { setToId(v); setMsg(null); }} options={[{ value: "", label: "— choose —" }, ...candidate.map((n) => ({ value: n.id, label: n.name }))]} />
            <SelectField label="Connection type" value={type} onChange={(v) => { setType(v as ConnType); setMsg(null); }} options={CONN_TYPES.map((t) => ({ value: t, label: CONN_LABELS[t] }))} />
            <TextField label="Label (optional)" value={label} onChange={setLabel} />
            {chk && !chk.ok && <p className="text-xs text-amber-300">Not allowed: {chk.reason}</p>}
            <Button variant="primary" disabled={!toId || !(chk?.ok ?? false)} onClick={() => { const r = p.onConnect(node.id, toId, type, label); setMsg({ ok: r.ok, text: r.ok ? "Connected." : r.reason }); if (r.ok) { setLabel(""); setToId(""); } }}>Add connection</Button>
            {msg && <Status kind={msg.ok ? "ok" : "error"}>{msg.text}</Status>}
          </fieldset>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-700/60 pt-3">
        <Button onClick={() => p.onRecordDecision(node.id)}>Record a decision about this</Button>
        <Button variant="danger" onClick={() => p.onDelete(node.id)}>Delete component</Button>
      </div>
    </section>
  );
};
