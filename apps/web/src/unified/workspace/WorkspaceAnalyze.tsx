/**
 * DataNova Campaign 08 — Workspace: 5.3 Analyze View
 *
 * Unifies scenario execution, simulations, what-if capacity modeling,
 * queueing dynamics, latency analysis, and reliability objectives (SLOs).
 */

import React, { useState, useMemo } from "react";
import type { ArchitectureModel } from "../../lab/model";
import { ExperimentsView } from "../../atlas/views/Experiments";
import { ReliabilityView } from "../../reality/ui/ReliabilityView";
import { ReliabilityEngine } from "../../reality/reliability";
import { section8ObservedSpans } from "../../reality/fixtures";

interface WorkspaceAnalyzeProps {
  model: ArchitectureModel;
  setAnnounce?: (msg: string) => void;
}

export const WorkspaceAnalyze: React.FC<WorkspaceAnalyzeProps> = ({
  model,
  setAnnounce = () => {},
}) => {
  const [activeTab, setActiveTab] = useState<"scenarios" | "reliability">("scenarios");

  const reliabilityEngine = useMemo(() => new ReliabilityEngine(), []);
  const spans = useMemo(() => section8ObservedSpans(), []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header and Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">System Analysis & Simulation</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
              SIMULATION ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Test traffic scenarios, queueing limits, critical-path latency bottlenecks, and service SLO compliance.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
          <button
            onClick={() => setActiveTab("scenarios")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "scenarios"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>Traffic Scenarios & Queues</span>
          </button>
          <button
            onClick={() => setActiveTab("reliability")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "reliability"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>Reliability & SLOs</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "scenarios" && (
        <div className="space-y-6">
          <ExperimentsView model={model} setAnnounce={setAnnounce} />
        </div>
      )}

      {activeTab === "reliability" && (
        <div className="space-y-6">
          <ReliabilityView
            spans={spans}
            driftCount={1}
            reliabilityEngine={reliabilityEngine}
          />
        </div>
      )}
    </div>
  );
};
