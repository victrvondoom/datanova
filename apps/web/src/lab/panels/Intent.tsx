/**
 * Campaign 04, Task 06 — Intent panel: the FIRST step of the user journey.
 * Structured authoring (no LLM) → deterministic compilation → review of
 * problems, unresolved fields, and the starter model → adopt.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../model";
import { serializeModel, validateModel } from "../model";
import { compileIntent, type IntentSpecInput } from "../engines/intent-compiler";
import { extractGenome } from "../engines/genome";
import { Panel, Btn, Callout, Metric, StateBadge, OkBadge, Announcer } from "../ui";

const EXAMPLE: IntentSpecInput = {
  goal: "Let users upload documents and receive processed PDFs within a second",
  peakRps: 50,
  latencyDeadlineMs: 800,
  availabilityPercent: 99.9,
  strictReadAfterWrite: false,
  processingSeconds: 4,
  monthlyCostCapUsd: 250,
  constraints: ["Documents are sensitive business data"],
  assumptions: [{ statement: "Peak traffic is bursty (2x for up to 60s)", source: "product estimate", confidence: 0.6 }],
};

export const IntentPanel: React.FC<{ onAdopt: (m: ArchitectureModel) => void }> = ({ onAdopt }) => {
  const [spec, setSpec] = useState<IntentSpecInput>(EXAMPLE);
  const [reviewed, setReviewed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const compiled = useMemo(() => compileIntent(spec), [spec]);
  const validation = useMemo(() => validateModel(compiled.model), [compiled]);
  const genome = useMemo(() => extractGenome(compiled.model), [compiled]);

  const set = <K extends keyof IntentSpecInput>(k: K, v: IntentSpecInput[K]): void =>
    setSpec((s) => ({ ...s, [k]: v }));

  return (
    <div>
      <Announcer message={announcement} />
      <Panel title="1. Intent — what are you trying to build?"
        subtitle="Structured intent compiles deterministically into a reviewable starter architecture. Ambiguity stays visible.">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-xs text-slate-300 space-y-1 block">
            Goal
            <textarea value={spec.goal} onChange={(e) => set("goal", e.target.value)} rows={3}
              aria-label="Architecture goal"
              className="w-full rounded-md bg-slate-800 border border-slate-600 p-2 text-xs text-slate-100" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-300 space-y-1 block">
              Peak workload (rps)
              <input type="number" value={spec.peakRps ?? ""} min={1} max={100000}
                onChange={(e) => set("peakRps", e.target.value === "" ? undefined : Number(e.target.value))}
                aria-label="Peak requests per second"
                className="w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100" />
            </label>
            <label className="text-xs text-slate-300 space-y-1 block">
              Ack deadline (ms)
              <input type="number" value={spec.latencyDeadlineMs ?? ""} min={1}
                onChange={(e) => set("latencyDeadlineMs", e.target.value === "" ? undefined : Number(e.target.value))}
                aria-label="Acknowledgement deadline in milliseconds"
                className="w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100" />
            </label>
            <label className="text-xs text-slate-300 space-y-1 block">
              Availability (%)
              <input type="number" value={spec.availabilityPercent ?? ""} min={50} max={99.999} step={0.01}
                onChange={(e) => set("availabilityPercent", e.target.value === "" ? undefined : Number(e.target.value))}
                aria-label="Monthly availability target in percent"
                className="w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100" />
            </label>
            <label className="text-xs text-slate-300 space-y-1 block">
              Processing time (s)
              <input type="number" value={spec.processingSeconds ?? ""} min={0.001} step={0.5}
                onChange={(e) => set("processingSeconds", e.target.value === "" ? undefined : Number(e.target.value))}
                aria-label="Processing time per work item in seconds"
                className="w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100" />
            </label>
            <label className="text-xs text-slate-300 space-y-1 block">
              Monthly cost cap ($)
              <input type="number" value={spec.monthlyCostCapUsd ?? ""} min={0}
                onChange={(e) => set("monthlyCostCapUsd", e.target.value === "" ? undefined : Number(e.target.value))}
                aria-label="Modeled monthly cost cap in dollars"
                className="w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100" />
            </label>
            <label className="text-xs text-slate-300 flex items-center gap-2 mt-5">
              <input type="checkbox" checked={spec.strictReadAfterWrite === true}
                onChange={(e) => set("strictReadAfterWrite", e.target.checked)}
                aria-label="Require strict read-after-write for results" />
              Results read-after-write
            </label>
          </div>
        </div>
        <label className="text-xs text-slate-300 space-y-1 block mt-3">
          Constraints (one per line)
          <textarea value={spec.constraints.join("\n")} rows={2}
            onChange={(e) => set("constraints", e.target.value.split("\n").filter((l) => l.trim().length > 0))}
            aria-label="Hard constraints, one per line"
            className="w-full rounded-md bg-slate-800 border border-slate-600 p-2 text-xs text-slate-100" />
        </label>
        <div className="flex gap-2 mt-3">
          <Btn
            aria-label="Compile and review intent"
            onClick={() => {
              const compiled = compileIntent(spec);
              setReviewed(true);
              setAnnouncement(
                `Intent compiled: ${compiled.problems.length} problem(s), ` +
                `${compiled.model.requirements.filter((r) => r.acceptance.includes("UNRESOLVED")).length} unresolved field(s).`,
              );
            }}
          >Compile and review intent</Btn>
          <Btn onClick={() => { setSpec(EXAMPLE); setReviewed(false); }}>Reset to example</Btn>
        </div>
      </Panel>

      {reviewed && (
        <>
          <Panel title="Intent review" subtitle="Problems are classified; nothing is guessed away">
            <ul className="space-y-1 mb-3">
              {compiled.problems.length === 0 && (
                <li className="flex items-center gap-2"><OkBadge /><span className="text-xs text-slate-300">No intent problems detected.</span></li>
              )}
              {compiled.problems.map((p, i) => (
                <li key={i} className="text-xs">
                  <StateBadge severity={p.kind === "contradictory" || p.kind === "invalid" ? "critical" : "warning"} />
                  <span className="ml-2 font-mono text-[11px] uppercase text-slate-400">{p.kind}</span>
                  <span className="ml-1 text-slate-300">{p.detail}</span>
                </li>
              ))}
            </ul>
            {compiled.unresolved.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Unresolved fields (you must decide)</div>
                <ul className="space-y-0.5 mb-2">
                  {compiled.unresolved.map((u, i) => <li key={i} className="text-[11px] text-amber-200">— {u}</li>)}
                </ul>
              </>
            )}
            <Callout kind="honest">
              The starter model is a deterministic compilation of your intent — review it below, then adopt it
              as the working architecture (or keep your current one). Adopting replaces the current model in your browser.
            </Callout>
          </Panel>

          <Panel title="Compiled starter architecture"
            subtitle={`${compiled.model.name} — genome ${genome.fingerprint}`}
            right={<div className="flex gap-2">
              <Metric label="Components" value={compiled.model.components.length} />
              <Metric label="Requirements" value={compiled.model.requirements.length} />
              <Btn onClick={() => onAdopt(JSON.parse(serializeModel(compiled.model)) as ArchitectureModel)}>
                Adopt as my architecture
              </Btn>
            </div>}>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Components</div>
                {compiled.model.components.map((c) => (
                  <div key={c.id} className="text-[11px] text-slate-300">
                    <span className="font-semibold text-slate-100">{c.name}</span> ({c.kind})
                    {c.purpose ? <span className="text-slate-500"> — {c.purpose}</span> : null}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Compiled requirements</div>
                {compiled.model.requirements.map((r) => (
                  <div key={r.id} className="text-[11px] text-slate-300 mb-1">
                    <span className="font-mono text-slate-400">{r.id}</span> [{r.kind}/{r.category}] {r.statement}
                    <span className="text-slate-500"> — accepted when: {r.acceptance}</span>
                  </div>
                ))}
              </div>
            </div>
            {validation.length > 0 && (
              <p className="text-[11px] text-rose-300 mt-2">Validation problems: {validation.map((v) => `${v.path}: ${v.message}`).join("; ")}</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};
