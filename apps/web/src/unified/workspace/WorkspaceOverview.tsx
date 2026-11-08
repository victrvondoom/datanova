/**
 * DataNova Campaign 08 — Workspace: 5.1 Overview View
 *
 * Real-Time Architecture Intelligence Dashboard:
 * Canonical components, live telemetry ingestion, active drift detection,
 * and direct workspace perspective access.
 */

import React from "react";
import {
  Boxes, Activity, ShieldAlert, GitBranch, ArrowRight, Zap,
  ShieldCheck, CheckCircle2, Radio
} from "lucide-react";
import type { Project } from "../../atlas/state";
import type { ArchitectureModel } from "../../lab/model";
import { useLiveTelemetry } from "../liveTelemetry";

interface WorkspaceOverviewProps {
  project: Project;
  model: ArchitectureModel;
  onNavigateSubView: (subview: "map" | "analyze" | "investigate" | "improve") => void;
  onOpenOrchestrator: (initialPrompt?: string) => void;
  darkMode?: boolean;
}

export const WorkspaceOverview: React.FC<WorkspaceOverviewProps> = ({
  project,
  model,
  onNavigateSubView,
  onOpenOrchestrator,
  darkMode = true,
}) => {
  const telemetry = useLiveTelemetry();

  return (
    <div className={`max-w-6xl mx-auto space-y-6 transition-colors ${
      darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
    }`}>
      {/* Overview Top Welcome Card */}
      <div className={`p-6 rounded-2xl border space-y-5 shadow-2xl relative overflow-hidden transition-all ${
        darkMode
          ? "border-[#27272a] bg-gradient-to-r from-[#141416] via-[#18181b] to-[#121214]"
          : "border-[#e8e6e1] bg-gradient-to-r from-[#ffffff] via-[#fbfaf8] to-[#f5f4f0] shadow-stone-200/50"
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 relative z-10 ${
          darkMode ? "border-[#27272a]" : "border-[#e8e6e1]"
        }`}>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xl font-black tracking-tight">{project.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/10 text-amber-500 border border-amber-500/30">
                RECONCILED STUDIO
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                darkMode ? "bg-[#18181b] border-[#27272a] text-[#a1a1aa]" : "bg-[#f5f4f0] border-[#dedbd5] text-[#63626b]"
              }`}>
                v{project.version}
              </span>
            </div>
            <p className={`text-xs mt-1 max-w-2xl leading-relaxed ${
              darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
            }`}>
              {project.description || "Production-grade microservices architecture model with active telemetry reconciliation."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenOrchestrator(`Investigate architecture health for ${project.name}`)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#09090b] font-bold text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 active:scale-95"
            >
              <Zap size={14} className="text-[#09090b]" />
              <span>Ask Orchestrator</span>
            </button>
          </div>
        </div>

        {/* 4 Real-Time Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 relative z-10">
          <div
            onClick={() => onNavigateSubView("map")}
            className={`p-4 rounded-xl border transition-all cursor-pointer group ${
              darkMode
                ? "bg-[#0c0c0e] border-[#27272a] hover:border-amber-500/60"
                : "bg-[#ffffff] border-[#e8e6e1] hover:border-amber-500/60 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
              }`}>
                System Components
              </div>
              <Boxes size={14} className="text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black font-mono mt-1.5">
              {model.components.length} Services
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
            }`}>
              <span>{model.connections.length} connections mapped</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateSubView("investigate")}
            className={`p-4 rounded-xl border transition-all cursor-pointer group ${
              darkMode
                ? "bg-[#0c0c0e] border-[#27272a] hover:border-emerald-500/60"
                : "bg-[#ffffff] border-[#e8e6e1] hover:border-emerald-500/60 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
              }`}>
                Live Telemetry Stream
              </div>
              <Radio size={14} className="text-emerald-500 animate-pulse" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-500 mt-1.5 flex items-center gap-2">
              <span>{telemetry.rps} req/s</span>
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
            }`}>
              <span>p95: {telemetry.p95Latency}ms &bull; {telemetry.totalSpans.toLocaleString()} spans</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateSubView("investigate")}
            className={`p-4 rounded-xl border transition-all cursor-pointer group ${
              darkMode
                ? "bg-[#0c0c0e] border-[#27272a] hover:border-rose-500/60"
                : "bg-[#ffffff] border-[#e8e6e1] hover:border-rose-500/60 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
              }`}>
                Active Drift Findings
              </div>
              <ShieldAlert size={14} className="text-rose-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-500 mt-1.5">
              {telemetry.activeDriftCount} Critical Drift
            </div>
            <div className="text-xs text-rose-400 mt-1 flex items-center gap-1 font-medium">
              <span>Pricing Service undocumented ingress</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateSubView("improve")}
            className={`p-4 rounded-xl border transition-all cursor-pointer group ${
              darkMode
                ? "bg-[#0c0c0e] border-[#27272a] hover:border-purple-500/60"
                : "bg-[#ffffff] border-[#e8e6e1] hover:border-purple-500/60 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
              }`}>
                Review Verification
              </div>
              <ShieldCheck size={14} className="text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-500 mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 size={18} className="text-emerald-500 inline" />
              <span>1 Ready</span>
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
            }`}>
              <span>SHA-256 seal verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* What Needs Attention & Perspectives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Urgent Findings Card */}
        <div className={`p-5 rounded-2xl border backdrop-blur-md space-y-4 shadow-xl ${
          darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${
            darkMode ? "border-[#27272a]" : "border-[#e8e6e1]"
          }`}>
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-500" />
              <h3 className="text-sm font-bold">Findings Needing Attention</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold border border-rose-500/25">
              1 ACTION REQUIRED
            </span>
          </div>

          <div className="space-y-3">
            <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
              darkMode
                ? "border-rose-500/40 bg-rose-950/20"
                : "border-rose-200 bg-rose-50/50"
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Order Service &rarr; Pricing Service</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold uppercase">
                  Critical Drift
                </span>
              </div>
              <p className={`leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Order Service is directly making synchronous queries to Pricing Service, bypassing the declared message queue.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className={`text-[10px] font-mono ${darkMode ? "text-[#71717a]" : "text-[#71717a]"}`}>
                  Discovered via runtime traces
                </span>
                <button
                  onClick={() => onNavigateSubView("investigate")}
                  className="text-xs font-bold text-amber-500 hover:underline inline-flex items-center gap-1"
                >
                  <span>Investigate in Workbench</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Workspace Navigation Card */}
        <div className={`p-5 rounded-2xl border backdrop-blur-md space-y-4 shadow-xl ${
          darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
        }`}>
          <div className={`border-b pb-3 ${darkMode ? "border-[#27272a]" : "border-[#e8e6e1]"}`}>
            <h3 className="text-sm font-bold">Workspace Perspectives</h3>
            <p className={`text-xs mt-0.5 ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
              Direct access to architecture intelligence tools
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigateSubView("map")}
              className={`p-3.5 rounded-xl border text-left space-y-1.5 transition-all group ${
                darkMode
                  ? "border-[#27272a] bg-[#0c0c0e] hover:border-amber-500/60"
                  : "border-[#e8e6e1] bg-[#fbfaf8] hover:border-amber-500/60"
              }`}
            >
              <Boxes size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold group-hover:text-amber-500 transition-colors">3D System Map</div>
              <p className={`text-[11px] ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                WebGL 3D Studio & 10 layers
              </p>
            </button>

            <button
              onClick={() => onNavigateSubView("analyze")}
              className={`p-3.5 rounded-xl border text-left space-y-1.5 transition-all group ${
                darkMode
                  ? "border-[#27272a] bg-[#0c0c0e] hover:border-amber-500/60"
                  : "border-[#e8e6e1] bg-[#fbfaf8] hover:border-amber-500/60"
              }`}
            >
              <Activity size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold group-hover:text-amber-500 transition-colors">Analyze & Model</div>
              <p className={`text-[11px] ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Traffic scenarios, SLOs & queues
              </p>
            </button>

            <button
              onClick={() => onNavigateSubView("investigate")}
              className={`p-3.5 rounded-xl border text-left space-y-1.5 transition-all group ${
                darkMode
                  ? "border-[#27272a] bg-[#0c0c0e] hover:border-amber-500/60"
                  : "border-[#e8e6e1] bg-[#fbfaf8] hover:border-amber-500/60"
              }`}
            >
              <ShieldAlert size={16} className="text-rose-500 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold group-hover:text-rose-500 transition-colors">Investigate Drift</div>
              <p className={`text-[11px] ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Telemetry diff & root causes
              </p>
            </button>

            <button
              onClick={() => onNavigateSubView("improve")}
              className={`p-3.5 rounded-xl border text-left space-y-1.5 transition-all group ${
                darkMode
                  ? "border-[#27272a] bg-[#0c0c0e] hover:border-amber-500/60"
                  : "border-[#e8e6e1] bg-[#fbfaf8] hover:border-amber-500/60"
              }`}
            >
              <GitBranch size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold group-hover:text-emerald-500 transition-colors">Improve & Compare</div>
              <p className={`text-[11px] ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                ADRs, mutations & release gates
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
