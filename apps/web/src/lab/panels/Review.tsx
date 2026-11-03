/**
 * Review panel: architecture critic, transparent scorecard, challenge
 * generator, decision debate, and the design-under-constraints mission.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../model";
import { critiqueArchitecture } from "../engines/critic";
import { buildScorecard } from "../engines/scorecard";
import { generateChallenge, estimateDifficulty, validateChallenge, recommendChallenge } from "../engines/challenges";
import { processingDecouplingDebate, checkDebateConsistency, recordDecision } from "../engines/debate";
import { docflowMission, evaluateMission, recordRevision, type RevisionRecord } from "../engines/mission";
import { modeConfig, presentFindings, type LearningMode } from "../engines/modes";
import { Panel, FindingsList, Callout, Metric, Btn, StateBadge } from "../ui";

export const ReviewPanel: React.FC<{
  model: ArchitectureModel; mode: LearningMode; onAddAdr: (adrText: string) => void;
}> = ({ model, mode, onAddAdr }) => {
  const critic = useMemo(() => critiqueArchitecture(model), [model]);
  const { scorecard } = useMemo(() => buildScorecard(model), [model]);
  const presented = useMemo(() => presentFindings(mode, critic.findings), [critic, mode]);

  const [traffic, setTraffic] = useState(1);
  const [strict, setStrict] = useState(false);
  const [maxDeployables, setMaxDeployables] = useState<number | undefined>(undefined);
  const challenge = useMemo(
    () => generateChallenge("ch-live", { trafficMultiplier: traffic, strictConsistency: strict, maxDeployables }),
    [traffic, strict, maxDeployables]);
  const recommendation = useMemo(
    () => recommendChallenge([generateChallenge("ch-base"), challenge], { solvedChallenges: [], demonstratedConcepts: [] }),
    [challenge]);

  const debate = useMemo(() => processingDecouplingDebate(model), [model]);
  const debateCheck = useMemo(() => checkDebateConsistency(debate), [debate]);
  const [chosen, setChosen] = useState("alt-queue");
  const [rationale, setRationale] = useState("processing time exceeds the ack deadline by 15x");

  const mission = docflowMission();
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
  const missionEval = useMemo(() => evaluateMission(mission, model, revisions), [model, revisions, mission]);

  const cfg = modeConfig(mode);

  return (
    <div>
      <Panel title="Architecture critic" subtitle="Deterministic, evidence-grounded findings — every recommendation says when it does NOT apply"
        right={<span className="text-[10px] text-slate-400">rules fired: {critic.rulesFired.join(", ") || "none"}</span>}>
        <FindingsList findings={presented.headline} emptyText="No critical or warning findings from the critic." />
        {cfg.showRawEngineOutput && <div className="mt-2"><FindingsList findings={presented.detail} /></div>}
      </Panel>

      <Panel title="Resilience scorecard" subtitle="Seven dimensions, uncertainty labels, inspectable rationale — no aggregate score by design">
        <div className="space-y-2">
          {scorecard.dimensions.map((d) => (
            <div key={d.key} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-100">{d.label}</span>
                <span className="flex items-center gap-2">
                  <StateBadge severity={d.key === "cost" || d.key === "complexity" ? "info" : d.score >= 60 ? "info" : d.score >= 30 ? "warning" : "critical"} />
                  <span className="text-xs font-bold text-slate-100">{d.score}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">({d.uncertainty})</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded bg-slate-800 overflow-hidden">
                <div className={`h-full rounded ${d.key === "cost" || d.key === "complexity" ? "bg-slate-500" : d.score >= 60 ? "bg-emerald-500" : d.score >= 30 ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${Math.min(100, d.score)}%` }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">{d.rationale}</p>
            </div>
          ))}
        </div>
        <Callout kind="honest">{scorecard.notes[0]}</Callout>
      </Panel>

      <Panel title="Challenge generator" subtitle="Controlled variations with explicit difficulty — validated against the supported model"
        right={<Metric label="Difficulty" value={estimateDifficulty(challenge)} />}>
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-slate-300">
          <label className="inline-flex items-center gap-1">
            traffic <input type="range" min={1} max={4} value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} className="w-24" /> {traffic}x
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> strict consistency
          </label>
          <label className="inline-flex items-center gap-1">
            max deployables
            <input type="number" min={2} max={20} value={maxDeployables ?? ""} placeholder="—"
              onChange={(e) => setMaxDeployables(e.target.value === "" ? undefined : Number(e.target.value))}
              className="w-16 rounded bg-slate-800 border border-slate-600 px-1 py-0.5" />
          </label>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs space-y-1">
          {challenge.requirements.map((r) => (
            <p key={r.id} className="text-slate-300"><span className="font-mono text-slate-400">{r.id}</span> {r.statement}
              <span className="text-slate-500"> — accepted when: {r.acceptance}</span></p>
          ))}
          {challenge.constraints.map((c, i) => <p key={i} className="text-amber-200">Constraint: {c}</p>)}
          <p className="text-slate-400">Concepts: {challenge.expectedConcepts.join(", ")}</p>
          <p className="text-slate-400">{recommendation ? `Recommended: ${recommendation.challenge.id} — ${recommendation.reason}` : ""}</p>
          <p className={validateChallenge(challenge).valid ? "text-emerald-300" : "text-rose-300"}>
            {validateChallenge(challenge).valid
              ? "Challenge is solvable within the supported model."
              : `Invalid: ${validateChallenge(challenge).problems.join("; ")}`}
          </p>
        </div>
      </Panel>

      <Panel title="Decision debate" subtitle="The strongest argument for AND against each alternative — under the same requirements"
        right={<span className={`text-[10px] ${debateCheck.consistent ? "text-emerald-300" : "text-amber-300"}`}>
          {debateCheck.consistent ? "consistent comparison" : "inconsistent: see problems"}
        </span>}>
        <p className="text-xs text-slate-200 mb-2">{debate.question}</p>
        <div className="grid md:grid-cols-3 gap-2">
          {debate.alternatives.map((a) => (
            <div key={a.id} className={`rounded-lg border p-2.5 text-xs ${chosen === a.id
              ? "border-sky-400 bg-sky-500/10" : "border-slate-700/50 bg-slate-900/40"}`}>
              <button className="text-left font-semibold text-slate-100 hover:text-sky-300" onClick={() => setChosen(a.id)}>
                {a.title}
              </button>
              <p className="text-slate-300 mt-1">{a.approach}</p>
              <p className="text-emerald-300 mt-1">+ {a.benefits[0]}</p>
              <p className="text-rose-300">- {a.costs[0]}</p>
              <p className="text-amber-200">risk: {a.risks[0]}</p>
              <p className="text-slate-400 mt-1">preferable when: {a.preferableWhen}</p>
            </div>
          ))}
        </div>
        {!debateCheck.consistent && (
          <ul className="mt-2 text-[11px] text-amber-300">{debateCheck.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={rationale} onChange={(e) => setRationale(e.target.value)}
            className="flex-1 rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100"
            aria-label="Decision rationale" placeholder="Why this alternative?" />
          <Btn onClick={() => {
            const adr = recordDecision(debate, chosen, rationale);
            onAddAdr(`ADR recorded: ${adr.title} — ${adr.decision}`);
          }}>Record decision as ADR</Btn>
        </div>
      </Panel>

      <Panel title="Mission: design under constraints" subtitle={mission.title}
        right={<Btn onClick={() => setRevisions(recordRevision(revisions, "after-first-analysis",
          "recorded from the lab", "revealed constraint MC-5 (doubled peak traffic) forces a capacity revision"))}>
          Record a revision (reveal stage 3)
        </Btn>}>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Progressive reveal</div>
            {mission.stages.map((s) => (
              <p key={s.revealAt} className="text-slate-300"><span className="font-semibold">{s.revealAt}</span>: {s.information}</p>
            ))}
            <div className="text-[10px] uppercase tracking-wider text-slate-400 pt-1">Unknowns you must answer</div>
            {mission.unknowns.map((u) => <p key={u} className="text-amber-200">{u}</p>)}
          </div>
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100">Evaluation: {missionEval.overall}</span>
              {missionEval.overall === "accepted" ? <StateBadge severity="info" /> : <StateBadge severity="warning" />}
            </div>
            <p className="text-slate-300">Requirements covered: {missionEval.requirementCoverage.covered.length}/{missionEval.requirementCoverage.covered.length + missionEval.requirementCoverage.uncovered.length}</p>
            <p className="text-slate-300">Deployables within bound: {missionEval.deployablesWithinBound === null ? "no bound" : missionEval.deployablesWithinBound ? "yes" : "NO"}</p>
            <p className="text-slate-300">Deletion coverage: {missionEval.deletionCoverage.filter((d) => d.covered).length}/{missionEval.deletionCoverage.length} entities</p>
            <p className="text-slate-300">Revisions recorded: {revisions.length}</p>
            <p className="text-slate-300">Evidence items: {missionEval.evidenceCount}</p>
            {missionEval.notes.map((n, i) => <p key={i} className="text-amber-200">{n}</p>)}
          </div>
        </div>
      </Panel>
    </div>
  );
};
