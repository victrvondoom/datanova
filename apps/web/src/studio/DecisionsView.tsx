import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../trail/ui";
import { Workspace } from "./store";
import { Scenario } from "./scenarios";
import { StudioApi } from "./useStudio";
import { Adr, ADR_STATUSES, AdrDraft, AdrStatus, adrToMarkdown, adrsToMarkdown, createAdr, deleteAdr, emptyDraft, updateAdr } from "./adr";
import { CheckField, Panel, SelectField, Status, TextField, TopicLinks } from "./parts";
import { download } from "./util";
import { getTopic, TOPICS } from "../trail/content";
import { safeFilename } from "./exporters";

export interface Seed { nodeId?: string; requirementId?: string }

function seedDraft(seed: Seed | null, scenario: Scenario, ws: Workspace): AdrDraft | null {
  if (!seed) return null;
  const req = seed.requirementId ? scenario.requirements.find((r) => r.id === seed.requirementId) : undefined;
  const node = seed.nodeId ? ws.arch.nodes.find((n) => n.id === seed.nodeId) : undefined;
  if (!req && !node) return null;
  return { ...emptyDraft(), title: req ? `Decision: ${req.text.replace(/\.$/, "")}` : `Decision about ${node?.name}`, context: req ? `Requirement: ${req.text}` : "", relatedRequirementIds: req ? [req.id] : [], relatedTopicIds: req?.topics ?? [], relatedNodeIds: node ? [node.id] : [] };
}

export const DecisionsView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario; seed: Seed | null; clearSeed: () => void }> = ({ api, ws, scenario, seed, clearSeed }) => {
  // a decision can be started from a requirement or a component: seed the form on mount
  const seeded = useMemo(() => seedDraft(seed, scenario, ws), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState<string | null>(seeded ? "new" : null); // adr id | "new"
  const [draft, setDraft] = useState<AdrDraft>(seeded ?? emptyDraft());
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const ctx = { arch: ws.arch, requirements: scenario.requirements, topicTitle: (t: number) => getTopic(t)?.title ?? "?" };

  useEffect(() => { if (seed) clearSeed(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startNew = () => { setDraft(emptyDraft()); setEditing("new"); setErrors([]); setOk(null); };
  const startEdit = (a: Adr) => { const { id: _i, number: _n, createdAt: _c, updatedAt: _u, ...d } = a; setDraft(d); setEditing(a.id); setErrors([]); setOk(null); };
  const set = <K extends keyof AdrDraft>(k: K, v: AdrDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = () => {
    const now = new Date().toISOString();
    if (editing === "new") {
      const r = createAdr(ws.adrs, draft, now);
      if ("error" in r) { setErrors(r.error); return; }
      api.update((w) => ({ ...w, adrs: r.adrs })); setOk(`${r.adr.id} saved.`);
    } else if (editing) {
      const r = updateAdr(ws.adrs, editing, draft, now);
      if ("error" in r) { setErrors(r.error); return; }
      api.update((w) => ({ ...w, adrs: r.adrs })); setOk(`${editing} updated.`);
    }
    setErrors([]); setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={startNew}>New decision</Button>
        <Button disabled={ws.adrs.length === 0} onClick={() => download(safeFilename(`${ws.name}-adrs`, "md"), adrsToMarkdown(ws.adrs, ctx), "text/markdown")}>Export all ADRs (Markdown)</Button>
        <span className="text-xs text-slate-400">{ws.adrs.length} decision(s) recorded</span>
      </div>
      {ok && <Status kind="ok">{ok}</Status>}

      {editing && (
        <Panel title={editing === "new" ? "Record an architecture decision" : `Edit ${editing}`}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }} data-testid="adr-form">
            {errors.length > 0 && <Status kind="error"><ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Status>}
            <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
              <TextField label="Decision (short title)" value={draft.title} onChange={(v) => set("title", v)} placeholder="Process PDF generation asynchronously" />
              <SelectField label="Status" value={draft.status} options={ADR_STATUSES} onChange={(v) => set("status", v as AdrStatus)} />
            </div>
            <TextField label="Context — why is this decision necessary?" multiline value={draft.context} onChange={(v) => set("context", v)} />
            <TextField label="Alternatives considered" multiline value={draft.alternatives} onChange={(v) => set("alternatives", v)} />
            <TextField label="Selected option — what are we choosing?" multiline value={draft.decision} onChange={(v) => set("decision", v)} />
            <TextField label="Reason — why this option?" multiline value={draft.reason} onChange={(v) => set("reason", v)} />
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Trade-offs" multiline value={draft.tradeoffs} onChange={(v) => set("tradeoffs", v)} />
              <TextField label="Risks" multiline value={draft.risks} onChange={(v) => set("risks", v)} />
              <TextField label="Follow-up work" multiline value={draft.followUp} onChange={(v) => set("followUp", v)} />
            </div>
            <fieldset className="rounded-lg border border-slate-700/60 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-300">Link to requirements</legend>
              <div className="grid gap-1 md:grid-cols-2">{scenario.requirements.map((r) => <CheckField key={r.id} label={r.text} checked={draft.relatedRequirementIds.includes(r.id)} onChange={() => set("relatedRequirementIds", toggle(draft.relatedRequirementIds, r.id))} />)}</div>
            </fieldset>
            <fieldset className="rounded-lg border border-slate-700/60 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-300">Link to components</legend>
              {ws.arch.nodes.length === 0 ? <p className="text-xs text-slate-500">No components on the canvas yet.</p> : <div className="grid gap-1 md:grid-cols-3">{ws.arch.nodes.map((n) => <CheckField key={n.id} label={n.name} checked={draft.relatedNodeIds.includes(n.id)} onChange={() => set("relatedNodeIds", toggle(draft.relatedNodeIds, n.id))} />)}</div>}
            </fieldset>
            <fieldset className="rounded-lg border border-slate-700/60 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-300">Link to TRACEN topics</legend>
              <div className="grid gap-1 md:grid-cols-3">{TOPICS.map((t) => <CheckField key={t.id} label={`${String(t.id).padStart(2, "0")} ${t.title.replace(/\s*\(.*\)/, "")}`} checked={draft.relatedTopicIds.includes(t.id)} onChange={() => set("relatedTopicIds", toggle(draft.relatedTopicIds, t.id))} />)}</div>
            </fieldset>
            <div className="flex gap-2"><Button variant="primary" type="submit">Save decision</Button><Button onClick={() => { setEditing(null); setErrors([]); }}>Cancel</Button></div>
          </form>
        </Panel>
      )}

      {ws.adrs.length === 0 && !editing ? (
        <div className="rounded-xl border border-dashed border-slate-600/50 p-6 text-sm text-slate-400" data-testid="adr-empty">No decisions recorded yet. An ADR captures <em>why</em> — the part a diagram cannot show.</div>
      ) : (
        <ul className="space-y-3" data-testid="adr-list">
          {ws.adrs.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-600/40 bg-slate-800/60 p-4" data-testid={`adr-${a.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-100">{a.id} — {a.title}</h3>
                <span className="rounded border border-slate-500/50 px-1.5 text-xs text-slate-300">{a.status}</span>
                <span className="ml-auto flex flex-wrap gap-2">
                  <Button onClick={() => startEdit(a)}>Edit</Button>
                  <Button onClick={() => download(safeFilename(a.id + "-" + a.title, "md"), adrToMarkdown(a, ctx), "text/markdown")}>Export</Button>
                  <Button variant="danger" onClick={() => { if (confirmDel !== a.id) { setConfirmDel(a.id); window.setTimeout(() => setConfirmDel(null), 4000); return; } setConfirmDel(null); api.update((w) => ({ ...w, adrs: deleteAdr(w.adrs, a.id) })); }}>{confirmDel === a.id ? "Confirm delete?" : "Delete"}</Button>
                </span>
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm md:grid-cols-[9rem_1fr]">
                <dt className="text-xs uppercase text-slate-400">Selected option</dt><dd className="text-slate-200">{a.decision}</dd>
                <dt className="text-xs uppercase text-slate-400">Reason</dt><dd className="text-slate-200">{a.reason}</dd>
                {a.tradeoffs && <><dt className="text-xs uppercase text-slate-400">Trade-offs</dt><dd className="text-slate-200">{a.tradeoffs}</dd></>}
                {a.risks && <><dt className="text-xs uppercase text-slate-400">Risks</dt><dd className="text-slate-200">{a.risks}</dd></>}
                <dt className="text-xs uppercase text-slate-400">Requirements</dt><dd className="text-slate-200">{a.relatedRequirementIds.map((id) => scenario.requirements.find((r) => r.id === id)?.text).filter(Boolean).join("; ") || "—"}</dd>
                <dt className="text-xs uppercase text-slate-400">Components</dt><dd className="text-slate-200">{a.relatedNodeIds.map((id) => ws.arch.nodes.find((n) => n.id === id)?.name).filter(Boolean).join(", ") || "—"}</dd>
                <dt className="text-xs uppercase text-slate-400">Topics</dt><dd><TopicLinks topics={a.relatedTopicIds} /></dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
