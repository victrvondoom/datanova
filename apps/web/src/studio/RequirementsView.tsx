import React, { useState } from "react";
import { Button, StateBadge } from "../trail/ui";
import { Scenario } from "./scenarios";
import { Workspace } from "./store";
import { StudioApi } from "./useStudio";
import { EvidenceStatus, evaluateRequirement, relatedKinds } from "./requirements";
import { KIND_DEFS } from "./model";
import { Panel, TextField, TopicLinks } from "./parts";

const STATUS: Record<EvidenceStatus, { state: "recovered" | "degraded" | "failed"; label: string }> = {
  evidenced: { state: "recovered", label: "Evidence found" },
  partial: { state: "degraded", label: "Partly evidenced" },
  missing: { state: "failed", label: "No evidence yet" },
};

export const RequirementsView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario; onRecordDecision: (reqId: string) => void; go: (t: string) => void }> = ({ api, ws, scenario, onRecordDecision, go }) => {
  const [sel, setSel] = useState<string>(scenario.requirements[0].id);
  const req = scenario.requirements.find((r) => r.id === sel) ?? scenario.requirements[0];
  const evalOf = (id: string) => {
    const r = scenario.requirements.find((x) => x.id === id) as (typeof scenario.requirements)[number];
    return evaluateRequirement(ws.arch, r, { linkedAdrCount: ws.adrs.filter((a) => a.relatedRequirementIds.includes(id)).length });
  };
  const ev = evalOf(req.id);
  const mark = ws.marks[req.id];
  const kinds = relatedKinds(req);
  const present = ws.arch.nodes.filter((n) => kinds.includes(n.kind));
  const setMark = (m: { status: "addressed" | "concern"; note: string } | null) =>
    api.update((w) => { const marks = { ...w.marks }; if (m) marks[req.id] = m; else delete marks[req.id]; return { ...w, marks }; });
  const evidenced = scenario.requirements.filter((r) => evalOf(r.id).status === "evidenced").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300" data-testid="req-summary">
        <strong className="text-slate-100">{evidenced}/{scenario.requirements.length}</strong> requirements have structural evidence in your diagram. Evidence means the needed components and connections exist — it is not proof that the design works; use the Failure Lab for that.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ul className="space-y-1.5" aria-label="Requirements">
          {scenario.requirements.map((r) => {
            const s = evalOf(r.id).status;
            const m = ws.marks[r.id];
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setSel(r.id)} aria-current={r.id === sel} data-testid={`req-${r.id}`}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-sky-400 ${r.id === sel ? "border-sky-400 bg-sky-500/10" : "border-slate-600/40 bg-slate-800/50 hover:border-slate-400"}`}>
                  <span className="block text-slate-100">{r.text}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-slate-400">{r.type}</span>
                    <StateBadge state={STATUS[s].state} label={STATUS[s].label} />
                    {m && <span className="rounded border border-slate-500/50 px-1.5 text-slate-300">{m.status === "addressed" ? "✔ marked addressed" : "⚑ concern noted"}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <Panel title="Requirement → decision" hint={`${req.type} · ${req.id}`}>
          <div className="space-y-4" data-testid="req-detail">
            <h3 className="text-lg font-bold text-slate-100">{req.text}</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-700/60">
                <tr><th className="w-36 py-2 pr-3 text-left align-top text-xs uppercase text-slate-400">Architecture decision</th><td className="py-2 text-slate-200">{req.decision}</td></tr>
                <tr><th className="py-2 pr-3 text-left align-top text-xs uppercase text-slate-400">Relevant concept</th><td className="py-2"><TopicLinks topics={req.topics} /></td></tr>
                <tr><th className="py-2 pr-3 text-left align-top text-xs uppercase text-slate-400">Reason</th><td className="py-2 text-slate-200">{req.reason}</td></tr>
                <tr><th className="py-2 pr-3 text-left align-top text-xs uppercase text-slate-400">Trade-off</th><td className="py-2 text-slate-200">{req.tradeoff}</td></tr>
              </tbody>
            </table>

            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Evidence in your architecture</h4>
              <ul className="space-y-1 text-sm">
                {ev.needs.map((n) => (
                  <li key={n.text} className="flex gap-2"><span aria-hidden="true" className={n.met ? "text-emerald-400" : "text-rose-400"}>{n.met ? "✓" : "✗"}</span><span className="text-slate-200"><span className="sr-only">{n.met ? "Met: " : "Not met: "}</span>{n.text}</span></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Related components</h4>
              {kinds.length > 0 && <p className="text-xs text-slate-400">Kinds that can provide evidence: {kinds.map((k) => KIND_DEFS[k].label).join(", ")}.</p>}
              <p className="mt-1 text-sm text-slate-200">{present.length ? `On your canvas: ${present.map((n) => n.name).join(", ")}.` : "None of these are on your canvas yet."}</p>
            </div>

            <div className="space-y-2 border-t border-slate-700/60 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Your assessment</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant={mark?.status === "addressed" ? "primary" : "ghost"} aria-pressed={mark?.status === "addressed"} onClick={() => setMark({ status: "addressed", note: mark?.note ?? "" })}>Mark addressed</Button>
                <Button variant={mark?.status === "concern" ? "primary" : "ghost"} aria-pressed={mark?.status === "concern"} onClick={() => setMark({ status: "concern", note: mark?.note ?? "" })}>Record unresolved concern</Button>
                {mark && <Button onClick={() => setMark(null)}>Clear mark</Button>}
                <Button onClick={() => onRecordDecision(req.id)}>Record a decision</Button>
                <Button onClick={() => go("design")}>Open canvas</Button>
              </div>
              {mark && <TextField label={mark.status === "addressed" ? "How is it addressed?" : "What is the concern?"} multiline value={mark.note} onChange={(v) => setMark({ status: mark.status, note: v })} />}
              {mark?.status === "addressed" && ev.status !== "evidenced" && (
                <p role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  You marked this addressed, but the diagram has no structural evidence for it yet. Marks never replace evidence — they are your own record.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
