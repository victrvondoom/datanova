import React, { useMemo, useState } from "react";
import { Button, Stat } from "../trail/ui";
import { Architecture, KIND_DEFS } from "./model";
import { FAILURES, FailureResult, FailureId, RecoveryResult, TraceStep, compareFailureRuns, getFailure, recoverPending, restoreComponent, runAllFailures, runFailure } from "./failures";
import { fromArchitecture } from "./capacity";
import { Workspace, defaultFailureConfig } from "./store";
import { StudioApi, usePrefersReducedMotion } from "./useStudio";
import { Canvas } from "./Canvas";
import { NumField, OutcomeBadge, Panel, SelectField, Status, TopicLinks } from "./parts";
import { recordFailure } from "./challenge";

const BEFORE_ID = "fl-before";

const STEP_ICON: Record<TraceStep["kind"], { icon: string; label: string }> = {
  trigger: { icon: "⚡", label: "Failure injected" }, request: { icon: "→", label: "Request path" }, protection: { icon: "🛡", label: "Protection activates" },
  failure: { icon: "✗", label: "Failure" }, retry: { icon: "↻", label: "Retry" }, degrade: { icon: "⚠", label: "Degraded" }, outcome: { icon: "■", label: "Final outcome" }, note: { icon: "ⓘ", label: "Note" },
};

export const FailureView: React.FC<{ api: StudioApi; ws: Workspace }> = ({ api, ws }) => {
  const cfg = ws.failureConfig ?? defaultFailureConfig();
  const def = getFailure(cfg.failureId);
  const reduced = usePrefersReducedMotion();
  const cap = useMemo(() => fromArchitecture(ws.arch, ws.capacity), [ws.arch, ws.capacity]);
  const [run, setRun] = useState<{ result: FailureResult; arch: Architecture; restored: boolean; rec: RecoveryResult | null; note: string } | null>(null);
  // "before" is kept as a saved version so it survives tab changes and reloads (and shows up in Compare)
  const beforeV = ws.versions.find((v) => v.id === BEFORE_ID) ?? null;
  const before = beforeV ? { arch: beforeV.arch, at: new Date(beforeV.savedAt).toLocaleTimeString() } : null;
  const [table, setTable] = useState<FailureResult[] | null>(null);
  const targets = ws.arch.nodes.filter((n) => def.targetKinds.includes(n.kind));
  const setCfg = (p: Partial<typeof cfg>) => api.update((w) => ({ ...w, failureConfig: { ...(w.failureConfig ?? defaultFailureConfig()), ...p } }));

  const inject = (id: FailureId = cfg.failureId, targetId = cfg.targetId) => {
    const result = runFailure(ws.arch, id, { targetId: targetId || undefined, latencyMs: cfg.latencyMs, multiplier: cfg.multiplier, copies: cfg.copies }, cap);
    setRun({ result, arch: ws.arch, restored: false, rec: null, note: "" });
    if (ws.challenge) api.update((w) => ({ ...w, challenge: w.challenge ? recordFailure(w.challenge, id) : w.challenge }));
  };

  const r = run?.result;
  const nodeStates = run ? (run.restored && run.rec ? run.rec.nodeStates : run.result.nodeStates) : undefined;
  const hlEdges = r ? [...new Set(r.steps.flatMap((s) => s.edgeIds))] : [];
  const hlNodes = r ? [...new Set(r.steps.flatMap((s) => s.nodeIds))] : [];
  const stale = run && ws.arch !== run.arch;

  const changed = before && ws.arch !== before.arch ? compareFailureRuns(before.arch, ws.arch, cap) : null;

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-slate-300">
        Inject a failure and watch what <em>your</em> architecture does. The outcome comes from the timeouts, retries, breakers, queues, locks and keys you configured — if a protection is missing, the failure is shown unprotected. This is a deterministic educational model, not real fault injection.
      </p>
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Panel title="Choose a failure">
          <div className="space-y-3" data-testid="failure-controls">
            <SelectField label="Failure" value={cfg.failureId} onChange={(v) => setCfg({ failureId: v as FailureId, targetId: "" })} options={FAILURES.map((f, i) => ({ value: f.id, label: `${i + 1}. ${f.name}` }))} />
            <p className="text-xs text-slate-400">{def.description}</p>
            <SelectField label="Target component" value={cfg.targetId} onChange={(v) => setCfg({ targetId: v })} help={targets.length === 0 ? `Your canvas has no ${def.targetKinds.map((k) => KIND_DEFS[k].label).join(" / ")}.` : undefined}
              options={[{ value: "", label: "Automatic (best match)" }, ...targets.map((n) => ({ value: n.id, label: n.name }))]} />
            {cfg.failureId === "db-slow" && <NumField label="Database latency (ms)" value={cfg.latencyMs} min={1} onCommit={(v) => setCfg({ latencyMs: v })} />}
            {cfg.failureId === "backlog-growth" && <NumField label="Arrival multiplier (×)" value={cfg.multiplier} min={1} onCommit={(v) => setCfg({ multiplier: v })} />}
            {cfg.failureId === "duplicate-payment" && <NumField label="Identical requests" value={cfg.copies} min={2} onCommit={(v) => setCfg({ copies: Math.min(10, Math.floor(v)) })} />}
            <div className="text-xs"><span className="text-slate-400">Teaches: </span><TopicLinks topics={def.topics} /></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => inject()}>Inject failure</Button>
              <Button onClick={() => setTable(runAllFailures(ws.arch, cap))}>Run all 12</Button>
            </div>
          </div>
        </Panel>

        <div className="min-w-0 space-y-4">
          {!r ? (
            <div className="rounded-xl border border-dashed border-slate-600/50 p-6 text-sm text-slate-400" data-testid="failure-empty">
              Pick a failure and press <strong>Inject failure</strong>. You will see the affected components and connections, the request path, which protections activate, and the final outcome.
            </div>
          ) : (
            <div className="space-y-4" data-testid="failure-result">
              {stale && <Status kind="info">You changed the architecture after this run. Re-inject to see current behavior.</Status>}
              <Canvas arch={run.arch} readOnly autoFit="both" heightClass="h-80" nodeStates={nodeStates} edgeStates={run.restored ? {} : r.edgeStates} highlightNodes={hlNodes} highlightEdges={hlEdges} animate={!reduced && !run.restored} />
              <Panel title={getFailure(r.failureId).name} hint={r.targetId ? `Target: ${ws.arch.nodes.find((n) => n.id === r.targetId)?.name ?? "—"}` : "No target"}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3"><OutcomeBadge outcome={r.outcome} /><span className="text-sm text-slate-200" data-testid="failure-explanation">{r.explanation}</span></div>

                  {r.applicable && (
                    <>
                      <ol className="space-y-1.5" aria-label="What happened, in order" data-testid="trace">
                        {r.steps.map((s, i) => (
                          <li key={i} className="flex gap-2 text-sm"><span className="mt-0.5 w-6 shrink-0 text-center" aria-hidden="true">{STEP_ICON[s.kind].icon}</span><span className="text-slate-200"><span className="text-xs font-bold uppercase text-slate-400">{STEP_ICON[s.kind].label}: </span>{s.text}</span></li>
                        ))}
                      </ol>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="failure-stats">
                        <Stat label={`Total ${r.stats.unit}`} value={r.stats.total} />
                        <Stat label="Succeeded" value={r.stats.ok} tone="ok" />
                        <Stat label="Slow" value={r.stats.slow} />
                        <Stat label="Degraded (fallback)" value={r.stats.degraded} />
                        <Stat label="Failed" value={r.stats.failed} tone={r.stats.failed ? "bad" : "neutral"} />
                        <Stat label="Retries" value={r.stats.retries} />
                        <Stat label="Fast-failed (breaker)" value={r.stats.fastFailed} />
                        <Stat label="Hung (no timeout)" value={r.stats.hung} tone={r.stats.hung ? "bad" : "neutral"} />
                        {(r.stats.duplicatesExecuted > 0 || r.stats.duplicatesPrevented > 0) && <><Stat label="Duplicates executed" value={r.stats.duplicatesExecuted} tone={r.stats.duplicatesExecuted ? "bad" : "ok"} /><Stat label="Duplicates prevented" value={r.stats.duplicatesPrevented} tone="ok" /></>}
                        <Stat label="Attempts per request" value={`${r.stats.amplification}×`} />
                      </div>
                      <div>
                        <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Configured protections</h4>
                        <ul className="space-y-1" data-testid="protections">
                          {r.protections.map((p) => <li key={p.name} className="text-sm text-slate-200"><span className={p.active ? "text-emerald-400" : "text-slate-500"} aria-hidden="true">{p.active ? "✓" : "○"}</span> <strong>{p.name}</strong> <span className="text-xs text-slate-400">({p.active ? "active" : "not active"})</span> — {p.detail}</li>)}
                        </ul>
                      </div>
                      <p className={`rounded-lg border px-3 py-2 text-sm ${r.propagates ? "border-rose-500/50 bg-rose-500/10 text-rose-100" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"}`} data-testid="propagation">
                        <strong>{r.propagates ? "Failure propagates. " : "Failure is contained. "}</strong>{r.propagationNote}
                      </p>
                      {r.missing.length > 0 && <div><h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">What would help</h4><ul className="list-disc pl-5 text-sm text-slate-300">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
                      {r.series.length > 2 && <p className="text-xs text-slate-400">Backlog after 300 s ≈ {Math.round(r.series.filter(([t]) => t <= 300).pop()?.[1] ?? 0)} jobs (see Capacity for the full curve).</p>}
                    </>
                  )}
                </div>
              </Panel>

              {r.applicable && (
                <Panel title="Recovery" hint="Only what the architecture can really recover">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => { const rec = restoreComponent(run.arch, r); setRun({ ...run, restored: true, rec, note: rec.note }); }} disabled={run.restored}>Restore failed component</Button>
                    <Button onClick={() => { const rec = recoverPending(r, run.restored); setRun({ ...run, rec: { ...(run.rec ?? rec), ...rec, nodeStates: run.rec?.nodeStates ?? rec.nodeStates }, note: rec.note }); }}>Recover queued work / retry pending</Button>
                    <Button onClick={() => { setRun(null); }}>Reset scenario</Button>
                  </div>
                  {run.note && <div className="mt-3"><Status kind={run.rec && run.rec.lost > 0 ? "error" : "info"}>{run.note}</Status></div>}
                  {run.rec && run.rec.recovered + run.rec.lost > 0 && <p className="mt-2 text-sm text-slate-300">Recovered: <strong>{run.rec.recovered}</strong> · Lost: <strong>{run.rec.lost}</strong> · Still pending: <strong>{run.rec.remaining}</strong></p>}
                </Panel>
              )}
            </div>
          )}

          <Panel title="Before / after an architecture change">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => api.update((w) => ({ ...w, versions: [...w.versions.filter((v) => v.id !== BEFORE_ID), { id: BEFORE_ID, name: "Failure Lab: before", savedAt: new Date().toISOString(), arch: w.arch }] }))}>Remember current design as “before”</Button>
              {before && <span className="text-xs text-slate-400">Before saved at {before.at}. Change the architecture, then compare.</span>}
            </div>
            {before && !changed && <p className="mt-2 text-sm text-slate-400">Change the design (Design tab) to see how all 12 outcomes differ.</p>}
            {changed && (
              <table className="mt-3 w-full text-sm" data-testid="before-after">
                <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-1">Failure</th><th>Before</th><th>After</th></tr></thead>
                <tbody className="divide-y divide-slate-700/60">
                  {changed.map((row) => <tr key={row.failureId} className={row.changed ? "bg-sky-500/5" : ""}><td className="py-1.5 pr-2 text-slate-200">{row.name}{row.changed && <span className="ml-2 text-xs text-sky-300">changed</span>}</td><td><OutcomeBadge outcome={row.before} /></td><td><OutcomeBadge outcome={row.after} /></td></tr>)}
                </tbody>
              </table>
            )}
          </Panel>

          {table && (
            <Panel title="All twelve failures against this architecture">
              <table className="w-full text-sm" data-testid="all-failures">
                <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-1">Failure</th><th>Outcome</th><th /></tr></thead>
                <tbody className="divide-y divide-slate-700/60">
                  {table.map((t) => <tr key={t.failureId}><td className="py-1.5 pr-2 text-slate-200">{getFailure(t.failureId).name}</td><td><OutcomeBadge outcome={t.outcome} /></td><td className="text-right"><Button onClick={() => { setCfg({ failureId: t.failureId, targetId: "" }); inject(t.failureId, ""); }}>Inspect</Button></td></tr>)}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-400">“Not applicable” means your canvas has nothing for that failure to hit — it is not the same as being protected.</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
};
