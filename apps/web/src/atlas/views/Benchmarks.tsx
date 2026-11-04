/**
 * Atlas — Benchmarks (Task 33): the benchmark v2 + validity intelligence
 * dashboard. Values come from the real benchmark run and registries —
 * including the honest counts of synthetic vs grounded vs human-reviewed.
 */

import React, { useMemo, useState } from "react";
import { runBenchmarkV2, renderBenchmarkV2Report } from "../../lab/engines/benchmark2";
import { classifyV2Corpus, groundedCorpus, evaluateGroundedCorpus, scoringTraces, reconstructSummary, externalValidationReport } from "../../lab/engines/benchvalid";
import { runCounterexamples, buildCounterexamples } from "../../lab/engines/counterexamples";
import { critiqueArchitecture } from "../../lab/engines/critic";
import { AMetric, APanel, ABadge } from "../ui";
import { flawedCheckoutModel, docflowModel } from "../../lab/samples";
import { runSpatialBenchmarks } from "../benchmark";

export const BenchmarksView: React.FC = () => {
  const run = useMemo(() => runBenchmarkV2(new Date(0).toISOString()), []);
  const synthetic = useMemo(() => classifyV2Corpus(run), [run]);
  const grounded = useMemo(() => groundedCorpus(), []);
  const groundedEval = useMemo(() => evaluateGroundedCorpus(), []);
  const traces = useMemo(() => scoringTraces(run), [run]);
  const reconstructed = useMemo(() => reconstructSummary(traces), [traces]);
  const report = useMemo(() => externalValidationReport(run, []), [run]);
  const challenges = useMemo(() => runCounterexamples(buildCounterexamples()), []);
  const spatialResults = useMemo(() => runSpatialBenchmarks(), []);
  const [selectedCase, setSelectedCase] = useState<string>("");
  const caseTrace = traces.find((t) => t.scenarioId === selectedCase);

  return (
    <div className="h-full overflow-y-auto p-4">
      <header className="mb-4">
        <h1 className="text-lg font-black text-slate-100">Benchmarks</h1>
        <p className="text-xs text-slate-400">
          Architecture intelligence benchmark v2 — eight dimensions, honest provenance classifications,
          reconstructable scoring, and a validity dashboard that never exaggerates maturity.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <AMetric label="Synthetic cases" value={synthetic.length} hint="authored with the rule set — self-consistency" />
        <AMetric label="Grounded cases" value={grounded.length} hint="facts cite the source registry" />
        <AMetric label="Human-reviewed cases" value={report.human.reviewers} hint="reviewers recorded — none yet" />
        <AMetric label="Pass rate" value={`${run.summary.passed}/${run.summary.totalScenarios}`} hint="regression-gated in CI" />
      </div>

      <APanel title="Dimension results" subtitle="Per-dimension counts with n/a and insufficient-evidence as honest outcomes">
        <table className="w-full text-xs">
          <thead><tr className="text-slate-400 text-left">
            <th className="py-1">dimension</th><th>pass</th><th>fail</th><th>n/a</th><th>insufficient</th>
          </tr></thead>
          <tbody>
            {run.dimensions.map((d) => (
              <tr key={d.key} className="border-t border-slate-800">
                <td className="py-1 text-slate-200">{d.label}</td>
                <td className="text-emerald-400">{d.passed}</td>
                <td className="text-rose-400">{d.failed}</td>
                <td className="text-slate-400">{d.notApplicable}</td>
                <td className="text-slate-400">{d.insufficientEvidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </APanel>

      <APanel title="Spatial Graph & Rendering Stress Benchmarks (Section 9)" subtitle="Deterministic synthetic architecture performance across Small, Medium, Large, and Stress profiles">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left border-b border-slate-800">
              <th className="py-1">Profile</th>
              <th>Nodes / Edges</th>
              <th>Graph IR</th>
              <th>3D Layout</th>
              <th>8 Map Modes</th>
              <th>Total Pipeline</th>
              <th>Layout Sanity</th>
            </tr>
          </thead>
          <tbody>
            {spatialResults.map((r) => (
              <tr key={r.profile.name} className="border-t border-slate-800/60 font-mono">
                <td className="py-1.5 font-bold text-slate-200">{r.profile.name}</td>
                <td className="text-slate-400">{r.profile.nodes} nodes / {r.profile.edges} edges</td>
                <td className="text-slate-300">{r.graphConversionMs} ms</td>
                <td className="text-slate-300">{r.layoutCalculationMs} ms</td>
                <td className="text-slate-300">{r.layersCalculationMs} ms</td>
                <td className="text-sky-300 font-bold">{r.totalMs} ms</td>
                <td>
                  <ABadge status={r.layoutSane ? "ok" : "bad"} label={r.layoutSane ? "✓ sane" : "invalid"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-500 mt-2">
          Synthetic profiles benchmark graph conversion, deterministic layered 3D layout bounds, and analytical layer computation across all 8 modes without dropping disconnected nodes.
        </p>
      </APanel>

      <div className="grid gap-3 lg:grid-cols-2">
        <APanel title="Case inspector" subtitle="Scoring traces: criterion, inputs, outcome, rationale — aggregates reconstruct from traces">
          <label htmlFor="bm-case" className="text-[10px] uppercase text-slate-400">Select a case</label>
          <select id="bm-case" value={selectedCase} onChange={(e) => setSelectedCase(e.target.value)}
            className="w-full mt-1 rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-100">
            <option value="">— choose —</option>
            {traces.slice(0, 60).map((t) => <option key={t.scenarioId} value={t.scenarioId}>{t.dimension} · {t.scenarioId}</option>)}
          </select>
          {caseTrace ? (
            <div className="text-xs mt-2 space-y-1">
              <p><strong>Criterion:</strong> {caseTrace.criterion}</p>
              <p><strong>Inputs:</strong> {caseTrace.inputs}</p>
              <p><ABadge status={caseTrace.outcome === "pass" ? "ok" : caseTrace.outcome === "fail" ? "bad" : "warn"} label={caseTrace.outcome} /></p>
              <p className="text-slate-400">{caseTrace.rationale}</p>
            </div>
          ) : <p className="text-xs text-slate-500 mt-2">Select a case to inspect its scoring trace.</p>}
          <p className="text-[10px] text-slate-500 mt-2">
            Reconstruction check: {reconstructed.passed}/{run.summary.passed} pass · {reconstructed.failed}/{run.summary.failed} fail — traces rebuild the aggregate.
          </p>
        </APanel>

        <APanel title="Counterexample corpus (critic challenges)" subtitle="Positive control + false-positive pinning of every rule's exception clause">
          <ul className="text-xs space-y-1">
            {challenges.map((c) => (
              <li key={c.counterexampleId} className="flex items-center gap-2">
                <ABadge status={c.passed ? "ok" : "bad"} label={c.passed ? "pass" : "fail"} />
                <span className="text-slate-300">{c.counterexampleId}</span>
                <span className="text-slate-500">rule {c.ruleId}: expected {c.expected}, actual {c.actual}</span>
              </li>
            ))}
          </ul>
        </APanel>

        <APanel title="Grounded corpus evaluation" subtitle="Facts must cite registered sources; modeling engines must exist">
          <ul className="text-xs space-y-1 max-h-52 overflow-y-auto">
            {groundedEval.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <ABadge status={r.outcome === "pass" ? "ok" : "bad"} label={r.outcome} />
                <span className="text-slate-400">{r.detail}</span>
              </li>
            ))}
          </ul>
        </APanel>

        <APanel title="Critic on the fixtures" subtitle="Live critic run over the two sample architectures">
          {[
            { name: "DocFlow (reference)", m: docflowModel() },
            { name: "Flawed checkout (fixture)", m: flawedCheckoutModel() },
          ].map(({ name, m }) => {
            const { findings, rulesFired } = critiqueArchitecture(m);
            return (
              <div key={name} className="mb-2 text-xs">
                <p className="text-slate-200 font-semibold">{name}</p>
                <p className="text-slate-400">{findings.length} finding(s) · rules fired: {rulesFired.join(", ") || "none"}</p>
              </div>
            );
          })}
        </APanel>
      </div>

      <APanel title="Full report" subtitle="Deterministic render with limitations and reproduction metadata">
        <pre className="max-h-80 overflow-auto rounded-md border border-slate-700/50 bg-slate-950/70 p-3 text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap">
          {renderBenchmarkV2Report(run)}
        </pre>
      </APanel>
    </div>
  );
};
