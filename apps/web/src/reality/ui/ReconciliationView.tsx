/**
 * Campaign 07 — Tasks 13–15 & Section 8: Architecture Reconciliation & Drift Triage
 *
 * Displays three-way reconciliation findings, undocumented runtime dependencies,
 * severity classifications, and the triage remediation lifecycle.
 */

import React, { useState } from "react";
import {
  GitCompare, AlertTriangle, Layers,
  Check, ArrowRight, ShieldAlert, Network, Server, Activity, ArrowUpRight
} from "lucide-react";
import type { ReconciliationRecord } from "../reconciliation";

interface ReconciliationViewProps {
  driftRecords: ReconciliationRecord[];
  onTriageAction: (recordId: string, action: any, rationale: string) => void;
  onOpenInStudio: () => void;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  driftRecords,
  onTriageAction,
  onOpenInStudio,
}) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string>(driftRecords[0]?.id || "");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [rationaleInput, setRationaleInput] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filteredRecords = driftRecords.filter((r) => {
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    return true;
  });

  const selectedRecord = driftRecords.find((r) => r.id === selectedRecordId) || driftRecords[0];

  const handleAction = (action: string) => {
    if (!selectedRecord) return;
    const rationale = rationaleInput.trim() || `Triage action: ${action}`;
    onTriageAction(selectedRecord.id, action, rationale);
    setRationaleInput("");
    setActionSuccess(`Applied action "${action.toUpperCase()}" to ${selectedRecord.id}`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const section8Drift = driftRecords.find(
    (r) => r.sourceService === "Order Service" && r.targetService === "Pricing Service"
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-500/10 text-rose-300 border border-rose-500/30">
              RECONCILIATION COCKPIT
            </span>
            <span className="text-slate-500 text-xs">&bull;</span>
            <span className="text-xs text-slate-400 font-mono">3-WAY DIFF ACTIVE</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Three-Way Architecture Reconciliation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Detects divergences between Intended Architecture, Configured Infrastructure, and Observed Runtime Evidence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenInStudio}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all shadow-sm"
          >
            <Layers size={14} className="text-sky-400" />
            <span>View in 3D Spatial Map</span>
          </button>
        </div>
      </div>

      {/* Section 8 Mandatory Showcase Banner */}
      <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/80 to-slate-900/80 p-5 space-y-3.5 shadow-xl shadow-rose-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
              SECTION 8 MANDATORY RECONCILIATION DEMO
            </span>
            <span className="text-xs font-bold text-white">Undocumented Dependency Detection</span>
          </div>
          <span className="text-xs font-mono text-rose-400 font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">
            CONFIRMED DRIFT
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed relative z-10">
          The architecture model declares: <span className="font-mono text-sky-300 font-bold">API Gateway &rarr; Order Service &rarr; Message Queue &rarr; Order Worker &rarr; Order Database</span>.
          <br />
          Observed runtime traces reveal: <span className="font-mono text-rose-300 font-bold">Order Service &rarr; Pricing Service &rarr; Order Database</span>.
          Direct synchronous pricing calls bypass the declared message queue, creating unarchitected coupling and latency risk.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs border-t border-rose-500/20 relative z-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
              <AlertTriangle size={14} className="text-rose-400" />
              <span>Target Service: <strong>Pricing Service</strong> (Missing from Design)</span>
            </div>
            <span className="text-slate-600 hidden sm:inline">&bull;</span>
            <div className="text-slate-400">
              Detected via: <strong className="text-slate-200 font-mono">OpenTelemetry Spans (tr-001)</strong>
            </div>
          </div>

          {section8Drift && (
            <button
              onClick={() => setSelectedRecordId(section8Drift.id)}
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
            >
              <span>Inspect Finding</span>
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Quick Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-medium mr-1">Filter Severity:</span>
          {["all", "critical", "high", "medium", "low"].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all ${
                severityFilter === sev
                  ? "bg-sky-500 text-white font-bold shadow-sm shadow-sky-500/30"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span>Total: <strong className="text-white">{driftRecords.length}</strong></span>
          <span>&bull;</span>
          <span>Critical: <strong className="text-rose-400">{driftRecords.filter((r) => r.severity === "critical").length}</strong></span>
          <span>&bull;</span>
          <span>Unreviewed: <strong className="text-amber-300">{driftRecords.filter((r) => r.humanReviewStatus === "unreviewed").length}</strong></span>
        </div>
      </div>

      {/* Drift Inbox & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drift Finding Inbox List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3.5 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GitCompare size={16} className="text-sky-400" />
              <span>Drift Inbox ({filteredRecords.length} Findings)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Prioritized by Severity</span>
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredRecords.map((rec) => {
              const isSelected = rec.id === selectedRecord?.id;
              const sevBadge =
                rec.severity === "critical"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : rec.severity === "high"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-sky-500/20 text-sky-300 border-sky-500/40";

              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecordId(rec.id)}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? "border-sky-500 bg-sky-500/15 shadow-md shadow-sky-500/10"
                      : "border-slate-800/90 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${sevBadge}`}>
                        {rec.severity}
                      </span>
                      <span className="font-bold text-white truncate text-xs">
                        {rec.sourceService} {rec.targetService ? `→ ${rec.targetService}` : ""}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                      rec.humanReviewStatus === "accepted_as_intended"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : rec.humanReviewStatus === "investigating"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {rec.humanReviewStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                    {rec.severityRationale}
                  </p>

                  <div className="flex items-center gap-3 mt-2.5 text-[10px] font-mono text-slate-500">
                    <span>Classification: <span className="text-slate-300">{rec.driftClassification}</span></span>
                    <span>&bull;</span>
                    <span className="text-sky-400 font-semibold">{rec.confidenceCategory}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drift Inspector & Triage Actions */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 shadow-lg flex flex-col">
          <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-400" />
              <span>Reconciliation Inspector</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">TRIAGE WORKBENCH</span>
          </div>

          {selectedRecord ? (
            <div className="space-y-4 text-xs flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div>
                  <span className="text-slate-500 font-mono text-[10px] uppercase block">Drift Finding ID</span>
                  <div className="font-mono text-slate-200 text-xs mt-0.5 break-all font-semibold bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    {selectedRecord.id}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-mono text-[10px] uppercase block">Severity & Classification</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold uppercase text-rose-400 font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">
                      {selectedRecord.severity}
                    </span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-200 capitalize font-medium">{selectedRecord.driftClassification.replace("_", " ")}</span>
                  </div>
                </div>

                {/* Three-Way State Comparison Card */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-slate-400 font-bold text-[11px] block border-b border-slate-800/80 pb-1">
                    Three-Way State Comparison:
                  </span>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-sky-400 font-medium flex items-center gap-1.5">
                      <Network size={12} /> 1. Intended Design:
                    </span>
                    <span className={`font-mono font-bold ${selectedRecord.intendedStatus === "present" ? "text-emerald-400" : "text-rose-400"}`}>
                      {selectedRecord.intendedStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-purple-400 font-medium flex items-center gap-1.5">
                      <Server size={12} /> 2. Configured Infra:
                    </span>
                    <span className={`font-mono font-bold ${selectedRecord.configuredStatus === "present" ? "text-emerald-400" : "text-slate-500"}`}>
                      {selectedRecord.configuredStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <Activity size={12} /> 3. Observed Runtime:
                    </span>
                    <span className={`font-mono font-bold ${selectedRecord.observedStatus === "present" ? "text-emerald-400" : "text-rose-400"}`}>
                      {selectedRecord.observedStatus.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-mono text-[10px] uppercase block">Severity Rationale</span>
                  <p className="text-slate-300 mt-1 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    {selectedRecord.severityRationale}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 font-mono text-[10px] uppercase block">Confidence Category</span>
                  <div className="text-sky-300 font-mono font-bold mt-1 px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 inline-block">
                    {selectedRecord.confidenceCategory}
                  </div>
                </div>

                {selectedRecord.resolutionNote && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs">
                    <span className="font-bold block mb-0.5">Resolution Record:</span>
                    <span>{selectedRecord.resolutionNote}</span>
                  </div>
                )}
              </div>

              {/* Triage Action Panel */}
              <div className="pt-3.5 border-t border-slate-800 space-y-2.5">
                <span className="text-slate-200 font-bold text-xs block">Remediation Triage:</span>
                <input
                  type="text"
                  placeholder="Rationale or notes for triage decision..."
                  value={rationaleInput}
                  onChange={(e) => setRationaleInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleAction("acknowledge")}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleAction("investigate")}
                    className="px-3 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-colors"
                  >
                    Investigate
                  </button>
                  <button
                    onClick={() => handleAction("accept_as_intended")}
                    className="col-span-2 px-3.5 py-2.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5"
                  >
                    <span>Accept as Intended (Update Model)</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {actionSuccess && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1.5 mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <Check size={14} className="shrink-0" />
                    <span>{actionSuccess}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-12 text-center">
              Select a drift finding to inspect details and initiate triage.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
