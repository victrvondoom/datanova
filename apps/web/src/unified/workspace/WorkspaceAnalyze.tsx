/**
 * DataNova Campaign 08 — Workspace: 5.3 Analyze View
 *
 * Real-Time Dynamic Simulation & Capacity Workbench:
 * Interactive load testing, queueing limits, critical-path latency calculation,
 * and service level objective (SLO) compliance.
 */

import React, { useState, useMemo } from "react";
import { Sliders, Activity } from "lucide-react";
import type { ArchitectureModel } from "../../lab/model";
import { ExperimentsView } from "../../atlas/views/Experiments";
import { ReliabilityView } from "../../reality/ui/ReliabilityView";
import { ReliabilityEngine } from "../../reality/reliability";
import { section8ObservedSpans } from "../../reality/fixtures";
import { DifferentialWorkbench } from "../../reality/ui/DifferentialWorkbench";

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
  const [activeTab, setActiveTab] = useState<"differential" | "scenarios" | "reliability">("differential");
  const [simulatedRps, setSimulatedRps] = useState<number>(1200);

  const reliabilityEngine = useMemo(() => new ReliabilityEngine(), []);
  const spans = useMemo(() => section8ObservedSpans(), []);

  // Real-time capacity calculations
  const predictedP95 = useMemo(() => {
    return Math.round(42 + Math.pow(simulatedRps / 850, 2.2) * 24);
  }, [simulatedRps]);

  const queueBacklog = useMemo(() => {
    return simulatedRps > 1400 ? Math.round((simulatedRps - 1400) * 0.48) : 0;
  }, [simulatedRps]);

  const headroomPct = useMemo(() => {
    return Math.max(0, Math.round(((2500 - simulatedRps) / 2500) * 100));
  }, [simulatedRps]);

  const statusLevel: "healthy" | "warning" | "critical" =
    simulatedRps > 2100 ? "critical" : simulatedRps > 1400 ? "warning" : "healthy";

  return (
    <div className={`max-w-6xl mx-auto space-y-6 transition-colors ${
      darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
    }`}>
      {/* Header and Sub-Tab Switcher */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border backdrop-blur-md shadow-lg ${
        darkMode ? "border-[#27272a] bg-[#141416]" : "border-[#e8e6e1] bg-[#ffffff]"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">System Analysis & Simulation</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/30">
              RK4 DIFFERENTIAL CALCULUS
            </span>
          </div>
          <p className={`text-xs mt-1 leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
            Continuous differential equations, phase space trajectories, queueing limits, critical-path latency, and SLO compliance.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
          darkMode ? "bg-[#0c0c0e] border-[#27272a]" : "bg-[#f5f4f0] border-[#dedbd5]"
        }`}>
          <button
            onClick={() => setActiveTab("differential")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "differential"
                ? "bg-amber-500 text-[#09090b] shadow-sm font-bold"
                : darkMode
                ? "text-[#a1a1aa] hover:text-[#f4f4f5]"
                : "text-[#63626b] hover:text-[#111113]"
            }`}
          >
            <Activity size={13} />
            <span>Differential Equations (RK4)</span>
          </button>
          <button
            onClick={() => setActiveTab("scenarios")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "scenarios"
                ? "bg-amber-500 text-[#09090b] shadow-sm font-bold"
                : darkMode
                ? "text-[#a1a1aa] hover:text-[#f4f4f5]"
                : "text-[#63626b] hover:text-[#111113]"
            }`}
          >
            <span>Traffic Scenarios & Queues</span>
          </button>
          <button
            onClick={() => setActiveTab("reliability")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "reliability"
                ? "bg-amber-500 text-[#09090b] shadow-sm font-bold"
                : darkMode
                ? "text-[#a1a1aa] hover:text-[#f4f4f5]"
                : "text-[#63626b] hover:text-[#111113]"
            }`}
          >
            <span>Reliability & SLOs</span>
          </button>
        </div>
      </div>

      {/* Dynamic Interactive Traffic & Capacity Workbench */}
      <div className={`p-5 rounded-2xl border space-y-4 shadow-xl ${
        darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold">Interactive Dynamic Load Modeler</h3>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Live Parameter Injection
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className={`text-[11px] font-mono ${darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"}`}>Presets:</span>
            {[
              { label: "Normal (600 RPS)", val: 600 },
              { label: "Peak (1,500 RPS)", val: 1500 },
              { label: "Stress (2,400 RPS)", val: 2400 },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setSimulatedRps(p.val)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                  simulatedRps === p.val
                    ? "bg-amber-500 text-[#09090b] border-amber-500"
                    : darkMode
                    ? "bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5]"
                    : "bg-[#f5f4f0] border-[#dedbd5] text-[#63626b] hover:text-[#111113]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Slider & Real-Time Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
          <div className="lg:col-span-2 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className={darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}>Simulated Traffic Load:</span>
              <span className="font-black text-amber-500 text-sm">{simulatedRps.toLocaleString()} req/s</span>
            </div>
            <input
              type="range"
              min={200}
              max={3000}
              step={50}
              value={simulatedRps}
              onChange={(e) => setSimulatedRps(Number(e.target.value))}
              className="w-full accent-amber-500 h-2 rounded-lg cursor-pointer bg-zinc-700"
            />
            <div className={`flex justify-between text-[10px] font-mono ${darkMode ? "text-[#71717a]" : "text-[#71717a]"}`}>
              <span>200 RPS (Idle)</span>
              <span>1,400 RPS (Warning Boundary)</span>
              <span>3,000 RPS (Saturation)</span>
            </div>
          </div>

          {/* Metric 1: Predicted p95 Latency */}
          <div className={`p-3 rounded-xl border text-center ${
            darkMode ? "bg-[#0c0c0e] border-[#27272a]" : "bg-[#fbfaf8] border-[#e8e6e1]"
          }`}>
            <div className={`text-[10px] font-mono uppercase font-bold ${
              predictedP95 > 250 ? "text-rose-500" : predictedP95 > 150 ? "text-amber-500" : "text-emerald-500"
            }`}>
              Modeled p95
            </div>
            <div className="text-xl font-black font-mono mt-0.5">{predictedP95} ms</div>
            <div className={`text-[10px] ${darkMode ? "text-[#71717a]" : "text-[#71717a]"}`}>
              Critical path pricing scan
            </div>
          </div>

          {/* Metric 2: Queue Depth & Headroom */}
          <div className={`p-3 rounded-xl border text-center ${
            darkMode ? "bg-[#0c0c0e] border-[#27272a]" : "bg-[#fbfaf8] border-[#e8e6e1]"
          }`}>
            <div className={`text-[10px] font-mono uppercase font-bold ${
              statusLevel === "critical" ? "text-rose-500" : statusLevel === "warning" ? "text-amber-500" : "text-emerald-500"
            }`}>
              {statusLevel === "healthy" ? "Safe Headroom" : statusLevel === "warning" ? "Queueing" : "Saturated"}
            </div>
            <div className="text-xl font-black font-mono mt-0.5">
              {queueBacklog > 0 ? `${queueBacklog} msgs` : `${headroomPct}%`}
            </div>
            <div className={`text-[10px] ${darkMode ? "text-[#71717a]" : "text-[#71717a]"}`}>
              {queueBacklog > 0 ? "RabbitMQ buffer delay" : "Capacity headroom"}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "differential" && (
        <div className="space-y-6">
          <DifferentialWorkbench darkMode={darkMode} />
        </div>
      )}

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
