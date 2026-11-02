import React, { useMemo, useState } from "react";
import { Button } from "../trail/ui";
import { Workspace } from "./store";
import { Scenario } from "./scenarios";
import { Finding, SEVERITY_LABEL, SEVERITY_ORDER, Severity, countBySeverity, validateArchitecture } from "./validation";
import { Panel, SeverityBadge, TopicLinks } from "./parts";
import { StudioApi } from "./useStudio";
import { recordValidation } from "./challenge";

const FindingCard: React.FC<{ f: Finding; names: Record<string, string> }> = ({ f, names }) => {
  const [open, setOpen] = useState(f.severity === "critical");
  return (
    <li className="rounded-lg border border-slate-600/40 bg-slate-800/50" data-testid={`finding-${f.ruleId}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-sky-400">
        <SeverityBadge severity={f.severity} />
        <span className="font-semibold text-slate-100">{f.title}</span>
        <span className="ml-auto text-xs text-slate-400">{open ? "Hide" : "Explain"}</span>
      </button>
      <p className="px-3 pb-2 text-sm text-slate-300">{f.detected}</p>
      {open && (
        <div className="space-y-3 border-t border-slate-700/60 px-3 py-3 text-sm">
          <div><h4 className="text-xs font-bold uppercase text-slate-400">Why it may be a problem</h4><p className="text-slate-200">{f.why}</p></div>
          <div><h4 className="text-xs font-bold uppercase text-slate-400">Requirement or risk affected</h4><p className="text-slate-200">{f.affects}</p></div>
          <div><h4 className="text-xs font-bold uppercase text-slate-400">Concept taught in</h4><TopicLinks topics={f.topics} /></div>
          <div>
            <h4 className="text-xs font-bold uppercase text-slate-400">Ways to address it — and what each costs</h4>
            <ul className="mt-1 space-y-1.5">{f.options.map((o) => <li key={o.fix} className="rounded border border-slate-700/60 px-2 py-1.5"><strong className="text-slate-100">{o.fix}</strong><br /><span className="text-slate-300">Trade-off: {o.tradeoff}</span></li>)}</ul>
          </div>
          <p className="rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-100"><strong>Context decides:</strong> {f.contextNote}</p>
          <p className="text-xs text-slate-400">Components: {f.nodeIds.map((id) => names[id]).filter(Boolean).join(", ") || "—"}</p>
        </div>
      )}
    </li>
  );
};

export const ValidateView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario }> = ({ api, ws, scenario }) => {
  const findings = useMemo(() => validateArchitecture(ws.arch, scenario), [ws.arch, scenario]);
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [ran, setRan] = useState<string | null>(null);
  const counts = countBySeverity(findings);
  const names = Object.fromEntries(ws.arch.nodes.map((n) => [n.id, n.name]));
  const shown = filter === "all" ? findings : findings.filter((f) => f.severity === filter);
  const challenge = ws.mode === "challenge" && ws.challenge;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter findings by severity">
        <Button variant={filter === "all" ? "primary" : "ghost"} onClick={() => setFilter("all")}>All ({findings.length})</Button>
        {SEVERITY_ORDER.map((s) => <Button key={s} variant={filter === s ? "primary" : "ghost"} onClick={() => setFilter(s)}>{SEVERITY_LABEL[s]} ({counts[s]})</Button>)}
        {challenge && (
          <Button variant="primary" className="ml-auto" onClick={() => { api.update((w) => ({ ...w, challenge: w.challenge ? recordValidation(w.challenge) : w.challenge })); setRan(`Validation run recorded for the challenge at ${new Date().toLocaleTimeString()}: ${findings.length} finding(s).`); }}>Run & record validation (challenge)</Button>
        )}
      </div>
      {ran && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{ran}</p>}
      <Panel title="Findings" hint="Warnings are context-dependent — a finding is not automatically a defect">
        {ws.arch.nodes.length === 0 ? (
          <p className="text-sm text-slate-400">The canvas is empty, so there is nothing to validate yet. Add and connect components first.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-emerald-300" data-testid="no-findings">✓ No {filter === "all" ? "" : `${SEVERITY_LABEL[filter as Severity].toLowerCase()} `}findings from the {findings.length === 0 ? "current" : "selected"} rule set. That means these rules found nothing — not that the design is correct.</p>
        ) : (
          <ul className="space-y-2" data-testid="findings">{shown.map((f) => <FindingCard key={f.id} f={f} names={names} />)}</ul>
        )}
      </Panel>
    </div>
  );
};
