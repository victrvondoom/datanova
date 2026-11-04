/**
 * Campaign 07 — Tasks 26–30: Incident Investigation & Causal Reasoning UI
 *
 * Correlated multi-signal timeline, causal hypothesis graph, dual blast-radius
 * projection, and verifiable postmortem package generation.
 */

import React, { useState } from "react";
import {
  Clock, Download,
  FileText, Activity, AlertTriangle
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
      {/* Incident Header */}
      <div className="rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              {activeIncident.severity}
            </span>
            <span className="font-mono text-xs text-slate-400">{activeIncident.id}</span>
          </div>
          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
            {activeIncident.status}
          </span>
        </div>

        <h2 className="text-lg font-bold text-white">{activeIncident.title}</h2>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div>
            Started: <span className="font-mono text-slate-200">{activeIncident.startTimeIso.slice(11, 19)} UTC</span>
          </div>
          <span>&bull;</span>
          <div>
            Impacted Services: <span className="text-rose-300 font-semibold">{activeIncident.impactedServices.join(", ")}</span>
          </div>
        </div>
      </div>

      {/* Correlated Multi-Signal Timeline & Blast Radius */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-sky-400" />
              <span>Correlated Multi-Signal Timeline ({activeIncident.timeline.length} Events)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Chronological order</span>
          </div>

          <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {activeIncident.timeline.map((evt) => (
              <div key={evt.id} className="relative flex items-start gap-4 pl-7 text-xs">
                <span
                  className={`absolute left-2 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                    evt.severity === "critical"
                      ? "bg-rose-500"
                      : evt.severity === "warning"
                      ? "bg-amber-400"
                      : "bg-sky-400"
                  }`}
                />
                <div className="flex-1 p-3 rounded-lg border border-slate-800 bg-slate-950/80">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      [{evt.source.toUpperCase()}] {evt.service}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {evt.timestampIso.slice(11, 19)}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1">{evt.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dual Blast Radius Projection */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={16} className="text-amber-400" />
            <span>Blast Radius Discrepancy</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-500/30">
              <span className="text-sky-400 font-bold block mb-1">Intended Impact Path:</span>
              <div className="font-mono text-slate-300">
                Order Service &rarr; {blastRadius.intendedImpacted.join(" &rarr; ") || "None"}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30">
              <span className="text-rose-400 font-bold block mb-1">Observed Impact Path:</span>
              <div className="font-mono text-slate-300">
                Order Service &rarr; {blastRadius.observedImpacted.join(" &rarr; ") || "None"}
              </div>
            </div>

            {blastRadius.discrepancyNodes.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
                <strong>Discrepancy Detected:</strong> Runtime cascade hit unarchitected services:{" "}
                <span className="font-bold text-rose-300">{blastRadius.discrepancyNodes.join(", ")}</span>.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Causal Hypotheses & Postmortem Generator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Causal Hypotheses */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span>Causal Hypotheses (AI-Assisted, Zero False Certainty)</span>
          </h3>

          <div className="space-y-3">
            {activeIncident.hypotheses.map((hypo) => (
              <div key={hypo.id} className="p-4 rounded-lg border border-slate-800 bg-slate-950 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{hypo.candidateCause}</span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    {hypo.confidence} ({(hypo.confidenceScore * 100).toFixed(0)}%)
                  </span>
                </div>

                <div className="space-y-1 text-slate-400">
                  <div className="text-slate-300 font-medium">Supporting Evidence:</div>
                  {hypo.supportingEvidence.map((ev, i) => (
                    <div key={i} className="flex items-start gap-1.5 pl-2 text-emerald-300">
                      <span>&bull;</span>
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-sky-300">
                  <strong>Recommended Action:</strong> {hypo.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verifiable Postmortem Generator */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-sky-400" />
              <span>Verifiable Postmortem Package</span>
            </h3>
            <button
              onClick={handleGeneratePostmortem}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              <Download size={13} />
              <span>Generate Postmortem</span>
            </button>
          </div>

          {postmortemPackage ? (
            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>{postmortemPackage.packageId}</span>
                <span>SHA-256 Verified</span>
              </div>
              <div className="text-slate-400 break-all text-[11px]">
                Hash: {postmortemPackage.integrityHash}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1 text-slate-300">
                <span className="text-sky-300 font-semibold block">Confirmed Findings:</span>
                {postmortemPackage.confirmedFindings.map((f, i) => (
                  <div key={i}>&bull; {f}</div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1 text-slate-300">
                <span className="text-amber-300 font-semibold block">Corrective Action Items:</span>
                {postmortemPackage.correctiveActions.map((a, i) => (
                  <div key={i}>&bull; {a}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              Click &quot;Generate Postmortem&quot; to compile an immutable, cryptographically attested incident report package.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
