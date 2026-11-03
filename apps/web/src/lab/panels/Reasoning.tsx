/**
 * Reasoning panel: traffic/queue simulation, latency budget, SLO error
 * budgets, resource saturation, and the cost/risk/complexity frontier.
 */

import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import type { ArchitectureModel } from "../model";
import { simulateQueue } from "../engines/traffic";
import { analyzeLatency } from "../engines/latency";
import { errorBudget, consumeBudget } from "../engines/slo";
import { saturate } from "../engines/resource";
import { monthlyCost, complexity, frontier } from "../engines/tradeoff";
import { flawedCheckoutModel } from "../samples";
import { Panel, Callout, Metric, FindingsList, OkBadge, StateBadge } from "../ui";

export const ReasoningPanel: React.FC<{ model: ArchitectureModel }> = ({ model }) => {
  const [rps, setRps] = useState(50);
  const sim = useMemo(() => simulateQueue(
    { kind: "bursty", baseRatePerSec: rps / 2, burstMultiplier: 2, burstEverySec: 20, burstDurationSec: 5, durationSec: 60, seed: 42 },
    { kind: "fixed", ms: 4000 },
    { workers: Number(model.components.find((c) => c.kind === "worker")?.config.concurrency ?? 4), queueCapacity: 5000 },
  ), [model, rps]);
  const latency = useMemo(() => analyzeLatency(model, model.operations.find((o) => o.criticality >= 4)?.id ?? model.operations[0]?.id), [model]);
  const sat = useMemo(() => saturate(model, rps), [model, rps]);
  const frontierPts = useMemo(() => frontier([model, flawedCheckoutModel()], () => []), [model]);
  const cost = useMemo(() => monthlyCost(model), [model]);

  return (
    <div>
      <Panel title="Traffic and queue dynamics" subtitle="Why average throughput is not enough: bursts, depth, utilization, drops"
        right={
          <div className="flex items-center gap-2">
            <label htmlFor="rps" className="text-xs text-slate-300">Peak rate</label>
            <input id="rps" type="range" min={5} max={120} value={rps} onChange={(e) => setRps(Number(e.target.value))}
              className="w-32" />
            <span className="text-xs font-mono text-slate-200 w-14">{rps} rps</span>
          </div>
        }>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Metric label="Arrived / processed" value={`${sim.totalArrived} / ${sim.totalProcessed}`} />
          <Metric label="Dropped" value={sim.totalDropped} hint="beyond queue capacity" />
          <Metric label="Max depth" value={sim.maxDepth} hint={`mean ${Math.round(sim.meanDepth * 10) / 10}`} />
          <Metric label="Saturation" value={sim.saturated ? "BACKLOG GROWS" : "stable"}
            hint={`p95 wait ${Math.round(sim.p95WaitMs)} ms`} />
        </div>
        <div className="h-56 rounded-lg border border-slate-700/50 bg-slate-900/60 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sim.timeline}>
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="depth" name="queue depth" stroke="#facc15" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="arrived" name="arrivals/s" stroke="#38bdf8" strokeWidth={1.4} dot={false} />
              <Line type="monotone" dataKey="utilization" name="utilization" stroke="#34d399" strokeWidth={1.4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Callout kind="honest">
          Seeded discrete-event teaching model (seed 42): {sim.assumptions[0]} {sim.assumptions[3]}
        </Callout>
      </Panel>

      <Panel title="Latency budget" subtitle={`Operation: ${latency.operationId} — deadline from declared assumptions, not measurements`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Metric label="Modeled p-critical path" value={`${latency.modeledMs} ms`} />
          <Metric label="Deadline" value={latency.deadlineMs === null ? "not declared" : `${latency.deadlineMs} ms`} />
          <Metric label="Remaining" value={latency.remainingMs === null ? "—" : `${latency.remainingMs} ms`} />
          <Metric label="Largest consumer" value={latency.largestConsumer?.componentId ?? "—"}
            hint={latency.largestConsumer ? `${Math.round(latency.largestConsumer.share * 100)}% of the path` : undefined} />
        </div>
        {latency.paths.map((p) => (
          <div key={p.nodes.join()} className="mb-2 rounded-lg border border-slate-700/50 bg-slate-900/40 p-2">
            <div className="text-xs font-semibold text-slate-100">{p.nodes.join(" -> ")}
              <span className="ml-2 text-slate-400">{p.modeledMs} ms
                {latency.missesDeadline === true && p === latency.criticalPath && <span className="ml-2 text-rose-300">deadline missed</span>}
              </span>
            </div>
            <div className="mt-1 h-3 rounded bg-slate-800 overflow-hidden flex">
              {p.hops.map((h) => (
                <div key={h.to} className="h-full bg-sky-500/70 border-r border-slate-900"
                  style={{ width: `${((h.connMs + h.procMs) / Math.max(1, p.modeledMs)) * 100}%` }}
                  title={`${h.to}: conn ${h.connMs} ms + processing ${h.procMs} ms (worst-case retries +${h.retriesWorstCaseMs} ms)`} />
              ))}
            </div>
          </div>
        ))}
        <Callout kind="honest">{latency.assumptions[0]} {latency.assumptions[2]}</Callout>
      </Panel>

      <Panel title="Reliability budgets" subtitle="Explicit SLOs with transparent error-budget math">
        <ul className="space-y-2">
          {model.slos.map((s) => {
            const b = errorBudget(s);
            const consumption = consumeBudget(model, s.componentIds[0], 43.2).find((c) => c.sloId === s.id)!;
            return (
              <li key={s.id} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-100">{s.id}</span>
                  <span className="text-slate-300">{s.kind} target {s.target}{s.unit === "percent" ? "%" : " ms"} over {s.windowDays} days</span>
                  {b.applicable ? <OkBadge /> : <StateBadge severity="info" />}
                </div>
                <p className="text-slate-400 mt-1">{b.note}</p>
                {b.applicable && (
                  <p className="text-slate-300 mt-1">
                    A 43.2-minute modeled outage of {s.componentIds[0]} loses ~{consumption.modeledLostRequests.toLocaleString()} requests
                    {" "}({consumption.verdict === "budget-exhausted" ? "budget exhausted" : `${consumption.remaining.toLocaleString()} remaining`}).
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Resource saturation" subtitle={`Little's law at ${rps} rps: the bottleneck is the constraint, scaling slack does nothing`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <Metric label="Bottleneck" value={sat.bottleneck ? `${sat.bottleneck.componentId}.${sat.bottleneck.resource}` : "—"}
            hint={sat.bottleneck ? `${Math.round(sat.bottleneck.utilization * 100)}% utilized` : undefined} />
          <Metric label="Modeled monthly cost" value={`$${cost.total}`} hint="declared assumptions, not pricing" />
          <Metric label="Complexity score" value={complexity(model).score}
            hint={`${complexity(model).deployables} deployables, ${complexity(model).stateful} stateful`} />
          <Metric label="Dominated (frontier)" value={frontierPts.filter((p) => p.dominated).length}
            hint="vs the flawed checkout fixture" />
        </div>
        <FindingsList findings={[]} emptyText={sat.explanation} />
      </Panel>
    </div>
  );
};
