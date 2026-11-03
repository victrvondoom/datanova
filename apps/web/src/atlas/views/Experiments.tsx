/**
 * Atlas — Experiments console (Task 25): scenario selection, configuration,
 * execution states, and results — driven by the real scenario engine.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../../lab/model";
import { scenarioTemplate, runScenario, validateScenario, cloneScenario, type Scenario } from "../../lab/engines/scenario";
import { extractGenome } from "../../lab/engines/genome";
import { recoveryTimeline, recoveryBottlenecks } from "../../lab/engines/recovery-timeline";
import { causalFindings } from "../../lab/engines/causal";
import { blastRadius } from "../../lab/engines/blastradius";
import { AMetric, APanel, AButton, ASelect, AAnnouncer, ABadge } from "../ui";

const TEMPLATES = ["peak-hour-outage", "burst-overload", "dependency-brownout"] as const;

export const ExperimentsView: React.FC<{ model: ArchitectureModel; setAnnounce: (m: string) => void }> = ({ model, setAnnounce }) => {
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]>("burst-overload");
  const [peakRps, setPeakRps] = useState(120);
  const [run, setRun] = useState<{ scenario: Scenario; summary: string; expectationResults: { expectationId: string; outcome: string; detail: string }[]; recording: Parameters<typeof recoveryTimeline>[1] } | null>(null);
  const [cloned, setCloned] = useState<Scenario | null>(null);

  const draft = useMemo(() => scenarioTemplate(template, model, peakRps), [template, model, peakRps]);
  const active = cloned ?? draft;
  const validation = useMemo(() => validateScenario(model, active), [model, active]);
  const fingerprint = useMemo(() => extractGenome(model).fingerprint, [model]);

  const execute = (): void => {
    if (!validation.valid) { setAnnounce(`Scenario invalid: ${validation.problems.join("; ")}`); return; }
    const result = runScenario(model, active);
    setRun({
      scenario: active,
      summary: `${active.name}: ${result.allPassed ? "ALL PASS" : "FAILURES"} — ${result.expectationResults.filter((r) => r.outcome === "pass").length}/${result.expectationResults.length} expectations`,
      expectationResults: result.expectationResults,
      recording: result.faults.recording,
    });
    setAnnounce(`Scenario executed: ${result.expectationResults.filter((r) => r.outcome === "pass").length}/${result.expectationResults.length} expectations pass.`);
  };

  const timeline = run ? recoveryTimeline(model, run.recording) : null;
  const bottlenecks = timeline ? recoveryBottlenecks(timeline) : [];
  const causal = useMemo(() => causalFindings(model, { componentId: model.components.find((c) => c.kind === "database")?.id ?? model.components[0].id, fault: "down" }), [model]);
  const br = useMemo(() => blastRadius(model, model.components.find((c) => c.kind === "database")?.id ?? model.components[0].id, "down"), [model]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <AAnnouncer message="" />
      <header className="mb-4">
        <h1 className="text-lg font-black text-slate-100">Experiments</h1>
        <p className="text-xs text-slate-400">Deterministic scenario engine on <strong>{model.name}</strong> — fingerprint {fingerprint}. Every result is a model outcome, never production telemetry.</p>
      </header>

      <APanel title="Scenario configuration" subtitle="Templates are bound to the architecture fingerprint; cloning re-targets them">
        <div className="grid gap-3 md:grid-cols-3 mb-2">
          <label className="text-xs text-slate-300 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Template</span>
            <ASelect value={template} onChange={(e) => { setTemplate(e.target.value as never); setCloned(null); }} aria-label="Scenario template">
              {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
            </ASelect>
          </label>
          <label className="text-xs text-slate-300 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Peak requests/second</span>
            <input type="number" min={1} max={10000} value={peakRps} aria-label="Peak requests per second"
              onChange={(e) => setPeakRps(Number(e.target.value) || 1)}
              className="w-full rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-100" />
          </label>
          <div className="flex items-end gap-2">
            <AButton variant="primary" onClick={execute} disabled={!validation.valid}>Run scenario</AButton>
            <AButton onClick={() => { const c = cloneScenario(active, model); setCloned(c); setAnnounce("Scenario cloned and re-targeted onto this architecture."); }}>
              Clone
            </AButton>
            <AButton onClick={() => { setRun(null); setCloned(null); setAnnounce("Experiment reset — no stale results remain."); }}>Reset</AButton>
          </div>
        </div>
        <p className="text-[11px]">
          {validation.valid
            ? <ABadge status="ok" label={`valid — ${active.expectations.length} expectation(s), ${active.faults.length} fault step(s)`} />
            : <ABadge status="bad" label={`invalid: ${validation.problems.join("; ")}`} />}
          {" "}
          {cloned && <ABadge status="info" label="cloned scenario active" />}
        </p>
      </APanel>

      {run ? (
        <>
          <APanel title="Results" subtitle={run.summary}
            right={<ABadge status={run.expectationResults.every((r) => r.outcome === "pass") ? "ok" : "bad"}
              label={`${run.expectationResults.filter((r) => r.outcome === "pass").length}/${run.expectationResults.length} pass`} />}>
            <ul className="text-xs space-y-1">
              {run.expectationResults.map((r) => (
                <li key={r.expectationId}>
                  <span className={r.outcome === "pass" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>[{r.outcome}]</span> {r.expectationId}: {r.detail}
                </li>
              ))}
            </ul>
          </APanel>

          <div className="grid gap-3 lg:grid-cols-2">
            <APanel title="Failure propagation (causal engine)" subtitle="Deterministic model of the injected fault">
              <ul className="text-xs space-y-1">
                {causal.map((f, i) => <li key={i}><ABadge status={f.severity === "critical" ? "bad" : "warn"} label={f.severity} /> {f.title}</li>)}
                {causal.length === 0 && <li className="text-slate-500">No modeled downstream effects.</li>}
              </ul>
            </APanel>
            <APanel title="Recovery timeline (recovery-timeline engine)" subtitle="State reconstruction from the recorded run">
              {timeline && (
                <>
                  <p className="text-xs text-slate-300 mb-1">
                    {timeline.finalSummary.recovered} recovered · {timeline.finalSummary.stalled} stalled · {timeline.finalSummary.reFaulted} re-faulted
                  </p>
                  <ul className="text-xs space-y-0.5 text-slate-400">
                    {timeline.components.slice(0, 8).map((c) => <li key={c.componentId}>{c.componentId}: {c.finalPhase}</li>)}
                  </ul>
                  {bottlenecks.length > 0 && (
                    <p className="text-[11px] text-amber-300 mt-1">Bottlenecks: {bottlenecks.map((b) => b.componentId).join(", ")}</p>
                  )}
                </>
              )}
            </APanel>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <AMetric label="Impacted operations" value={br.impactedOperations.length} hint="blast-radius engine" />
            <AMetric label="Affected components" value={br.affectedComponents.length} hint="down + degraded" />
            <AMetric label="Causal findings" value={causal.length} hint="deterministic rules" />
          </div>
        </>
      ) : (
        <APanel title="No results yet" subtitle="Configure and run a scenario — results, propagation, and recovery appear here from the real engines.">
          <div className="grid gap-3 md:grid-cols-3">
            <AMetric label="Deterministic" value="yes" hint="identical inputs → identical results" />
            <AMetric label="Engine" value="scenario v1" hint="workload + fault plan composition" />
            <AMetric label="Telemetry claim" value="none" hint="model outputs only — never production data" />
          </div>
        </APanel>
      )}
    </div>
  );
};
