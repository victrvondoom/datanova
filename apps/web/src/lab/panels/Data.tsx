/**
 * Data & workflows panel: consistency contracts, ownership audit, idempotency
 * debugger, and the saga verifier.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../model";
import { analyzeConsistency, consistencyTimeline } from "../engines/consistency";
import { auditOwnership, refactorAlternatives } from "../engines/ownership";
import { simulateEvolution } from "../engines/eventschema";
import { simulateConcurrentDuplicate } from "../engines/idempotency";
import { docflowDeleteSaga, validateSaga, failurePaths, executeSaga } from "../engines/saga";
import { Panel, FindingsList, Callout, StateBadge, OkBadge, Btn } from "../ui";

const VERDICT_BADGE: Record<string, React.ReactNode> = {
  satisfied: <OkBadge />,
  violated: <StateBadge severity="critical" />,
  unknown: <StateBadge severity="warning" />,
};

export const DataPanel: React.FC<{ model: ArchitectureModel }> = ({ model }) => {
  const consistency = useMemo(() => analyzeConsistency(model), [model]);
  const ownership = useMemo(() => auditOwnership(model), [model]);
  const [selectedViolation, setSelectedViolation] = useState<number>(0);
  const [eventVersion, setEventVersion] = useState<1 | 2>(2);
  const eventSim = useMemo(() => {
    const ev = model.events[0];
    if (!ev) return null;
    const next = eventVersion === 2
      ? { version: 2, fields: [...ev.versions[0].fields, { name: "tenantId", type: "string" as const, required: true, addedIn: 2 }] }
      : ev.versions[0];
    return simulateEvolution(model, ev.id, next);
  }, [model, eventVersion]);
  const idem = useMemo(() => simulateConcurrentDuplicate(), []);
  const saga = useMemo(() => docflowDeleteSaga(), []);
  const sagaIssues = useMemo(() => validateSaga(model, saga), [model, saga]);
  const sagaPaths = useMemo(() => failurePaths(saga), [saga]);
  const [failAt, setFailAt] = useState<string>("s3");
  const sagaRun = useMemo(() => executeSaga(saga, {
    failAtStep: failAt,
    retryBehavior: "always-fails",
    compensateFailsAt: undefined,
  }), [saga, failAt]);

  const violation = ownership.violations[selectedViolation];

  return (
    <div>
      <Panel title="Consistency contracts" subtitle="What consistency does the architecture promise — and where may that promise break?">
        <ul className="space-y-2">
          {consistency.checks.map((c) => (
            <li key={c.contractId} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-100">{c.contractId}</span>
                <span className="text-slate-300">promises: {c.promised}</span>
                {VERDICT_BADGE[c.verdict]}
              </div>
              <p className="text-slate-300 mt-1">{c.detail}</p>
              {c.contractId === "cc-status" && (
                <div className="mt-2 rounded border border-slate-700/40 bg-slate-800/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Stale-read timeline (TTL 30 s)</div>
                  {consistencyTimeline(model, "cc-status", 30).map((e, i) => (
                    <div key={i} className="text-[11px] text-slate-300">
                      <span className="font-mono text-slate-400">t={e.t}</span> {e.actor}: {e.action} — {e.stale ? "STALE observation" : "fresh"}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
          {consistency.checks.length === 0 && <li className="text-xs text-slate-400">No consistency contracts declared.</li>}
        </ul>
      </Panel>

      <Panel title="Data ownership audit" subtitle="Who may mutate what — and which mutations cross transaction boundaries">
        <FindingsList findings={ownership.findings} emptyText="Ownership is clear and all mutations stay within one boundary." />
        {violation && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {ownership.violations.map((v, i) => (
                <button key={v.entityId + v.kind} onClick={() => setSelectedViolation(i)}
                  className={`rounded px-2 py-1 text-[11px] border ${i === selectedViolation
                    ? "border-sky-400 bg-sky-500/20 text-sky-200" : "border-slate-600 bg-slate-800/60 text-slate-300"}`}>
                  {v.kind}: {v.entityId}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
              <p className="text-xs text-slate-200 mb-2">{violation.detail}</p>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Refactoring alternatives (never auto-selected)</div>
              {refactorAlternatives(violation).map((a) => (
                <div key={a.approach} className="text-[11px] text-slate-300 mb-1.5">
                  <span className="font-semibold text-slate-100">{a.approach}</span>
                  <br />Applies when: {a.appliesWhen}
                  <br /><span className="text-slate-400">Trade-off: {a.tradeoff}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Event schema evolution" subtitle="Introduce a change and see which consumers it affects"
        right={
          <div className="flex gap-2">
            <Btn onClick={() => setEventVersion(1)} aria-pressed={eventVersion === 1}>v1</Btn>
            <Btn onClick={() => setEventVersion(2)} aria-pressed={eventVersion === 2}>propose v2 (+required tenantId)</Btn>
          </div>
        }>
        {eventSim ? (
          <div className="text-xs space-y-2">
            <p className="text-slate-200">
              Proposed v{eventSim.proposed.version}: <span className={eventSim.report.compatibility === "breaking" ? "text-rose-300" : eventSim.report.compatibility === "conditional" ? "text-amber-300" : "text-emerald-300"}>
                {eventSim.report.compatibility}
              </span> — {eventSim.report.explanation}
            </p>
            {eventSim.impactedConsumers.map((c) => (
              <p key={c.consumerComponentId} className="text-amber-300">Affected consumer: {c.consumerComponentId} — {c.reason}</p>
            ))}
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Safe migration path</div>
            {eventSim.safeMigrationPath.map((s, i) => <p key={i} className="text-slate-300">{s}</p>)}
          </div>
        ) : <p className="text-xs text-slate-400">No event contracts declared.</p>}
      </Panel>

      <Panel title="Idempotency replay debugger" subtitle="Two concurrent duplicate requests — how many side effects?">
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
          {idem.events.map((e, i) => (
            <p key={i} className="text-[11px] text-slate-300 font-mono">{e}</p>
          ))}
          <p className="mt-2 text-xs font-bold text-emerald-300">
            Final side-effect count: {idem.sideEffectCount} {idem.sideEffectCount === 1 ? "(duplicate suppressed)" : "(DUPLICATE EFFECT — bug)"}
          </p>
        </div>
      </Panel>

      <Panel title="Saga verifier" subtitle={`${saga.name} — failure paths and a deterministic timeline`}
        right={
          <select value={failAt} onChange={(e) => setFailAt(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100">
            {saga.steps.map((s) => <option key={s.id} value={s.id}>fail at: {s.name}</option>)}
          </select>
        }>
        {sagaIssues.length > 0 && <FindingsList findings={sagaIssues.map((i) => ({
          id: i.kind, severity: "warning" as const, title: i.kind, detail: i.detail, evidence: [], source: "saga",
        }))} />}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Failure paths</div>
            {sagaPaths.map((p, i) => (
              <p key={i} className="text-[11px] text-slate-300">
                <span className="font-semibold">{p.failAtStep}</span> {"→"} {p.outcome}
                {p.compensations.length > 0 && <span className="text-slate-400"> ({p.compensations.join(" ← ")})</span>}
              </p>
            ))}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Execution timeline (final: {sagaRun.finalState})
            </div>
            {sagaRun.events.map((e) => (
              <p key={e.t} className={`text-[11px] font-mono ${e.action === "fail" ? "text-rose-300" : e.action === "compensate" ? "text-amber-300" : e.action === "retry" ? "text-sky-300" : "text-slate-300"}`}>
                t={e.t} [{e.action}] {e.detail}
              </p>
            ))}
          </div>
        </div>
        <Callout kind="honest">{sagaRun.assumptions[0]}</Callout>
      </Panel>
    </div>
  );
};
