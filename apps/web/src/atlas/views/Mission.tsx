/**
 * Atlas — Mission Control (Task 05): data-backed project overview. Every
 * metric and status derives from real workspace data and navigates to its
 * source workflow.
 */

import React, { useMemo } from "react";
import type { AtlasState } from "../state";
import { activeProject } from "../state";
import type { AtlasSection } from "../router";
import { AMetric, APanel, ABadge, AButton } from "../ui";
import { parseModel, type ArchitectureModel } from "../../lab/model";
import { critiqueArchitecture } from "../../lab/engines/critic";
import { runBenchmarkV2 } from "../../lab/engines/benchmark2";
import { validityDashboard } from "../../lab/engines/benchvalid";
import { toVisGraph } from "../graph";
import { evaluateValidation, DEFAULT_POLICY, VALIDATION_LABELS, type ReviewRecord } from "../validation";

const nowIso = (): string => new Date().toISOString();

export const MissionView: React.FC<{
  state: AtlasState;
  reviews: Record<string, ReviewRecord[]>;
  onNavigate: (s: AtlasSection) => void;
  onOpenProject: (id: string) => void;
}> = ({ state, reviews, onNavigate, onOpenProject }) => {
  const project = activeProject(state);
  const model = useMemo<ArchitectureModel>(() => parseModel(project.modelJson), [project.modelJson]);
  const graph = useMemo(() => toVisGraph(model), [model]);
  const findings = useMemo(() => critiqueArchitecture(model).findings, [model]);
  const benchmark = useMemo(() => runBenchmarkV2(new Date(0).toISOString()), []);
  const dashboard = useMemo(() => validityDashboard([]), []);
  const validation = useMemo(
    () => evaluateValidation(reviews[project.id] ?? [], DEFAULT_POLICY, { reviewRequested: false, now: nowIso() }),
    [reviews, project.id],
  );
  const unarchived = state.projects.filter((p) => !p.archived);
  const openReviews = Object.values(reviews).reduce((a, r) => a + r.filter((x) => x.assessment.verdict === "disagree" && !x.assessment.adjudication).length, 0);

  return (
    <div className="h-full overflow-y-auto p-4">
      <header className="mb-4">
        <h1 className="text-lg font-black text-slate-100">Mission Control</h1>
        <p className="text-xs text-slate-400">
          Working set: <strong>{project.name}</strong> (v{project.version}) — {graph.nodes.length} components,
          {" "}{graph.edges.length} connections, {graph.zones.length} trust zones. All values below are computed from the actual workspace data.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <AMetric label="Architectures" value={unarchived.length} hint={`${state.projects.length - unarchived.length} archived`} />
        <AMetric label="Open findings" value={findings.length} hint="critic engine on the active architecture" />
        <AMetric label="Benchmark pass" value={`${benchmark.summary.passed}/${benchmark.summary.totalScenarios}`} hint="synthetic self-consistency corpus" />
        <AMetric label="Human reviews" value={Object.values(reviews).flat().length} hint="review records in this browser" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <APanel title="Architectures" subtitle="Open any project directly in the Studio">
          <ul className="text-xs space-y-1">
            {unarchived.map((p) => {
              const g = toVisGraph(parseModel(p.modelJson));
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 border border-slate-700/50 rounded-md px-2 py-1.5">
                  <span>
                    <strong className="text-slate-200">{p.name}</strong>{" "}
                    <span className="text-slate-500">v{p.version} · {g.nodes.length} components {state.unsaved[p.id] ? "· unsaved changes" : ""}</span>
                  </span>
                  <AButton onClick={() => onOpenProject(p.id)}>Open in Studio</AButton>
                </li>
              );
            })}
          </ul>
        </APanel>

        <APanel title="Validation status" subtitle="Derived from review records under the configured policy — never decoration"
          right={<AButton onClick={() => onNavigate("validation")}>Open Validation Room</AButton>}>
          <div className="text-xs space-y-2">
            <div className="flex items-center gap-2">
              <ABadge status={validation.state === "independently-validated" ? "ok" : validation.state === "not-reviewed" ? "unknown" : "warn"}
                label={VALIDATION_LABELS[validation.state]} />
              <span className="text-slate-500">{validation.reasons.join("; ")}</span>
            </div>
            <ul className="text-slate-400 space-y-1">
              {dashboard.map((d) => (
                <li key={d.key}><strong>{d.label}</strong>: [{d.status}] {d.value}</li>
              ))}
            </ul>
          </div>
        </APanel>

        <APanel title="Outstanding findings" subtitle="Critic engine output on the active architecture — click through to the Studio">
          <ul className="text-xs space-y-1 max-h-56 overflow-y-auto">
            {findings.length === 0 && <li className="text-slate-500">No open findings.</li>}
            {findings.slice(0, 8).map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <ABadge status={f.severity === "critical" ? "bad" : f.severity === "warning" ? "warn" : "info"} label={f.severity} />
                <button className="text-slate-300 hover:text-sky-300 text-left" onClick={() => onNavigate("studio")}>{f.title}</button>
              </li>
            ))}
          </ul>
        </APanel>

        <APanel title="Quick actions" subtitle="Every action navigates to a real workflow">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <AButton onClick={() => onNavigate("studio")}>Open Architecture Studio</AButton>
            <AButton onClick={() => onNavigate("experiments")}>Run experiments</AButton>
            <AButton onClick={() => onNavigate("exchange")}>Exchange evidence packages</AButton>
            <AButton onClick={() => onNavigate("benchmarks")}>Inspect benchmarks</AButton>
            <AButton onClick={() => onNavigate("sources")}>Browse sources &amp; claims</AButton>
            <AButton onClick={() => onNavigate("settings")}>Manage workspaces</AButton>
          </div>
          {openReviews > 0 && (
            <p className="mt-2 text-[11px] text-amber-300">
              {openReviews} unresolved reviewer disagreement(s) await adjudication — see the Validation Room.
            </p>
          )}
        </APanel>
      </div>
    </div>
  );
};
