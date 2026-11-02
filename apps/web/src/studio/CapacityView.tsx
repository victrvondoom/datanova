import React from "react";
import { Button, Callout, Stat } from "../trail/ui";
import { CapacityInputs, FORMULAS, UNKNOWN_VARIABLES, UNRELIABLE_WHEN, computeCapacity, fmtRatio, fromArchitecture } from "./capacity";
import { Workspace } from "./store";
import { Scenario } from "./scenarios";
import { StudioApi } from "./useStudio";
import { CheckField, LoadBadge, Meter, NumField, Panel } from "./parts";

const f1 = (n: number): string => (Number.isFinite(n) ? (Math.round(n * 100) / 100).toLocaleString() : "∞");

const QueueChart: React.FC<{ series: Array<[number, number]>; peakEnd: number }> = ({ series, peakEnd }) => {
  const W = 560, H = 190, L = 48, B = 28, T = 10, R = 10;
  const maxT = series[series.length - 1]?.[0] ?? 1;
  const maxY = Math.max(1, ...series.map((s) => s[1]));
  const x = (t: number) => L + (t / maxT) * (W - L - R);
  const y = (v: number) => H - B - (v / maxY) * (H - B - T);
  const pts = series.map(([t, v]) => `${x(t)},${y(v)}`).join(" ");
  const last = series[series.length - 1]?.[1] ?? 0;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Queue depth over ${maxT} seconds; maximum ${Math.round(maxY)} jobs; ends at ${Math.round(last)} jobs.`}>
        <rect x={L} y={T} width={W - L - R} height={H - B - T} fill="none" stroke="#334155" />
        {peakEnd > 0 && peakEnd < maxT && <rect x={L} y={T} width={x(peakEnd) - L} height={H - B - T} fill="rgba(245,158,11,0.08)" />}
        <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth="2" />
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={L - 4} x2={L} y1={y(maxY * f)} y2={y(maxY * f)} stroke="#64748b" /><text x={L - 6} y={y(maxY * f) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(maxY * f)}</text></g>)}
        {[0, 0.5, 1].map((f) => <text key={f} x={x(maxT * f)} y={H - 10} textAnchor="middle" fontSize="10" fill="#94a3b8">{Math.round(maxT * f)}s</text>)}
        <text x={8} y={H / 2} fontSize="10" fill="#94a3b8" transform={`rotate(-90 8 ${H / 2})`} textAnchor="middle">jobs waiting</text>
      </svg>
      <figcaption className="text-xs text-slate-400">Queue depth over time (shaded = peak window). Computed from the formulas below with your inputs; not a measurement.</figcaption>
    </figure>
  );
};

export const CapacityView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario }> = ({ api, ws, scenario }) => {
  const c = ws.capacity;
  const res = computeCapacity(c);
  const set = <K extends keyof CapacityInputs>(k: K, v: CapacityInputs[K]) => api.update((w) => ({ ...w, capacity: { ...w.capacity, [k]: v } }));
  const q = res.queue;
  return (
    <div className="space-y-4">
      <Callout kind="warning" title="Educational model — not a load test">
        Every number below comes from your inputs and the formulas listed at the bottom. Nothing is measured, and no result means a design “can serve N requests per second”. Measure with a real load test before making capacity claims.
      </Callout>
      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <Panel title="Inputs (your assumptions)" hint={scenario.name}>
          <div className="space-y-3" data-testid="capacity-inputs">
            <NumField label="Average requests per second (req/s)" value={c.avgRps} min={0} onCommit={(v) => set("avgRps", v)} />
            <NumField label="Peak requests per second (req/s)" value={c.peakRps} min={0} onCommit={(v) => set("peakRps", v)} />
            <NumField label="Average request duration (ms)" value={c.requestMs} min={0} onCommit={(v) => set("requestMs", v)} />
            <NumField label="Application instance count" value={c.instances} min={0} onCommit={(v) => set("instances", Math.floor(v))} />
            <NumField label="Capacity per instance (req/s) — assumption" value={c.perInstanceRps} min={0} onCommit={(v) => set("perInstanceRps", v)} help="Unknown until you load-test." />
            <NumField label="Concurrent requests per instance" value={c.concurrencyPerInstance} min={0} onCommit={(v) => set("concurrencyPerInstance", Math.floor(v))} />
            <CheckField label="Architecture has a cache" checked={c.hasCache} onChange={(v) => set("hasCache", v)} help="When off, hit rate is treated as 0." />
            <NumField label="Cache hit rate (0–1)" value={c.cacheHitRate} min={0} step={0.05} onCommit={(v) => set("cacheHitRate", v)} />
            <NumField label="Cache-eligible read share (0–1)" value={c.readShare} min={0} step={0.05} onCommit={(v) => set("readShare", v)} />
            <NumField label="Database capacity (ops/s) — assumption" value={c.dbCapacityOps} min={0} onCommit={(v) => set("dbCapacityOps", v)} />
            <NumField label="Background job arrival rate (jobs/s, average)" value={c.jobArrivalRate} min={0} step={0.1} onCommit={(v) => set("jobArrivalRate", v)} />
            <NumField label="Worker instances" value={c.workers} min={0} onCommit={(v) => set("workers", Math.floor(v))} />
            <NumField label="Worker processing rate (jobs/s per worker)" value={c.workerRatePerSec} min={0} step={0.1} onCommit={(v) => set("workerRatePerSec", v)} />
            <NumField label="Initial queue depth (jobs)" value={c.queueDepth} min={0} onCommit={(v) => set("queueDepth", Math.floor(v))} />
            <NumField label="Peak duration (s)" value={c.peakDurationSec} min={0} onCommit={(v) => set("peakDurationSec", Math.floor(v))} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => api.update((w) => ({ ...w, capacity: fromArchitecture(w.arch, w.capacity) }))}>Sync from architecture</Button>
              <Button onClick={() => api.update((w) => ({ ...w, capacity: { ...scenario.capacity } }))}>Reset to scenario defaults</Button>
            </div>
            <p className="text-[11px] text-slate-500">“Sync” copies instance counts, per-instance capacity, cache presence, workers and DB capacity from your canvas.</p>
          </div>
        </Panel>

        <div className="space-y-4">
          {res.warnings.length > 0 && (
            <div role="alert" className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-3" data-testid="capacity-warnings">
              <h3 className="text-sm font-bold text-rose-200">Overload warnings</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-rose-100">{res.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          <Panel title="Request load" hint="req/s — formulas 1–3">
            <div className="grid gap-4 sm:grid-cols-2">
              {([["Average", res.avg], ["Peak", res.peak]] as const).map(([name, p]) => (
                <div key={name} className="space-y-2 rounded-lg border border-slate-700/60 p-3" data-testid={`load-${name.toLowerCase()}`}>
                  <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-slate-100">{name}: {f1(p.rps)} req/s</h4><LoadBadge status={p.status} /></div>
                  <Meter label="Request-rate utilization" ratio={p.utilization} detail={`${f1(p.rps)} / ${f1(p.capacity)}`} />
                  <Meter label="Concurrency (Little’s Law)" ratio={p.concurrencyUtilization} detail={`${f1(p.inFlight)} / ${f1(p.concurrencySlots)} in flight`} />
                  <Meter label="Database" ratio={p.dbUtilization} detail={`${f1(p.dbLoad)} / ${f1(c.dbCapacityOps)} ops/s`} />
                  <div className="grid grid-cols-2 gap-2"><Stat label="Cache hits/s" value={f1(p.cacheHits)} /><Stat label="Cache misses/s" value={f1(p.cacheMisses)} /></div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Queue and workers" hint="formulas 6–8">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="queue-stats">
              <Stat label="Drain rate (jobs/s)" value={f1(q.drainRate)} />
              <Stat label="Arrival avg / peak" value={`${f1(q.arrivalAvg)} / ${f1(q.arrivalPeak)}`} />
              <Stat label="Worker util avg" value={fmtRatio(q.workerUtilizationAvg)} tone={q.workerUtilizationAvg > 1 ? "bad" : "ok"} />
              <Stat label="Worker util peak" value={fmtRatio(q.workerUtilizationPeak)} tone={q.workerUtilizationPeak > 1 ? "bad" : "ok"} />
              <Stat label="Depth at peak end" value={Math.round(q.depthAtPeakEnd)} />
              <Stat label="Max depth" value={Math.round(q.maxDepth)} />
              <Stat label="Drains after peak in" value={q.secondsToDrainAfterPeak === null ? "never" : `${q.secondsToDrainAfterPeak}s`} tone={q.secondsToDrainAfterPeak === null ? "bad" : "ok"} />
              <Stat label="Behavior" value={q.drainRate >= q.arrivalPeak ? "drains" : q.workerUtilizationAvg > 1 ? "grows without bound" : "grows, then drains"} />
            </div>
            <div className="mt-3"><QueueChart series={q.series} peakEnd={c.peakDurationSec} /></div>
          </Panel>

          <Panel title="Potential bottlenecks">
            {res.bottlenecks.length === 0 ? <p className="text-sm text-emerald-300">No component reaches 85% of its modelled capacity at your inputs.</p> : (
              <ol className="space-y-1.5" data-testid="bottlenecks">{res.bottlenecks.map((b) => <li key={b.component} className="text-sm text-slate-200"><strong>{b.component}</strong> at {fmtRatio(b.utilization)} — {b.note}</li>)}</ol>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Formulas, units and limits" hint="Every figure above is computed from these">
        <ol className="space-y-3" data-testid="formulas">
          {FORMULAS.map((f, i) => (
            <li key={f.id} className="text-sm"><strong className="text-slate-100">{i + 1}. {f.name}</strong><br /><code className="rounded bg-slate-900 px-1.5 py-0.5 text-sky-200">{f.formula}</code><br /><span className="text-slate-400">Units: {f.units}. {f.note}</span></li>
          ))}
        </ol>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><h4 className="text-xs font-bold uppercase text-slate-400">Unknown variables</h4><ul className="mt-1 list-disc pl-5 text-sm text-slate-300">{UNKNOWN_VARIABLES.map((u) => <li key={u}>{u}</li>)}</ul></div>
          <div><h4 className="text-xs font-bold uppercase text-slate-400">The estimate is unreliable when…</h4><ul className="mt-1 list-disc pl-5 text-sm text-slate-300">{UNRELIABLE_WHEN.map((u) => <li key={u}>{u}</li>)}</ul></div>
        </div>
        <p className="mt-3 text-xs text-slate-400">Simplifications: steady averages, one database operation per non-cached request, 1-second queue steps, no autoscaling, no network or lock contention.</p>
      </Panel>
    </div>
  );
};
