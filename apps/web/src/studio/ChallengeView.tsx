import React, { useMemo, useState } from "react";
import { Button, Callout } from "../trail/ui";
import { Workspace } from "./store";
import { Scenario } from "./scenarios";
import { StudioApi } from "./useStudio";
import {
  CHALLENGE_STEPS, ChallengeState, acknowledge, challengeSummary, constraintFeedback, constraintOptions, finalize, recordCompare, recordValidation, revealHint,
  startChallenge, submitConstraints, tryAdvance,
} from "./challenge";
import { ScenarioPanel } from "./ScenarioPanel";
import { CheckField, Panel, Status, TopicLinks } from "./parts";
import { download } from "./util";
import { validateArchitecture, countBySeverity } from "./validation";
import { compareArchitectures } from "./compare";
import { getFailure } from "./failures";
import { challengeReportMarkdown, diagramSvg, safeFilename } from "./exporters";
import { emptyArchitecture } from "./model";

export const ChallengeView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario; go: (t: string) => void }> = ({ api, ws, scenario, go }) => {
  const st = ws.challenge;
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [picks, setPicks] = useState<string[]>(st?.constraintsPicked ?? []);
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (f: (c: ChallengeState) => ChallengeState) => api.update((w) => ({ ...w, challenge: w.challenge ? f(w.challenge) : w.challenge }));
  const findings = useMemo(() => validateArchitecture(ws.arch, scenario), [ws.arch, scenario]);

  if (ws.mode !== "challenge" || !st) {
    return (
      <div className="max-w-3xl space-y-4">
        <h2 className="text-2xl font-extrabold text-slate-100">Guided system-design challenge</h2>
        <p className="text-sm text-slate-300">Design <strong>{scenario.name}</strong> from a blank canvas in eleven gated steps: read the brief, identify constraints, sketch, explain, validate, break it, improve it, compare, and review. Hints appear one at a time and never hand you the design. Nothing is completed until you actually do the work.</p>
        <Button variant="primary" onClick={() => { api.createWorkspace(scenario.id, "blank", undefined, true); }}>Start the challenge for this scenario</Button>
        <p className="text-xs text-slate-500">This creates a new blank workspace in challenge mode; your current architecture is kept.</p>
      </div>
    );
  }

  const ctx = { arch: ws.arch, adrs: ws.adrs };
  const step = CHALLENGE_STEPS[st.step];
  const gate = step.gate(st, ctx);
  const hintN = st.hints[st.step] ?? 0;
  const advance = () => {
    const r = tryAdvance(st, ctx);
    if (r.advanced) { set(() => r.state); setMsg({ kind: "ok", text: `Step ${st.step + 1} complete.` }); } else setMsg({ kind: "error", text: r.reason });
  };
  const summary = st.finalized ? challengeSummary(st, scenario, ws.arch, ws.adrs, ws.capacity) : null;
  const fb = constraintFeedback(st, scenario);
  const names = (ids: string[]) => ids.map((id) => getFailure(id as never).name);

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Challenge steps" className="rounded-xl border border-slate-600/40 bg-slate-800/60 p-3">
        <ol className="space-y-1" data-testid="challenge-steps">
          {CHALLENGE_STEPS.map((s, i) => {
            const done = st.passed.includes(i) || (st.finalized && i === 10);
            const cur = i === st.step && !st.finalized;
            return (
              <li key={s.title} aria-current={cur ? "step" : undefined} className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${cur ? "bg-sky-500/15 text-sky-100" : done ? "text-emerald-300" : "text-slate-500"}`}>
                <span aria-hidden="true" className="w-4 text-center">{done ? "✓" : cur ? "▶" : "○"}</span>
                <span><span className="sr-only">{done ? "Completed: " : cur ? "Current: " : "Locked: "}</span>{i + 1}. {s.title}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 border-t border-slate-700/60 pt-3">
          <Button variant="danger" onClick={() => { if (!confirmReset) { setConfirmReset(true); window.setTimeout(() => setConfirmReset(false), 4000); return; } setConfirmReset(false); api.update((w) => ({ ...w, challenge: startChallenge(scenario.id), arch: emptyArchitecture(), adrs: [], review: null, versions: [] })); setPicks([]); setMsg({ kind: "info", text: "Challenge reset: blank canvas, no decisions, step 1." }); }}>{confirmReset ? "Confirm reset?" : "Reset challenge"}</Button>
        </div>
      </nav>

      <div className="min-w-0 space-y-4">
        {!st.finalized && (
          <Panel title={`Step ${st.step + 1} of ${CHALLENGE_STEPS.length} — ${step.title}`}>
            <div className="space-y-4" data-testid="challenge-step">
              <p className="text-sm text-slate-200">{step.instruction}</p>

              {st.step <= 2 && <ScenarioPanel scenario={scenario} reveal={{ functional: st.step >= 1, nonFunctional: st.step >= 2 }} />}
              {st.step <= 2 && <Button onClick={() => set((c) => acknowledge(c, st.step))} disabled={st.ack.includes(st.step)}>{st.ack.includes(st.step) ? "✓ Read" : "I have read this"}</Button>}

              {st.step === 3 && (
                <div className="space-y-3">
                  <fieldset className="space-y-1.5 rounded-lg border border-slate-700/60 p-3">
                    <legend className="px-1 text-xs font-semibold text-slate-300">Which of these are constraints of this scenario?</legend>
                    {constraintOptions(scenario).map((c) => <CheckField key={c} label={c} checked={picks.includes(c)} onChange={(v) => setPicks((p) => (v ? [...p, c] : p.filter((x) => x !== c)))} />)}
                  </fieldset>
                  <Button onClick={() => { set((c) => submitConstraints(c, picks)); setMsg(picks.length ? { kind: "info", text: "Submitted. Feedback below." } : { kind: "error", text: "Select at least one statement." }); }}>Submit answers</Button>
                  {st.constraintsSubmitted && (
                    <div className="space-y-1 text-sm" data-testid="constraint-feedback">
                      <p className="text-emerald-300">✓ Real constraints you found: {fb.correct.length}</p>
                      {fb.wrong.length > 0 && <div className="text-amber-300">✗ Not constraints of this scenario (decoys): <ul className="list-disc pl-5">{fb.wrong.map((w) => <li key={w}>{w}</li>)}</ul></div>}
                      {fb.missed.length > 0 && <div className="text-slate-300">Missed constraints: <ul className="list-disc pl-5">{fb.missed.map((w) => <li key={w}>{w}</li>)}</ul></div>}
                    </div>
                  )}
                </div>
              )}

              {st.step === 4 && <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => go("design")}>Open the canvas</Button><span className="self-center text-xs text-slate-400">{gate.need}</span></div>}
              {st.step === 5 && <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => go("decisions")}>Record a decision</Button><span className="self-center text-xs text-slate-400">{ws.adrs.length} ADR(s) so far.</span></div>}
              {st.step === 6 && (
                <div className="space-y-2">
                  <Button variant="primary" onClick={() => { set(recordValidation); setMsg({ kind: "ok", text: `Validation run recorded: ${findings.length} finding(s).` }); }}>Run validation now</Button>
                  {st.validated && <p className="text-sm text-slate-300" data-testid="challenge-validation">{(() => { const c = countBySeverity(findings); return `${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.info} informational. `; })()}<button type="button" className="text-sky-300 underline" onClick={() => go("validate")}>Read the findings</button></p>}
                </div>
              )}
              {st.step === 7 && <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => go("failures")}>Open the Failure Lab</Button><span className="self-center text-xs text-slate-400">Injected so far: {st.failuresInjected.length ? names(st.failuresInjected).join(", ") : "none"}.</span></div>}
              {st.step === 8 && <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => go("design")}>Open the canvas</Button><span className="self-center text-xs text-slate-400">{gate.met ? "✓ Structure changed since the failure run." : gate.need}</span></div>}
              {st.step === 9 && st.initialSnapshot && (
                <div className="space-y-3">
                  <Button variant="primary" onClick={() => { const r = recordCompare(st, ws.arch); if (r.ok) set(() => r.state); setMsg(r.ok ? { kind: "ok", text: "Comparison recorded." } : { kind: "error", text: r.reason }); }}>Compare my first sketch with my current design</Button>
                  {st.compared && (() => { const rep = compareArchitectures(st.initialSnapshot as NonNullable<typeof st.initialSnapshot>, ws.arch, scenario, ws.capacity); return (
                    <div className="space-y-2" data-testid="challenge-compare">
                      <table className="w-full text-sm"><tbody className="divide-y divide-slate-700/60">{rep.rows.slice(0, 4).map((r) => <tr key={r.dimension}><th scope="row" className="py-1.5 pr-2 text-left text-slate-100">{r.dimension}</th><td className="pr-2 text-slate-300">{r.a}</td><td className="text-slate-300">{r.b}</td></tr>)}</tbody></table>
                      {rep.perspective.map((p) => <p key={p} className="text-xs text-violet-200">{p}</p>)}
                    </div>); })()}
                </div>
              )}
              {st.step === 10 && (
                <Button variant="primary" onClick={() => { const r = finalize(st, ctx); if (r.ok) { set(() => r.state); setMsg({ kind: "ok", text: "Challenge complete. Final review generated below." }); } else setMsg({ kind: "error", text: r.reason }); }}>Generate final review</Button>
              )}

              {st.step < 10 && (st.step > 2) && <p className="text-xs text-slate-500" aria-live="polite">{gate.met ? "✓ Requirement for this step is met." : `Not yet: ${gate.need}`}</p>}

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-700/60 pt-3">
                {st.step < 10 && <Button variant="primary" onClick={advance}>Next step</Button>}
                <Button onClick={() => set((c) => revealHint(c, st.step))} disabled={hintN >= 3}>{hintN >= 3 ? "All hints shown" : `Show hint ${hintN + 1} of 3`}</Button>
              </div>
              {hintN > 0 && <ol className="list-decimal space-y-1 pl-5 text-sm text-amber-100" data-testid="hints">{step.hints.slice(0, hintN).map((h) => <li key={h}>{h}</li>)}</ol>}
              {msg && <Status kind={msg.kind}>{msg.text}</Status>}
            </div>
          </Panel>
        )}

        {summary && (
          <Panel title="Completion summary" hint="Built from your real work — no opaque score">
            <div className="space-y-5 text-sm" data-testid="challenge-summary">
              <Callout kind="info" title="Reading this summary">Requirements show <em>structural evidence</em> in your diagram; failure results come from the Failure Lab model on your final design. Neither proves a production system would behave this way.</Callout>
              <div className="grid gap-4 md:grid-cols-2">
                <div><h4 className="font-bold text-emerald-300">Requirements addressed ({summary.requirementsAddressed.length})</h4><ul className="list-disc pl-5 text-slate-200">{summary.requirementsAddressed.map((r) => <li key={r}>{r}</li>)}</ul></div>
                <div><h4 className="font-bold text-amber-300">Requirements unresolved ({summary.requirementsUnresolved.length})</h4>{summary.requirementsUnresolved.length === 0 ? <p className="text-slate-400">None.</p> : <ul className="list-disc pl-5 text-slate-200">{summary.requirementsUnresolved.map((r) => <li key={r.text}>{r.text} <span className="text-xs text-slate-400">— missing: {r.missing.join("; ")}</span></li>)}</ul>}</div>
                <div><h4 className="font-bold text-emerald-300">Failure scenarios survived ({summary.failuresSurvived.length})</h4><ul className="list-disc pl-5 text-slate-200">{names(summary.failuresSurvived).map((n) => <li key={n}>{n}</li>)}</ul></div>
                <div><h4 className="font-bold text-amber-300">Failure scenarios not handled ({summary.failuresNotHandled.length})</h4>{summary.failuresNotHandled.length === 0 ? <p className="text-slate-400">None.</p> : <ul className="list-disc pl-5 text-slate-200">{names(summary.failuresNotHandled).map((n) => <li key={n}>{n}</li>)}</ul>}{summary.failuresNotApplicable.length > 0 && <p className="mt-1 text-xs text-slate-400">Not applicable to your design (nothing to hit): {names(summary.failuresNotApplicable).join(", ")}.</p>}</div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><h4 className="font-bold text-slate-100">Decisions recorded</h4><p className="text-slate-200">{summary.decisionsRecorded} ADR(s). Hints used: {summary.hintsUsed}.</p></div>
                <div><h4 className="font-bold text-slate-100">Simplicity</h4><p className="text-slate-200">{summary.simplicity.justified} of {summary.simplicity.components} components are justified by a requirement, are free policies, or have a stated reason.{summary.simplicity.unjustified.length > 0 && <> Unjustified: {summary.simplicity.unjustified.join(", ")}.</>} Adding components is never rewarded on its own.</p></div>
                <div><h4 className="font-bold text-slate-100">Topics practiced</h4><TopicLinks topics={summary.topicsPracticed} /></div>
                <div><h4 className="font-bold text-slate-100">Areas for further study</h4><TopicLinks topics={summary.furtherStudy} /></div>
              </div>
              <table className="w-full max-w-lg text-sm"><thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-1">Initial vs final</th><th>Initial</th><th>Final</th></tr></thead><tbody className="divide-y divide-slate-700/60">{summary.initialVsFinal.map((r) => <tr key={r.label}><td className="py-1 text-slate-200">{r.label}</td><td>{r.initial}</td><td>{r.final}</td></tr>)}</tbody></table>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => download(safeFilename(`${ws.name}-challenge-report`, "md"), challengeReportMarkdown({ workspaceName: ws.name, scenario, initial: st.initialSnapshot, final: ws.arch, adrs: ws.adrs, summary, failuresRun: st.failuresInjected, exportedAt: new Date().toISOString() }), "text/markdown")}>Download challenge report</Button>
                <Button onClick={() => download(safeFilename(ws.name, "svg"), diagramSvg(ws.arch, ws.name, scenario.name), "image/svg+xml")}>Download final diagram (SVG)</Button>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
};
