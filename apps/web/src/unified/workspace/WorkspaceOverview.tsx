/**
 * DataNova Campaign 08 — Workspace: 5.1 Overview View
 *
 * Plain-language summary of what the system contains, what DataNova understands,
 * what has been analyzed, what findings need attention, and recommended actions.
 */

import React from "react";
import {
  Boxes, Activity, ShieldAlert, GitBranch, ArrowRight, Zap,
  ShieldCheck, CheckCircle2, Radio
} from "lucide-react";
import type { Project } from "../../atlas/state";
import type { ArchitectureModel } from "../../lab/model";

interface WorkspaceOverviewProps {
  project: Project;
  model: ArchitectureModel;
  onNavigateSubView: (subview: "map" | "analyze" | "investigate" | "improve") => void;
  onOpenOrchestrator: (initialPrompt?: string) => void;
}

export const WorkspaceOverview: React.FC<WorkspaceOverviewProps> = ({
  project,
  model,
  onNavigateSubView,
  onOpenOrchestrator,
}) => {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Overview Top Welcome Card */}
      <div className="p-6 rounded-2xl border border-slate-800/90 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950 p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              <h2 className="text-xl font-bold text-white tracking-tight">{project.name}</h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                v{project.version}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {project.description || "Production-grade microservices architecture model with active telemetry reconciliation."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenOrchestrator(`Investigate architecture health for ${project.name}`)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-sky-500/25 flex items-center gap-2 active:scale-95"
            >
              <Zap size={14} className="text-amber-300" />
              <span>Ask Orchestrator</span>
            </button>
          </div>
        </div>

        {/* 4 Plain-Language Status Cards with Visual Polish */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 relative z-10">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-sky-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                System Components
              </div>
              <Boxes size={14} className="text-sky-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1.5">
              {model.components.length} Services
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>{model.connections.length} connections declared</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Runtime Telemetry
              </div>
              <Radio size={14} className="text-emerald-400 animate-pulse" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1.5 flex items-center gap-2">
              <span>Live Stream</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>120 spans/s &bull; p95 185ms</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-rose-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Active Findings
              </div>
              <ShieldAlert size={14} className="text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1.5">
              1 Critical Drift
            </div>
            <div className="text-xs text-rose-300/80 mt-1 flex items-center gap-1">
              <span>Pricing Service undocumented</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-sky-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Review Status
              </div>
              <ShieldCheck size={14} className="text-sky-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 size={18} className="text-sky-400 inline" />
              <span>1 Ready</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>SHA-256 seal verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* What Needs Attention & Next Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Urgent Findings Card */}
        <div className="p-5 rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-400" />
              <h3 className="text-sm font-bold text-white">Findings Needing Attention</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
              1 ACTION REQUIRED
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/30 to-slate-950 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">Order Service &rarr; Pricing Service</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold uppercase">
                  Critical Drift
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Order Service is directly making synchronous queries to Pricing Service, bypassing the declared message queue.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">Discovered via runtime traces</span>
                <button
                  onClick={() => onNavigateSubView("investigate")}
                  className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                >
                  <span>Investigate in Workbench</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Workspace Navigation Card */}
        <div className="p-5 rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md space-y-4 shadow-xl">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white">Workspace Views</h3>
            <p className="text-xs text-slate-400 mt-0.5">Jump directly into any analysis perspective</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigateSubView("map")}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-sky-500/70 hover:bg-slate-900 hover:shadow-[0_0_20px_rgba(14,165,233,0.15)] hover:-translate-y-0.5 transition-all text-left space-y-1.5 group"
            >
              <Boxes size={16} className="text-sky-400 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white group-hover:text-sky-300">System Map</div>
              <p className="text-[11px] text-slate-400">Explore 3D space, components & connections</p>
            </button>

            <button
              onClick={() => onNavigateSubView("analyze")}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-amber-500/70 hover:bg-slate-900 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:-translate-y-0.5 transition-all text-left space-y-1.5 group"
            >
              <Activity size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white group-hover:text-amber-300">Analyze</div>
              <p className="text-[11px] text-slate-400">Run simulations, queueing & SLOs</p>
            </button>

            <button
              onClick={() => onNavigateSubView("investigate")}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-rose-500/70 hover:bg-slate-900 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:-translate-y-0.5 transition-all text-left space-y-1.5 group"
            >
              <ShieldAlert size={16} className="text-rose-400 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white group-hover:text-rose-300">Investigate</div>
              <p className="text-[11px] text-slate-400">Inspect runtime traces, drift & incidents</p>
            </button>

            <button
              onClick={() => onNavigateSubView("improve")}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-emerald-500/70 hover:bg-slate-900 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:-translate-y-0.5 transition-all text-left space-y-1.5 group"
            >
              <GitBranch size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white group-hover:text-emerald-300">Improve & Compare</div>
              <p className="text-[11px] text-slate-400">Model mutations, ADRs & release gates</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
