/**
 * Overview panel: architecture canvas (zone layout), intent coverage, and
 * grounded component explanations at the learner's level.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../model";
import { topologySummary, topologySummaryText } from "../engines/nonvisual";
import { analyzeIntent, coverageMap } from "../engines/intent";
import { explainComponent } from "../engines/explain";
import { analyzeConstraints } from "../engines/constraints";
import { extractGenome } from "../engines/genome";
import { modeConfig, type LearningMode } from "../engines/modes";
import { Panel, FindingsList, Callout, Metric, EvidenceChips } from "../ui";

const KIND_COLOR: Record<string, string> = {
  client: "bg-indigo-500/20 border-indigo-400/50",
  gateway: "bg-cyan-500/20 border-cyan-400/50",
  service: "bg-emerald-500/20 border-emerald-400/50",
  worker: "bg-teal-500/20 border-teal-400/50",
  queue: "bg-amber-500/20 border-amber-400/50",
  cache: "bg-yellow-500/20 border-yellow-400/50",
  database: "bg-rose-500/20 border-rose-400/50",
  objectstore: "bg-rose-500/20 border-rose-400/50",
  broker: "bg-fuchsia-500/20 border-fuchsia-400/50",
  analytics: "bg-violet-500/20 border-violet-400/50",
  external: "bg-slate-500/20 border-slate-400/50",
};

/** Canvas: components grouped into trust-zone columns; edges drawn as SVG lines. */
const NO_ZONE = { id: "none", name: "(no zone)", trust: "none" } as const;

const Canvas: React.FC<{ model: ArchitectureModel }> = ({ model }) => {
  const zones = useMemo(() => [NO_ZONE, ...model.zones], [model.zones]);
  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    zones.forEach((z, zi) => {
      model.components
        .filter((c) => (c.zoneId ?? "none") === z.id)
        .forEach((c, ci) => pos.set(c.id, { x: 40 + zi * 210, y: 60 + ci * 74 }));
    });
    return pos;
  }, [model, zones]);
  const width = 40 + zones.length * 210;
  const height = 80 + Math.max(0, ...zones.map((z) =>
    model.components.filter((c) => (c.zoneId ?? "none") === z.id).length)) * 74;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/50 bg-slate-900/60 p-2" role="img"
      aria-label={`Architecture canvas: ${model.components.length} components across ${model.zones.length} trust zones`}>
      <svg width={width} height={height} className="min-w-full">
        {zones.map((z, zi) => (
          <text key={z.id} x={40 + zi * 210} y={22} fill="#94a3b8" fontSize={11} fontWeight={700}>
            {z.name}
          </text>
        ))}
        {model.connections.map((cn) => {
          const a = layout.get(cn.from); const b = layout.get(cn.to);
          if (!a || !b) return null;
          const stroke = cn.kind === "sync" ? "#f472b6" : cn.kind === "async" ? "#facc15" : "#38bdf8";
          return (
            <line key={cn.id} x1={a.x + 150} y1={a.y + 22} x2={b.x} y2={b.y + 22}
              stroke={stroke} strokeWidth={cn.criticality >= 4 ? 2.2 : 1.2}
              strokeDasharray={cn.failureBehavior === "isolated" ? "5 4" : undefined} opacity={0.75}>
              <title>{`${cn.from} -> ${cn.to} (${cn.kind}, ${cn.failureBehavior})`}</title>
            </line>
          );
        })}
        {model.components.map((c) => {
          const p = layout.get(c.id); if (!p) return null;
          return (
            <g key={c.id}>
              <rect x={p.x} y={p.y} width={150} height={44} rx={8}
                className={KIND_COLOR[c.kind] ?? "bg-slate-500/20 border-slate-400/50"}
                stroke="currentColor" fillOpacity={0.15} />
              <text x={p.x + 10} y={p.y + 18} fill="#f1f5f9" fontSize={11} fontWeight={700}>{c.name}</text>
              <text x={p.x + 10} y={p.y + 33} fill="#94a3b8" fontSize={9}>{c.kind}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
        <span><span className="inline-block w-3 h-0.5 bg-pink-400 align-middle" /> sync</span>
        <span><span className="inline-block w-3 h-0.5 bg-yellow-400 align-middle" /> async</span>
        <span><span className="inline-block w-3 h-0.5 bg-sky-400 align-middle" /> event</span>
        <span>dashed = isolated</span>
      </div>
    </div>
  );
};

export const OverviewPanel: React.FC<{ model: ArchitectureModel; mode: LearningMode }> = ({ model, mode }) => {
  const findings = useMemo(() => analyzeIntent(model), [model]);
  const constraints = useMemo(() => analyzeConstraints(model), [model]);
  const genome = useMemo(() => extractGenome(model), [model]);
  const coverage = useMemo(() => coverageMap(model), [model]);
  const cfg = modeConfig(mode);
  const [selected, setSelected] = useState<string>("work-queue");
  const explanation = useMemo(
    () => explainComponent(model, selected, cfg.explanationLevel), [model, selected, cfg.explanationLevel]);

  const covered = model.requirements.filter((r) => coverage[r.id]).length;

  return (
    <div>
      <Panel title="Architecture canvas" subtitle={`${model.name} — components grouped by trust zone; edges colored by communication style`}
        right={<span className="text-[10px] font-mono text-slate-400">genome {genome.fingerprint}</span>}>
        <Canvas model={model} />
        <Callout kind="honest">
          Modeled architecture. Simulations and scores derived from it are educational models with declared assumptions —
          never production measurements or load tests.
        </Callout>
      </Panel>

      {/*
        Campaign 05, Task 03 — nonvisual representation: the same topology the
        canvas draws, as readable text (screen-reader users get the same
        information the diagram shows; nothing is color-only).
      */}
      <Panel title="Nonvisual architecture summary" subtitle="The same topology as text — what a screen reader can read">
        <details>
          <summary className="text-xs text-slate-300 cursor-pointer">
            {topologySummary(model).overview} — expand for the full description
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {topologySummaryText(topologySummary(model)).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
      </Panel>

      <Panel title="Intent coverage" subtitle="Why does this architecture exist? Trace every decision back to a requirement."
        right={<div className="flex gap-2"><Metric label="Requirements covered" value={`${covered}/${model.requirements.length}`} /></div>}>
        <FindingsList findings={findings} emptyText="Every requirement is mapped and every component has a documented purpose." />
      </Panel>

      <Panel title="Constraints and assumptions" subtitle="Missing context and unverified assumptions are surfaced before recommendations">
        <FindingsList findings={constraints} emptyText="All constraint categories are covered and no conflicts detected." />
      </Panel>

      <Panel title="Why does this component exist?" subtitle={`Explanations at ${cfg.explanationLevel} level (${mode} mode) — grounded in the model`}>
        <div className="flex flex-wrap gap-2 mb-3">
          {model.components.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className={`rounded-md px-2 py-1 text-xs border transition-colors ${selected === c.id
                ? "border-sky-400 bg-sky-500/20 text-sky-200"
                : "border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"}`}>
              {c.name}
            </button>
          ))}
        </div>
        {explanation ? (
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
            <p className="text-xs text-slate-200 leading-relaxed">{explanation.text}</p>
            {explanation.supportsRequirements.length > 0 && (
              <ul className="mt-2 text-[11px] text-slate-300">
                {explanation.supportsRequirements.map((r) => (
                  <li key={r.id}><span className="font-mono text-slate-400">{r.id}</span> {r.statement}
                    <span className="text-slate-500"> — accepted when: {r.acceptance}</span></li>
                ))}
              </ul>
            )}
            {explanation.tradeoffs.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-400">Trade-offs: {explanation.tradeoffs[0]}</p>
            )}
            <EvidenceChips evidence={explanation.sources.map((s) => ({ ref: s, detail: "explanation source" }))} />
          </div>
        ) : <p className="text-xs text-slate-400">Select a component.</p>}
      </Panel>
    </div>
  );
};
