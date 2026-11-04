/**
 * Campaign 07 — Tasks 13–15 & Section 8: Architecture Reconciliation & Drift Triage
 *
 * Displays three-way reconciliation findings, undocumented runtime dependencies,
 * severity classifications, and the triage remediation lifecycle.
 */

import React, { useState } from "react";
import {
  GitCompare, AlertTriangle, Layers,
  Check
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
    setTimeout(() => setActionSuccess(null), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Three-Way Architecture Reconciliation</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Detects divergences between Intended Architecture, Configured Infrastructure, and Observed Runtime Evidence.
          </p>
        </div>
        <button
          onClick={onOpenInStudio}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
        >
          <Layers size={14} />
          <span>View in 3D Spatial Map</span>
        </button>
      </div>

      {/* Section 8 Mandatory Showcase Banner */}
      <div className="rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              SECTION 8 MANDATORY RECONCILIATION DEMO
            </span>
            <span className="text-xs font-bold text-white">Undocumented Dependency Detection</span>
          </div>
          <span className="text-xs font-mono text-rose-400 font-bold">CONFIRMED DRIFT</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          The architecture model declares: <span className="font-mono text-sky-300">API Gateway &rarr; Order Service &rarr; Message Queue &rarr; Order Worker &rarr; Order Database</span>.
          <br />
          Observed runtime traces reveal: <span className="font-mono text-rose-300">Order Service &rarr; Pricing Service &rarr; Order Database</span>.
          Direct synchronous pricing calls bypass the declared message queue, creating unarchitected coupling and latency risk.
        </p>

        <div className="flex items-center gap-3 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-rose-300 font-medium">
            <AlertTriangle size={14} />
            <span>Target Service: <strong>Pricing Service</strong> (Missing from Design)</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="text-slate-400">
            Detected via: <strong className="text-slate-200 font-mono">OpenTelemetry Spans (tr-001)</strong>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">Filter Severity:</span>
        {["all", "critical", "high", "medium", "low"].map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              severityFilter === sev
                ? "bg-sky-500 text-white font-bold"
                : "bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Drift Inbox & Inspector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Drift Finding Inbox List */}
        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GitCompare size={16} className="text-sky-400" />
              <span>Drift Inbox ({filteredRecords.length} Findings)</span>
            </h3>
            <span className="text-xs text-slate-500">Click a finding to inspect & triage</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
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
                  className={`cursor-pointer rounded-lg border p-3 transition-all ${
                    isSelected
                      ? "border-sky-500 bg-sky-500/15"
                      : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${sevBadge}`}>
                        {rec.severity}
                      </span>
                      <span className="font-bold text-white truncate">
                        {rec.sourceService} {rec.targetService ? `→ ${rec.targetService}` : ""}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {rec.humanReviewStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                    {rec.severityRationale}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-slate-500">
                    <span>Classification: {rec.driftClassification}</span>
                    <span>&bull;</span>
                    <span className="text-sky-400 font-semibold">{rec.confidenceCategory}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drift Inspector & Triage Actions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Reconciliation Inspector</h3>

          {selectedRecord ? (
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase">Drift Finding ID</span>
                <div className="font-mono text-slate-200 text-xs mt-0.5 break-all">{selectedRecord.id}</div>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase">Severity & Classification</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold uppercase text-rose-400 font-mono">{selectedRecord.severity}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-200 capitalize">{selectedRecord.driftClassification.replace("_", " ")}</span>
                </div>
              </div>

              {/* Three-Way State Comparison */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-slate-400 font-semibold text-[11px] block mb-1">Three-Way State Comparison:</span>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-sky-400 font-medium">1. Intended Design:</span>
                  <span className={`font-mono font-bold ${selectedRecord.intendedStatus === "present" ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedRecord.intendedStatus.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-purple-400 font-medium">2. Configured Infra:</span>
                  <span className={`font-mono font-bold ${selectedRecord.configuredStatus === "present" ? "text-emerald-400" : "text-slate-500"}`}>
                    {selectedRecord.configuredStatus.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-medium">3. Observed Runtime:</span>
                  <span className={`font-mono font-bold ${selectedRecord.observedStatus === "present" ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedRecord.observedStatus.toUpperCase()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase">Severity Rationale</span>
                <p className="text-slate-300 mt-1 leading-relaxed">{selectedRecord.severityRationale}</p>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase">Confidence Category</span>
                <div className="text-sky-300 font-mono font-bold mt-0.5">{selectedRecord.confidenceCategory}</div>
              </div>

              {selectedRecord.resolutionNote && (
                <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs">
                  {selectedRecord.resolutionNote}
                </div>
              )}

              {/* Triage Action Panel */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-slate-300 font-semibold text-xs block">Remediation Triage:</span>
                <input
                  type="text"
                  placeholder="Rationale or notes for triage decision..."
                  value={rationaleInput}
                  onChange={(e) => setRationaleInput(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleAction("acknowledge")}
                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleAction("investigate")}
                    className="px-2.5 py-1.5 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-colors"
                  >
                    Investigate
                  </button>
                  <button
                    onClick={() => handleAction("accept_as_intended")}
                    className="col-span-2 px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors shadow-sm"
                  >
                    Accept as Intended (Update Model)
                  </button>
                </div>

                {actionSuccess && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                    <Check size={12} />
                    <span>{actionSuccess}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">Select a drift finding to inspect details.</div>
          )}
        </div>
      </div>
    </div>
  );
};
