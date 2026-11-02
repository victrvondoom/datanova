import React, { useRef, useState } from "react";
import { Button, Callout } from "../trail/ui";
import { SCENARIOS, allTopicsOf } from "./scenarios";
import { StudioApi } from "./useStudio";
import { ScenarioPanel } from "./ScenarioPanel";
import { Panel, Status, TextField } from "./parts";
import { download } from "./util";
import { safeFilename } from "./exporters";

export const ScenariosView: React.FC<{ api: StudioApi; go: (tab: string) => void }> = ({ api, go }) => {
  const [brief, setBrief] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { store } = api;

  const doImport = (text: string) => {
    const r = api.importText(text);
    setImportMsg({ ok: r.ok, lines: r.ok ? ["Imported as a new architecture and opened it."] : r.errors.slice(0, 6) });
    if (r.ok) { setPasted(""); go("design"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-100">Choose a scenario</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-300">
          Each scenario has its own requirements, constraints and traffic assumptions. Start from a blank canvas, from a deliberately naive first draft to improve, or take the guided challenge.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="scenario-cards">
        {SCENARIOS.map((s, i) => (
          <article key={s.id} className="flex flex-col rounded-xl border border-slate-600/40 bg-slate-800/60 p-4" data-testid={`scenario-${s.id}`}>
            <div className="text-xs font-mono text-sky-400">SCENARIO {String(i + 1).padStart(2, "0")}</div>
            <h3 className="text-lg font-bold text-slate-100">{s.name}</h3>
            <p className="mt-1 text-sm text-slate-300">{s.tagline}</p>
            <p className="mt-2 text-xs text-slate-400">{s.requirements.length} requirements · topics {allTopicsOf(s).map((t) => String(t).padStart(2, "0")).join(", ")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => { api.createWorkspace(s.id, "blank"); go("design"); }}>Start blank</Button>
              <Button onClick={() => { api.createWorkspace(s.id, "baseline"); go("design"); }}>Improve a first draft</Button>
              <Button onClick={() => { api.createWorkspace(s.id, "blank", undefined, true); go("challenge"); }}>Guided challenge</Button>
              <Button aria-expanded={brief === s.id} onClick={() => setBrief(brief === s.id ? null : s.id)}>{brief === s.id ? "Hide brief" : "Read brief"}</Button>
            </div>
            {brief === s.id && <div className="mt-4 border-t border-slate-700/60 pt-3"><ScenarioPanel scenario={s} /></div>}
          </article>
        ))}
      </div>

      <Panel title="Saved architectures" hint="Stored in this browser only (no account, no server)">
        {store.workspaces.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="no-saved">Nothing saved yet. Pick a scenario above to begin; your work saves automatically.</p>
        ) : (
          <ul className="space-y-2" data-testid="saved-list">
            {store.workspaces.map((w) => {
              const sc = SCENARIOS.find((s) => s.id === w.scenarioId);
              return (
                <li key={w.id} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${w.id === store.activeId ? "border-sky-400/60 bg-sky-500/10" : "border-slate-600/40"}`}>
                  {renaming?.id === w.id ? (
                    <form className="flex flex-1 items-end gap-2" onSubmit={(e) => { e.preventDefault(); api.rename(w.id, renaming.name); setRenaming(null); }}>
                      <div className="flex-1"><TextField label="New name" value={renaming.name} onChange={(v) => setRenaming({ id: w.id, name: v })} /></div>
                      <Button variant="primary" type="submit">Save name</Button>
                      <Button onClick={() => setRenaming(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-100">{w.name} {w.id === store.activeId && <span className="ml-1 text-xs text-sky-300">(open)</span>}{w.mode === "challenge" && <span className="ml-1 rounded border border-violet-400/50 px-1 text-[10px] text-violet-300">CHALLENGE</span>}</div>
                        <div className="text-xs text-slate-400">{sc?.name} · {w.arch.nodes.length} components · {w.arch.connections.length} connections · {w.adrs.length} ADRs · updated {new Date(w.updatedAt).toLocaleString()}</div>
                      </div>
                      <Button onClick={() => { api.open(w.id); go(w.mode === "challenge" ? "challenge" : "design"); }}>Open</Button>
                      <Button onClick={() => setRenaming({ id: w.id, name: w.name })}>Rename</Button>
                      <Button onClick={() => api.duplicate(w.id)}>Duplicate</Button>
                      <Button onClick={() => download(safeFilename(w.name, "json"), api.exportJson(w), "application/json")}>Export JSON</Button>
                      <Button variant="danger" onClick={() => { if (confirmDel !== w.id) { setConfirmDel(w.id); window.setTimeout(() => setConfirmDel((c) => (c === w.id ? null : c)), 4000); return; } setConfirmDel(null); api.remove(w.id); }}>{confirmDel === w.id ? "Confirm delete?" : "Delete"}</Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Import an architecture" hint="Files are validated before anything is loaded">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Import architecture JSON file" className="text-sm text-slate-300 file:mr-3 file:rounded-md file:border file:border-slate-500/50 file:bg-slate-700/40 file:px-3 file:py-1.5 file:text-slate-200"
              onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2_000_000) { setImportMsg({ ok: false, lines: ["File is too large to import."] }); return; } doImport(await f.text()); e.target.value = ""; }} />
          </div>
          <TextField label="…or paste exported JSON" multiline value={pasted} onChange={setPasted} />
          <Button disabled={!pasted.trim()} onClick={() => doImport(pasted)}>Import pasted JSON</Button>
          {importMsg && (
            <Status kind={importMsg.ok ? "ok" : "error"}>
              {importMsg.ok ? importMsg.lines[0] : <><strong>Import rejected — nothing was loaded.</strong><ul className="mt-1 list-disc pl-5">{importMsg.lines.map((l) => <li key={l}>{l}</li>)}</ul></>}
            </Status>
          )}
        </div>
      </Panel>

      <Callout kind="info" title="What the Studio is — and is not">
        Components, traffic numbers and failures are an educational model. Nothing here is a load test, a benchmark, or a real provider integration; payments are always simulated.
      </Callout>
    </div>
  );
};
