/**
 * DataNova Campaign 08 — Workspace: 5.3 Analyze View
 *
 * Unifies scenario execution, simulations, what-if capacity modeling,
 * queueing dynamics, latency analysis, and reliability objectives (SLOs).
 * Styled in luxury creamy white and creamy black aesthetic with cursive typography.
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
  darkMode?: boolean;
}

export const WorkspaceAnalyze: React.FC<WorkspaceAnalyzeProps> = ({
  model,
  setAnnounce = () => {},
  darkMode = true,
}) => {
  const [activeTab, setActiveTab] = useState<"scenarios" | "reliability">("scenarios");

  const reliabilityEngine = useMemo(() => new ReliabilityEngine(), []);
  const spans = useMemo(() => section8ObservedSpans(), []);

  return (
    <div className={`max-w-6xl mx-auto space-y-6 transition-colors ${
      darkMode ? "text-[#f5f2eb]" : "text-[#181716]"
    }`}>
      {/* Header and Sub-Tab Switcher */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border backdrop-blur-md shadow-lg ${
        darkMode ? "border-[#2e2a24] bg-[#1c1a17]/90" : "border-[#e5dec9] bg-[#fdfcf9]"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">System Analysis & Simulation</h2>
            <span className="font-cursive text-xl text-[#b8860b] dark:text-[#dfba49]">
              Behavior & Load Modeling
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              SIMULATION ENGINE
            </span>
          </div>
          <p className={`text-xs mt-1 leading-relaxed ${darkMode ? "text-[#c2bcb2]" : "text-[#575249]"}`}>
            Test traffic scenarios, queueing limits, critical-path latency bottlenecks, and service SLO compliance.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
          darkMode ? "bg-[#141312] border-[#2e2a24]" : "bg-[#f5efe4] border-[#ded4c0]"
        }`}>
          <button
            onClick={() => setActiveTab("scenarios")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "scenarios"
                ? "bg-gradient-to-r from-[#c59b27] to-[#a37d1d] text-[#181716] shadow-sm font-bold"
                : darkMode
                ? "text-[#a69f93] hover:text-[#f5f2eb]"
                : "text-[#6e675f] hover:text-[#181716]"
            }`}
          >
            <span>Traffic Scenarios & Queues</span>
          </button>
          <button
            onClick={() => setActiveTab("reliability")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "reliability"
                ? "bg-gradient-to-r from-[#c59b27] to-[#a37d1d] text-[#181716] shadow-sm font-bold"
                : darkMode
                ? "text-[#a69f93] hover:text-[#f5f2eb]"
                : "text-[#6e675f] hover:text-[#181716]"
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
