/**
 * Experiments panel: chaos experiment designer, flight-recorder replay,
 * mutation workspace, counterfactual comparison, and reproducible packages.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel, Finding } from "../model";
import { fromTemplate, runChaos, TEMPLATES } from "../engines/chaos";
import { stateAt, windowEvents } from "../engines/flightrecorder";
import { addIdempotency, addRetryPolicy, makeAsync, type MutationResult } from "../engines/mutations";
import { runExperiment } from "../engines/counterfactual";
import { exportPackage, parsePackage, reproducePackage } from "../engines/package";
import { scenarioTemplate, runScenario, type ScenarioTemplateId as TemplateId } from "../engines/scenario";
import { recoveryTimeline, recoveryBottlenecks } from "../engines/recovery-timeline";
import { Panel, FindingsList, Callout, Metric, Btn, StateBadge } from "../ui";

export const ExperimentsPanel: React.FC<{
  model: ArchitectureModel;
  onAdoptModel: (m: ArchitectureModel) => void;
}> = ({ model, onAdoptModel }) => {
  const [template, setTemplate] = useState("component-failure");
  const [target, setTarget] = useState("meta-db");
  const [expected, setExpected] = useState<string[]>(["op-upload", "op-process", "op-status", "op-report", "op-delete"]);
  const chaos = useMemo(() => runChaos(model, fromTemplate("cx-live", template, target, expected)), [model, template, target, expected]);
  const [replaySeq, setReplaySeq] = useState(1);
  const totalEvents = chaos.recording.events.length;
  const replayState = useMemo(() => stateAt(chaos.recording, replaySeq), [chaos, replaySeq]);
  const window = useMemo(() => windowEvents(chaos.recording, replaySeq, replaySeq + 4), [chaos, replaySeq]);

  const [mutation, setMutation] = useState<MutationResult | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>("peak-hour-outage");
  const [scenarioRun, setScenarioRun] = useState<ReturnType<typeof runScenario> | null>(null);
  const [pkgText, setPkgText] = useState("");
  const [pkgNote, setPkgNote] = useState("");

  const counterfactual = useMemo(() => mutation
    ? runExperiment({
      id: "cf-live", label: "mutation comparison",
      baseline: model, modified: mutation.model,
      scenario: { id: "sc", name: "same scenario for both", description: "identical modeled conditions" },
      declaredChanges: ["idempotencyCoverage", "retryCoverage", "asyncEdges", "isolationScore"],
    })
    : null, [model, mutation]);

  const adoptMutation = (): void => {
    if (mutation) onAdoptModel(mutation.model);
    setMutation(null);
  };

  const exportCurrent = (): void => {
    const pkg = exportPackage(model, chaos.experiment, {
      packageId: `pkg-${Date.now()}`, label: "live experiment", createdAt: new Date().toISOString(), seed: 42,
    });
    setPkgText(JSON.stringify(pkg, null, 2));
    setPkgNote("Package exported. Copy it to share; anyone can reproduce the modeled result.");
  };

  const importAndReproduce = (): void => {
    try {
      const parsed = parsePackage(pkgText);
      const result = reproducePackage(parsed);
      setPkgNote(`Reproduced: verdict=${result.verdict}, impacted=[${result.observedImpactedOperations.join(", ")}], deterministic=${result.deterministic}.`);
    } catch (e) {
      setPkgNote(`Import rejected: ${(e as Error).message}`);
    }
  };

  const mutationFindings: Finding[] = mutation
    ? [{ id: "mutation", severity: "info", source: "mutation", title: mutation.explanation.operator,
        detail: `${mutation.explanation.problem} ${mutation.explanation.structuralChange} Benefit: ${mutation.explanation.expectedBenefit}`,
        evidence: mutation.explanation.tradeoffs.map((t, i) => ({ ref: `trade-off ${i + 1}`, detail: t })) }]
    : [];

  return (
    <div>
      <Panel title="Chaos experiment designer" subtitle="Hypothesis, controlled conditions, observation, stop condition — then an honest verdict">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select value={template} onChange={(e) => setTemplate(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100">
            {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
          </select>
          <select value={target} onChange={(e) => setTarget(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100">
            {model.components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-[11px] text-slate-400">expected impact:</span>
          {model.operations.map((o) => (
            <label key={o.id} className="inline-flex items-center gap-1 text-[11px] text-slate-300">
              <input type="checkbox" checked={expected.includes(o.id)}
                onChange={(e) => setExpected((prev) => e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id))} />
              {o.name}
            </label>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mb-2">Hypothesis: {chaos.experiment.hypothesis}</p>
        <div className="flex items-center gap-2 mb-3">
          <StateBadge severity={chaos.verdict === "supported" ? "info" : chaos.verdict === "invalid" ? "critical" : "warning"} />
          <span className="text-xs font-bold text-slate-100">Verdict: {chaos.verdict.toUpperCase()}</span>
        </div>
        <ul className="text-[11px] text-slate-300 space-y-0.5 mb-2">
          {chaos.reviewNotes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
        <FindingsList findings={chaos.findings} />
      </Panel>

      <Panel title="Architecture flight recorder" subtitle="Replay the recorded events step by step — the state at any point is reproducible"
        right={<div className="flex items-center gap-2">
          <label htmlFor="replay" className="text-[11px] text-slate-300">seq {replaySeq}/{Math.max(1, totalEvents)}</label>
          <input id="replay" type="range" min={1} max={Math.max(1, totalEvents)} value={replaySeq}
            onChange={(e) => setReplaySeq(Number(e.target.value))} className="w-40" />
          <Btn onClick={() => setReplaySeq(Math.max(1, totalEvents))}>Skip to end</Btn>
          <Btn onClick={() => setReplaySeq(1)}>Reset</Btn>
        </div>}>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Modeled state at seq {replayState.lastSeq}</div>
            <ul className="text-[11px] font-mono text-slate-300 space-y-0.5">
              {Object.entries(replayState.statuses).map(([id, s]) => (
                <li key={id}>{id}: <span className={s === "down" ? "text-rose-300" : s === "degraded" ? "text-amber-300" : "text-emerald-300"}>{s}</span></li>
              ))}
              {Object.keys(replayState.statuses).length === 0 && <li>(no status changes yet)</li>}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Next events in the log</div>
            <ul className="text-[11px] font-mono text-slate-300 space-y-0.5">
              {window.map((e) => <li key={e.seq}>#{e.seq} [{e.type}] {e.detail}</li>)}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel title="Mutation workspace" subtitle="Generate an explainable alternative WITHOUT modifying the original">
        <div className="flex flex-wrap gap-2 mb-3">
          <Btn onClick={() => setMutation(addIdempotency(model, "upload-svc"))}>Add idempotency (upload-svc)</Btn>
          <Btn onClick={() => setMutation(addRetryPolicy(model, "gateway", 3, "backoff"))}>Add retries (gateway)</Btn>
          <Btn onClick={() => setMutation(makeAsync(model, "cn-cache-db"))}>Make cache read async</Btn>
        </div>
        <FindingsList findings={mutationFindings} emptyText="Generate a mutation to compare architectures." />
        {mutation && (
          <div className="mt-3">
            <FindingsList findings={counterfactual ? [] : []} />
            {counterfactual && (
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs space-y-1">
                <div className="flex flex-wrap gap-2">
                  <Metric label="Controlled?" value={counterfactual.uncontrolledChanges.length === 0 ? "yes" : "UNCONTROLLED changes"} />
                  <Metric label="Genome deltas" value={counterfactual.genomeDeltas.length} />
                  <Metric label="Reproducible" value={counterfactual.reproducible ? "yes" : "no"} />
                </div>
                {counterfactual.explanation.map((e, i) => <p key={i} className="text-slate-300">{e}</p>)}
                {counterfactual.uncertainties.map((u, i) => <p key={i} className="text-slate-500">{u}</p>)}
                <div className="flex gap-2 mt-2">
                  <Btn onClick={adoptMutation}>Adopt as the current architecture</Btn>
                  <Btn onClick={() => setMutation(null)}>Discard</Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Scenario runner" subtitle="Versioned workload + fault scenarios bound to this architecture's genome"
        right={
          <div className="flex items-center gap-2">
            <label htmlFor="scenario-template" className="text-xs text-slate-300">Template</label>
            <select id="scenario-template" value={templateId}
              onChange={(e) => setTemplateId(e.target.value as TemplateId)}
              className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100">
              <option value="peak-hour-outage">Peak-hour outage</option>
              <option value="burst-overload">Burst overload</option>
              <option value="dependency-brownout">Dependency brownout</option>
            </select>
            <Btn onClick={() => setScenarioRun(runScenario(model, scenarioTemplate(templateId, model, 50)))}>
              Run scenario
            </Btn>
          </div>
        }>
        {scenarioRun === null ? (
          <p className="text-xs text-slate-400">
            Pick a template and run it: the workload simulation, fault plan, and expectation review all execute
            deterministically against the current architecture.
          </p>
        ) : (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <Metric label="Arrived / processed" value={`${scenarioRun.workload.totalArrived} / ${scenarioRun.workload.totalProcessed}`} />
              <Metric label="Dropped" value={scenarioRun.workload.totalDropped} />
              <Metric label="Expectations" value={`${scenarioRun.expectationResults.filter((r) => r.outcome === "pass").length}/${scenarioRun.expectationResults.length} pass`} />
              <Metric label="Deterministic" value={scenarioRun.deterministic ? "yes" : "no"} />
            </div>
            <ul className="space-y-1 mb-3">
              {scenarioRun.expectationResults.map((r) => (
                <li key={r.expectationId} className="text-[11px]">
                  <StateBadge severity={r.outcome === "pass" ? "info" : "critical"} />
                  <span className={`ml-2 font-mono font-bold ${r.outcome === "pass" ? "text-emerald-300" : "text-rose-300"}`}>
                    [{r.outcome}]
                  </span>
                  <span className="ml-1 font-mono text-slate-400">{r.kind}</span>
                  <span className="ml-1 text-slate-300">{r.detail}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Recovery timeline (folded from the recording)</div>
              {(() => {
                const tl = recoveryTimeline(model, scenarioRun.faults.recording);
                const bottlenecks = recoveryBottlenecks(tl);
                return (
                  <div>
                    {tl.components.length === 0 && <p className="text-[11px] text-slate-400">No faults were injected by this scenario.</p>}
                    {tl.components.map((c) => (
                      <p key={c.componentId} className="text-[11px] text-slate-300">
                        <span className="font-mono text-slate-400">{c.componentId}</span>: {c.finalPhase}
                        <span className="text-slate-500"> ({c.steps.map((st) => st.phase).join(" → ")})</span>
                      </p>
                    ))}
                    {bottlenecks.map((b) => (
                      <p key={b.componentId} className="text-[11px] text-amber-200">
                        Bottleneck {b.componentId}: {b.reason} {"—"} {b.unblockingAction}
                      </p>
                    ))}
                    {tl.anomalies.map((a, i) => (
                      <p key={i} className="text-[11px] text-rose-300">Anomaly #{a.seq}: {a.problem}</p>
                    ))}
                  </div>
                );
              })()}
            </div>
            <Callout kind="honest">{scenarioRun.assumptions[scenarioRun.assumptions.length - 1]}</Callout>
          </div>
        )}
      </Panel>

      <Panel title="Reproducible experiment package" subtitle="Share the experiment: import, run, compare — identical inputs give identical outputs">
        <div className="flex gap-2 mb-2">
          <Btn onClick={exportCurrent}>Export current experiment</Btn>
          <Btn onClick={importAndReproduce} disabled={!pkgText}>Import + reproduce</Btn>
        </div>
        {pkgNote && <Callout kind="honest">{pkgNote}</Callout>}
        <textarea value={pkgText} onChange={(e) => setPkgText(e.target.value)}
          placeholder="Paste a package JSON here to reproduce it…"
          className="mt-2 w-full h-40 rounded-md bg-slate-900 border border-slate-600 p-2 text-[11px] font-mono text-slate-200"
          aria-label="Experiment package JSON" />
      </Panel>
    </div>
  );
};
