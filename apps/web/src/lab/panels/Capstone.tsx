/**
 * Capstone panel: the full System Design Flight Lab lifecycle and the
 * benchmark report.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../model";
import { runCapstone } from "../engines/capstone";
import { runBenchmark } from "../engines/benchmark";
import { runBenchmarkV2, renderBenchmarkV2Report } from "../engines/benchmark2";
import { validityDashboard, externalValidationReport } from "../engines/benchvalid";
import {
  captureFinding, buildEvidencePack, serializeEvidencePack, checkEvidenceIntegrity, kindSummary,
} from "../engines/evidence";
import { extractGenome } from "../engines/genome";
import { recordRevision } from "../engines/mission";
import { Panel, Callout, Metric, Btn, EvidenceChips } from "../ui";

export const CapstonePanel: React.FC<{ model: ArchitectureModel }> = ({ model }) => {
  const [runAt, setRunAt] = useState<string | null>(null);
  const capstone = useMemo(
    () => runCapstone({
      generatedAt: runAt ?? "not yet run",
      benchmarkLimitations: ["critic-only corpus", "ground truth reflects the documented rule set"],
      revisions: recordRevision([], "after-first-analysis", "scaled workers", "MC-5 doubled peak traffic"),
    }), [runAt]);
  const benchmark = useMemo(() => runBenchmark(null, runAt ?? "not yet run"), [runAt]);
  const benchmarkV2 = useMemo(() => runBenchmarkV2(runAt ?? "not yet run"), [runAt]);
  const [exported, setExported] = useState("");

  return (
    <div>
      <Panel title="System Design Flight Lab" subtitle="Design -> challenge assumptions -> observe failures -> compare alternatives -> evidence-backed report"
        right={<div className="flex gap-2">
          <Btn onClick={() => setRunAt(new Date().toISOString())}>Run the capstone lifecycle</Btn>
          <Btn onClick={() => setExported(JSON.stringify(capstone.evidence, null, 2))}>Export evidence package</Btn>
        </div>}>
        {(() => {
          // Evidence pack: capture the intelligence findings as typed artifacts
          const findings = [...capstone.intelligence.criticFindings, ...capstone.intelligence.securityFindings];
          const artifacts = findings.map((f) => captureFinding(f, {
            createdAt: runAt ?? "not yet run",
            archFingerprint: extractGenome(model).fingerprint,
          }));
          const pack = buildEvidencePack("capstone-pack", artifacts, runAt ?? "not yet run");
          const integrity = checkEvidenceIntegrity(model, artifacts);
          const kinds = kindSummary(artifacts);
          return (
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 mb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Evidence pack</h4>
                <Btn onClick={() => setExported(serializeEvidencePack(pack))}>Export evidence pack (JSON)</Btn>
              </div>
              <p className="text-[11px] text-slate-300">
                {artifacts.length} artifacts — kinds: simulated {kinds.simulated}, inferred {kinds.inferred},
                observed {kinds.observed} (none: this lab produces no production telemetry), user-authored {kinds["user-authored"]}.
              </p>
              <p className={`text-[11px] ${integrity.ok ? "text-emerald-300" : "text-rose-300"}`}>
                Integrity: {integrity.ok ? "all references resolve, provenance complete" : integrity.issues.map((i) => i.problem).join("; ")}
              </p>
            </div>
          );
        })()}
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

      <Panel title="Intelligence benchmark v2" subtitle="Eight dimensions of reasoning quality, executed against a synthetic corpus — not real-world validation"
        right={<span className="text-[10px] text-slate-400">
          v1 critic: precision {benchmark.summary.precision} / recall {benchmark.summary.recall}
        </span>}>
        <pre className="max-h-80 overflow-auto rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap">
          {renderBenchmarkV2Report(benchmarkV2)}
        </pre>
        <Callout kind="honest">
          {benchmarkV2.limitations[0]}
        </Callout>
      </Panel>

      {/*
        Campaign 05, Tasks 16/20 — benchmark validity dashboard: what the
        benchmark score is WORTH (synthetic vs grounded vs human-reviewed vs
        independently validated), computed from actual metadata — never
        disguising unreviewed cases as validated.
      */}
      <Panel title="Benchmark validity dashboard" subtitle="How trustworthy the benchmark's evidence is — missing validation is shown as missing">
        <ul className="space-y-1 mb-3">
          {validityDashboard([]).map((d) => (
            <li key={d.key} className="border border-slate-700/60 rounded-md p-2 text-xs">
              <span className="font-semibold text-slate-200">{d.label}</span>{" "}
              <span className={
                d.status === "validated" ? "text-emerald-300"
                : d.status === "failed-validation" ? "text-rose-300"
                : d.status === "partially-validated" ? "text-sky-300" : "text-amber-300"
              }>[{d.status}]</span>
              <span className="text-slate-400"> — {d.value}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">{d.reason}</p>
            </li>
          ))}
        </ul>
        {(() => {
          const r = externalValidationReport(benchmarkV2, []);
          return (
            <Callout kind="honest">
              <strong>Validation status:</strong> {r.human.status} {r.independent.status}
              {" "}Grounded subset: {r.grounded.cases} cases citing {r.grounded.sources} sources.
            </Callout>
          );
        })()}
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
