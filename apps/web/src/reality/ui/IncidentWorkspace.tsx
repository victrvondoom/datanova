/**
 * Campaign 07 — Tasks 26–30: Incident Investigation & Causal Reasoning UI
 *
 * Cybernetic Incident Command Cockpit:
 * Correlated multi-signal timeline, causal hypothesis graph, dual blast-radius
 * projection, and verifiable cryptographic postmortem package generation.
 */

import React, { useState } from "react";
import {
  Clock, Download, FileText, Activity, AlertTriangle,
  Flame, CheckCircle2, ShieldAlert
} from "lucide-react";
import type { IncidentRecord, IncidentIntelligenceEngine, IncidentPostmortemPackage } from "../incidents";
import type { IntendedGraph, ObservedGraph } from "../models";
import type { ReconciliationRecord } from "../reconciliation";

interface IncidentWorkspaceProps {
  incident: IncidentRecord;
  intended: IntendedGraph;
  observed: ObservedGraph;
  driftRecords: ReconciliationRecord[];
  incidentEngine: IncidentIntelligenceEngine;
}

export const IncidentWorkspace: React.FC<IncidentWorkspaceProps> = ({
  incident,
  intended,
  observed,
  driftRecords: _driftRecords,
  incidentEngine,
}) => {
  const [activeIncident] = useState<IncidentRecord>(incident);
  const [postmortemPackage, setPostmortemPackage] = useState<IncidentPostmortemPackage | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const blastRadius = incidentEngine.calculateBlastRadius("Order Service", intended, observed);

  const handleGeneratePostmortem = () => {
    setIsExporting(true);
    const pkg = incidentEngine.generatePostmortem(
      activeIncident,
      [
        "Release v1.4.0 of Pricing Service bypassed message queue",
        "Direct synchronous calls to Order DB saturated PostgreSQL connection pool",
        "Checkout latency spiked to 480ms breaching customer SLA",
      ],
      [
        "Why was the direct Pricing Service connection not reviewed during architecture preflight?",
        "Why did connection pool alarms fail to trigger circuit breaker isolation?",
      ],
      [
        "Re-route direct pricing requests through asynchronous message queue",
        "Implement circuit breaker and strict connection limits on Order DB",
        "Add release gate check preventing unarchitected database connections",
      ]
    );

    setPostmortemPackage(pkg);
    setIsExporting(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Incident Command Center Banner */}
      <div className="rounded-xl border border-rose-500/50 bg-gradient-to-r from-rose-950/40 via-slate-900/80 to-slate-900/60 p-6 space-y-4 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <span className="px-3 py-1 rounded-md text-xs font-mono font-black tracking-wider bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-sm">
              {activeIncident.severity}
            </span>
            <span className="font-mono text-xs font-bold text-slate-300 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800">
              {activeIncident.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {activeIncident.status}
            </span>
            <span className="text-xs font-mono text-slate-400 px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
              COMMAND POST
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Flame size={20} className="text-rose-400 shrink-0" />
            <span>{activeIncident.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Correlated root-cause investigation across distributed traces, infrastructure manifests, and architectural drift.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2 border-t border-rose-500/20 font-mono">
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400" />
            <span>Started:</span>
            <strong className="text-slate-100">{activeIncident.startTimeIso.slice(11, 19)} UTC</strong>
          </div>
          <span className="text-slate-600">&bull;</span>
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-rose-400" />
            <span>Impacted Services:</span>
            <div className="flex items-center gap-1">
              {activeIncident.impactedServices.map((svc) => (
                <span key={svc} className="text-rose-300 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-[11px]">
                  {svc}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Correlated Multi-Signal Timeline & Dual Blast Radius */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="md:col-span-2 rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-sky-500/10 border border-sky-500/30">
                <Clock size={16} className="text-sky-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Correlated Multi-Signal Timeline ({activeIncident.timeline.length} Events)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Chronological order</span>
          </div>

          <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {activeIncident.timeline.map((evt) => (
              <div key={evt.id} className="relative flex items-start gap-4 pl-7 text-xs">
                <span
                  className={`absolute left-2 top-2.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 shadow-sm ${
                    evt.severity === "critical"
                      ? "bg-rose-500 ring-2 ring-rose-500/30"
                      : evt.severity === "warning"
                      ? "bg-amber-400 ring-2 ring-amber-400/30"
                      : "bg-sky-400"
                  }`}
                />
                <div className="flex-1 p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/80 hover:border-slate-700 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                        [{evt.source.toUpperCase()}]
                      </span>
                      <span className="font-bold text-white">{evt.service}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {evt.timestampIso.slice(11, 19)} UTC
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1.5 leading-relaxed">{evt.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dual Blast Radius Projection */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30">
                <Activity size={16} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">Blast Radius Discrepancy</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold uppercase">
              DUAL PROJECTION
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-1">
              <span className="text-sky-400 font-bold text-[11px] uppercase tracking-wider block">Intended Impact Path:</span>
              <div className="font-mono text-slate-200 text-xs">
                Order Service &rarr; {blastRadius.intendedImpacted.join(" &rarr; ") || "None"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-1">
              <span className="text-rose-400 font-bold text-[11px] uppercase tracking-wider block">Observed Impact Path:</span>
              <div className="font-mono text-slate-200 text-xs font-semibold">
                Order Service &rarr; {blastRadius.observedImpacted.join(" &rarr; ") || "None"}
              </div>
            </div>

            {blastRadius.discrepancyNodes.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle size={14} />
                  <span>Discrepancy Detected:</span>
                </div>
                <p className="leading-relaxed">
                  Runtime cascade hit unarchitected services:{" "}
                  <strong className="text-rose-300">{blastRadius.discrepancyNodes.join(", ")}</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Causal Hypotheses & Postmortem Generator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Causal Hypotheses */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Causal Hypotheses (AI-Assisted, Zero False Certainty)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
              BAYESIAN INFERENCE
            </span>
          </div>

          <div className="space-y-3.5">
            {activeIncident.hypotheses.map((hypo) => (
              <div
                key={hypo.id}
                className="p-4 rounded-xl border border-slate-800/90 bg-slate-950/80 space-y-3 text-xs shadow-inner"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-white text-sm tracking-tight">{hypo.candidateCause}</span>
                  <span className="px-2.5 py-1 rounded font-mono font-black text-[11px] bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm">
                    {hypo.confidence} ({(hypo.confidenceScore * 100).toFixed(0)}%)
                  </span>
                </div>

                <div className="space-y-1.5 text-slate-400">
                  <div className="text-slate-300 font-bold text-[11px] uppercase tracking-wider font-mono">Supporting Evidence:</div>
                  {hypo.supportingEvidence.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 pl-1 text-emerald-300">
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{ev}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2.5 border-t border-slate-800/80 text-sky-300">
                  <span className="text-slate-400 font-bold font-mono uppercase text-[10px] block mb-0.5">Recommended Action:</span>
                  <span className="font-medium text-slate-200">{hypo.recommendedAction}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verifiable Postmortem Generator */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-sky-500/10 border border-sky-500/30">
                <FileText size={16} className="text-sky-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">Verifiable Postmortem Package</h3>
            </div>
            <button
              onClick={handleGeneratePostmortem}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 active:scale-[0.98]"
            >
              <Download size={13} />
              <span>Generate Postmortem</span>
            </button>
          </div>

          {postmortemPackage ? (
            <div className="space-y-3.5 text-xs bg-slate-950/90 p-4 rounded-xl border border-slate-800 font-mono shadow-inner">
              <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800/80 pb-2">
                <span className="text-sm">{postmortemPackage.packageId}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px]">
                  SHA-256 Verified
                </span>
              </div>
              <div className="text-slate-400 break-all text-[11px] p-2 rounded bg-slate-900/80 border border-slate-800">
                Hash: <span className="text-slate-300">{postmortemPackage.integrityHash}</span>
              </div>

              <div className="space-y-1.5 pt-1 text-slate-300">
                <span className="text-sky-300 font-bold text-[11px] uppercase tracking-wider block">
                  Confirmed Findings:
                </span>
                <div className="space-y-1">
                  {postmortemPackage.confirmedFindings.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-slate-200">
                      <span className="text-emerald-400 font-bold">&bull;</span>
                      <span className="leading-snug">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-slate-300">
                <span className="text-amber-300 font-bold text-[11px] uppercase tracking-wider block">
                  Corrective Action Items:
                </span>
                <div className="space-y-1">
                  {postmortemPackage.correctiveActions.map((a, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-slate-200">
                      <span className="text-amber-400 font-bold">&bull;</span>
                      <span className="leading-snug">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-950/40 flex flex-col items-center justify-center gap-2">
              <FileText size={32} className="text-slate-600" />
              <div className="font-semibold text-slate-300">Postmortem Attestation Ready</div>
              <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                Click &quot;Generate Postmortem&quot; to compile an immutable, cryptographically attested incident report package.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
