import React, { useMemo, useState } from "react";
import { Button } from "../trail/ui";
import { Architecture } from "./model";
import { Workspace } from "./store";
import { Scenario } from "./scenarios";
import { BLUEPRINTS } from "./blueprints";
import { StudioApi } from "./useStudio";
import { compareArchitectures } from "./compare";
import { Canvas } from "./Canvas";
import { OutcomeBadge, Panel, SelectField, Status, TextField } from "./parts";
import { recordCompare } from "./challenge";

export const CompareView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario }> = ({ api, ws, scenario }) => {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const challenge = ws.mode === "challenge";
  const options = useMemo(() => {
    const o: Array<{ value: string; label: string; arch: Architecture }> = [{ value: "current", label: "Current canvas", arch: ws.arch }];
    for (const v of ws.versions) o.push({ value: v.id, label: `Saved: ${v.name}`, arch: v.arch });
    if (ws.challenge?.initialSnapshot) o.push({ value: "initial", label: "Challenge: initial sketch", arch: ws.challenge.initialSnapshot });
    const bp = BLUEPRINTS[scenario.id];
    if (bp && !challenge) {
      o.push({ value: "builtin:baseline", label: "Built-in: naive first draft", arch: bp.baseline() });
      o.push({ value: "builtin:example", label: "Built-in: worked example (one valid design)", arch: bp.example() });
    }
    return o;
  }, [ws.arch, ws.versions, ws.challenge, scenario.id, challenge]);

  const aId = options.some((o) => o.value === ws.compare.a) ? ws.compare.a : options[Math.min(1, options.length - 1)].value;
  const bId = options.some((o) => o.value === ws.compare.b) ? ws.compare.b : "current";
  const A = options.find((o) => o.value === aId) as (typeof options)[number];
  const B = options.find((o) => o.value === bId) as (typeof options)[number];
  const same = A.arch === B.arch;
  const rep = useMemo(() => compareArchitectures(A.arch, B.arch, scenario, ws.capacity), [A.arch, B.arch, scenario, ws.capacity]);
  const setSel = (p: Partial<{ a: string; b: string }>) => api.update((w) => ({ ...w, compare: { a: p.a ?? aId, b: p.b ?? bId } }));
  const saveVersion = () => {
    const n = name.trim();
    if (!n) { setMsg({ ok: false, text: "Give the version a name." }); return; }
    api.update((w) => ({ ...w, versions: [...w.versions, { id: `v${Date.now().toString(36)}`, name: n.slice(0, 60), savedAt: new Date().toISOString(), arch: w.arch }].slice(-20) }));
    setName(""); setMsg({ ok: true, text: `Saved “${n}”. Change the design, then compare.` });
  };

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-slate-300">Compare two versions side by side. The comparison explains trade-offs — it never declares one version “better”, because a simpler design can be the right one.</p>
      <Panel title="Versions">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <SelectField label="Version A" value={aId} onChange={(v) => setSel({ a: v })} options={options.map((o) => ({ value: o.value, label: o.label }))} />
          <SelectField label="Version B" value={bId} onChange={(v) => setSel({ b: v })} options={options.map((o) => ({ value: o.value, label: o.label }))} />
          <div className="flex items-end gap-2">
            <div className="flex-1"><TextField label="Save current canvas as…" value={name} onChange={setName} placeholder="e.g. v1 – synchronous" /></div>
            <Button variant="primary" onClick={saveVersion}>Save version</Button>
          </div>
        </div>
        {msg && <div className="mt-2"><Status kind={msg.ok ? "ok" : "error"}>{msg.text}</Status></div>}
        {ws.versions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {ws.versions.map((v) => <li key={v.id} className="flex items-center gap-1 rounded border border-slate-600/50 px-2 py-1 text-slate-300">{v.name}<button type="button" className="text-rose-300 underline focus-visible:ring-2 focus-visible:ring-rose-400" aria-label={`Delete saved version ${v.name}`} onClick={() => api.update((w) => ({ ...w, versions: w.versions.filter((x) => x.id !== v.id) }))}>delete</button></li>)}
          </ul>
        )}
      </Panel>

      {same && <Status kind="info">Versions A and B are the same architecture. Pick two different versions to see differences.</Status>}
      <div className="grid gap-4 md:grid-cols-2">
        <div><h3 className="mb-1 text-sm font-bold text-slate-200">A — {A.label}</h3><Canvas arch={A.arch} readOnly autoFit="both" heightClass="h-80" /></div>
        <div><h3 className="mb-1 text-sm font-bold text-slate-200">B — {B.label}</h3><Canvas arch={B.arch} readOnly autoFit="both" heightClass="h-80" /></div>
      </div>

      <Panel title="Side by side" hint="Counts and model outputs — no combined score">
        <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-sm" data-testid="compare-table">
          <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-1 pr-3">Dimension</th><th className="pr-3">A</th><th className="pr-3">B</th><th>What to keep in mind</th></tr></thead>
          <tbody className="divide-y divide-slate-700/60 align-top">
            {rep.rows.map((r) => <tr key={r.dimension}><th scope="row" className="py-2 pr-3 text-left font-semibold text-slate-100">{r.dimension}</th><td className="py-2 pr-3 text-slate-300">{r.a}</td><td className="py-2 pr-3 text-slate-300">{r.b}</td><td className="py-2 text-xs text-slate-400">{r.note}</td></tr>)}
          </tbody>
        </table></div>
      </Panel>

      <Panel title="Requirements with structural evidence">
        <div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-sm"><thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-1">Requirement</th><th>A</th><th>B</th></tr></thead>
          <tbody className="divide-y divide-slate-700/60">{rep.requirements.map((r) => <tr key={r.id}><td className="py-1.5 pr-3 text-slate-200">{r.text}</td><td className="text-slate-300">{r.a}</td><td className={r.a !== r.b ? "font-semibold text-sky-300" : "text-slate-300"}>{r.b}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="How each version fails (Failure Lab model)">
        <div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-sm"><thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-1">Failure</th><th>A</th><th>B</th></tr></thead>
          <tbody className="divide-y divide-slate-700/60">{rep.failures.map((f) => <tr key={f.failureId} className={f.changed ? "bg-sky-500/5" : ""}><td className="py-1.5 pr-3 text-slate-200">{f.name}</td><td><OutcomeBadge outcome={f.before} /></td><td><OutcomeBadge outcome={f.after} /></td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Trade-offs introduced">
        {rep.tradeoffs.length ? <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-200" data-testid="tradeoffs">{rep.tradeoffs.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-sm text-slate-400">No component-level differences to explain.</p>}
        <div className="mt-4 space-y-2 rounded-lg border border-violet-500/40 bg-violet-500/10 p-3 text-sm text-violet-100" data-testid="perspective">
          {rep.perspective.map((p) => <p key={p}>{p}</p>)}
        </div>
      </Panel>

      {challenge && ws.challenge && (
        <Button variant="primary" onClick={() => { const r = recordCompare(ws.challenge as NonNullable<typeof ws.challenge>, ws.arch); if (r.ok) api.update((w) => ({ ...w, challenge: r.state })); setMsg({ ok: r.ok, text: r.ok ? "Comparison recorded for the challenge." : r.reason }); }}>Record comparison for the challenge</Button>
      )}
    </div>
  );
};
