/**
 * Capstone panel: the full System Design Flight Lab lifecycle and the
 * benchmark report.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../model";
import { runCapstone } from "../engines/capstone";
import { runBenchmark, renderBenchmarkReport } from "../engines/benchmark";
import { recordRevision } from "../engines/mission";
import { Panel, Callout, Metric, Btn, EvidenceChips } from "../ui";

export const CapstonePanel: React.FC<{ model: ArchitectureModel }> = ({ model: _model }) => {
  const [runAt, setRunAt] = useState<string | null>(null);
  const capstone = useMemo(
    () => runCapstone({
      generatedAt: runAt ?? "not yet run",
      benchmarkLimitations: ["critic-only corpus", "ground truth reflects the documented rule set"],
      revisions: recordRevision([], "after-first-analysis", "scaled workers", "MC-5 doubled peak traffic"),
    }), [runAt]);
  const benchmark = useMemo(() => runBenchmark(null, runAt ?? "not yet run"), [runAt]);
  const [exported, setExported] = useState("");

  return (
    <div>
      <Panel title="System Design Flight Lab" subtitle="Design -> challenge assumptions -> observe failures -> compare alternatives -> evidence-backed report"
        right={<div className="flex gap-2">
          <Btn onClick={() => setRunAt(new Date().toISOString())}>Run the capstone lifecycle</Btn>
          <Btn onClick={() => setExported(JSON.stringify(capstone.evidence, null, 2))}>Export evidence package</Btn>
        </div>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Metric label="Architecture" value={capstone.evidence.architectureSummary.name}
            hint={`${capstone.evidence.architectureSummary.components} components, ${capstone.evidence.architectureSummary.connections} connections`} />
          <Metric label="Intelligence findings" value={capstone.intelligence.totalFindings} hint="across all engines" />
          <Metric label="Improvements applied" value={capstone.improvement.improvements.length} />
          <Metric label="Counterfactual reproducible" value={capstone.improvement.counterfactualIsReproducible ? "yes" : "no"} />
        </div>

        {runAt && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">Requirement coverage</h4>
              <p className="text-xs text-slate-300">
                Covered: {capstone.evidence.requirementCoverage.covered.join(", ")} —
                uncovered: {capstone.evidence.requirementCoverage.uncovered.join(", ") || "none"}
              </p>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mt-3 mb-1">ADRs on record</h4>
              {capstone.evidence.adrs.map((a) => (
                <p key={a.id} className="text-[11px] text-slate-300"><span className="font-mono text-slate-400">{a.id}</span> {a.title}</p>
              ))}
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mt-3 mb-1">Assumptions (with status)</h4>
              {capstone.evidence.assumptions.map((a) => (
                <p key={a.id} className="text-[11px] text-slate-300">
                  <span className="font-mono text-slate-400">{a.id}</span> [{a.status}] {a.statement}
                </p>
              ))}
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mt-3 mb-1">Top risks</h4>
              {capstone.evidence.risks.map((r) => (
                <p key={r.id} className="text-[11px] text-slate-300">{r.title}</p>
              ))}
            </div>

            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">Experiment results</h4>
              <p className="text-[11px] text-slate-300">
                Recorded events: {capstone.evidence.experimentResults.recordedEvents};
                reproducible: {String(capstone.evidence.experimentResults.reproducible)}
              </p>
              {capstone.evidence.experimentResults.counterfactualExplanation.map((e, i) => (
                <p key={i} className="text-[11px] text-slate-400">{e}</p>
              ))}
            </div>

            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">Open questions and limitations</h4>
              {capstone.evidence.openQuestions.map((q, i) => <p key={i} className="text-[11px] text-amber-200">{q}</p>)}
              {capstone.evidence.benchmarkLimitations.map((l, i) => <p key={i} className="text-[11px] text-slate-400">Limitation: {l}</p>)}
              <EvidenceChips evidence={capstone.evidence.recoveryEvidence.map((d) => ({
                ref: d.dimension, detail: `score ${d.score} (${d.uncertainty})`,
              }))} />
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Intelligence benchmark" subtitle="Reasoning quality measured against a ground-truth corpus — executed, not invented"
        right={<span className="text-[10px] text-slate-400">
          precision {benchmark.summary.precision} / recall {benchmark.summary.recall}
        </span>}>
        <pre className="max-h-72 overflow-auto rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap">
          {renderBenchmarkReport(benchmark)}
        </pre>
        <Callout kind="honest">
          Benchmark metrics come from running the critic against the corpus in this session.
          Changing validation rules requires re-running the suite and updating the ground truth with the change.
        </Callout>
      </Panel>

      {exported && (
        <Panel title="Evidence package export" subtitle="Copy this JSON to share the reproducible evidence package">
          <textarea readOnly value={exported}
            className="w-full h-40 rounded-md bg-slate-900 border border-slate-600 p-2 text-[10px] font-mono text-slate-200"
            aria-label="Evidence package JSON" />
        </Panel>
      )}
    </div>
  );
};
