/**
 * DataNova Campaign 08 — Workspace: 5.1 Overview View
 *
 * Plain-language summary of what the system contains, what DataNova understands,
 * what has been analyzed, what findings need attention, and recommended actions.
 * Styled in creamy white & creamy black aesthetic with cursive accents.
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
  darkMode?: boolean;
}

export const WorkspaceOverview: React.FC<WorkspaceOverviewProps> = ({
  project,
  model,
  onNavigateSubView,
  onOpenOrchestrator,
  darkMode = false,
}) => {
  return (
    <div className={`max-w-6xl mx-auto space-y-6 transition-colors ${
      darkMode ? "text-[#f5f2eb]" : "text-[#181716]"
    }`}>
      {/* Overview Top Welcome Card */}
      <div className={`p-6 rounded-2xl border space-y-5 shadow-2xl relative overflow-hidden transition-all ${
        darkMode
          ? "border-[#2e2a24] bg-gradient-to-r from-[#1c1a17] via-[#221f1c] to-[#161513]"
          : "border-[#e5dec9] bg-gradient-to-r from-[#fdfcf9] via-[#fcfaf7] to-[#f6f0e4] shadow-stone-200/50"
      }`}>
        {/* Subtle warm champagne background glow */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl ${
            darkMode ? "bg-[#c59b27]/10" : "bg-[#dfba49]/20"
          }`}
        />

        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 relative z-10 ${
          darkMode ? "border-[#2e2a24]" : "border-[#e5dec9]"
        }`}>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <h2 className="text-xl font-bold tracking-tight">{project.name}</h2>
              <span className="font-cursive text-base text-[#b8860b] dark:text-[#dfba49] font-semibold">reconciled studio</span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                darkMode ? "bg-[#25221e] border-[#38332a] text-[#dfba49]" : "bg-[#f4eee2] border-[#ded3be] text-[#8f6d14]"
              }`}>
                v{project.version}
              </span>
            </div>
            <p className={`text-xs mt-1 max-w-2xl leading-relaxed ${
              darkMode ? "text-[#c2bcb2]" : "text-[#575249]"
            }`}>
              {project.description || "Production-grade microservices architecture model with active telemetry reconciliation."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenOrchestrator(`Investigate architecture health for ${project.name}`)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#c59b27] to-[#a37d1d] hover:from-[#dfba49] hover:to-[#b8860b] text-[#181716] font-bold text-xs transition-all shadow-md shadow-[#c59b27]/20 flex items-center gap-2 active:scale-95"
            >
              <Zap size={14} className="text-[#181716]" />
              <span>Ask Orchestrator</span>
            </button>
          </div>
        </div>

        {/* 4 Plain-Language Status Cards with Visual Polish */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 relative z-10">
          <div className={`p-4 rounded-xl border transition-all group ${
            darkMode
              ? "bg-[#181614] border-[#2e2a24] hover:border-[#c59b27]"
              : "bg-[#fdfcf9] border-[#e5dec9] hover:border-[#c59b27] shadow-sm"
          }`}>
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
              }`}>
                System Components
              </div>
              <Boxes size={14} className="text-[#c59b27] group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono mt-1.5">
              {model.components.length} Services
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
            }`}>
              <span>{model.connections.length} connections declared</span>
            </div>
          </div>

          <div className={`p-4 rounded-xl border transition-all group ${
            darkMode
              ? "bg-[#181614] border-[#2e2a24] hover:border-emerald-600"
              : "bg-[#fdfcf9] border-[#e5dec9] hover:border-emerald-600 shadow-sm"
          }`}>
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
              }`}>
                Runtime Telemetry
              </div>
              <Radio size={14} className="text-emerald-500 animate-pulse" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-2">
              <span>Live Stream</span>
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
            }`}>
              <span>120 spans/s &bull; p95 185ms</span>
            </div>
          </div>

          <div className={`p-4 rounded-xl border transition-all group ${
            darkMode
              ? "bg-[#181614] border-[#2e2a24] hover:border-rose-500"
              : "bg-[#fdfcf9] border-[#e5dec9] hover:border-rose-500 shadow-sm"
          }`}>
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
              }`}>
                Active Findings
              </div>
              <ShieldAlert size={14} className="text-rose-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-500 mt-1.5">
              1 Critical Drift
            </div>
            <div className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 flex items-center gap-1 font-medium">
              <span>Pricing Service undocumented</span>
            </div>
          </div>

          <div className={`p-4 rounded-xl border transition-all group ${
            darkMode
              ? "bg-[#181614] border-[#2e2a24] hover:border-[#c59b27]"
              : "bg-[#fdfcf9] border-[#e5dec9] hover:border-[#c59b27] shadow-sm"
          }`}>
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
              }`}>
                Review Status
              </div>
              <ShieldCheck size={14} className="text-[#c59b27] group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#b8860b] dark:text-[#dfba49] mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 size={18} className="text-[#c59b27] inline" />
              <span>1 Ready</span>
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
            }`}>
              <span>SHA-256 seal verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* What Needs Attention & Next Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Urgent Findings Card */}
        <div className={`p-5 rounded-2xl border backdrop-blur-md space-y-4 shadow-xl ${
          darkMode ? "bg-[#1c1a17]/90 border-[#2e2a24]" : "bg-[#fdfcf9] border-[#e5dec9]"
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${
            darkMode ? "border-[#2e2a24]" : "border-[#e5dec9]"
          }`}>
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-500" />
              <h3 className="text-sm font-bold">Findings Needing Attention</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
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
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 font-bold uppercase">
                  Critical Drift
                </span>
              </div>
              <p className={`leading-relaxed ${darkMode ? "text-[#c2bcb2]" : "text-[#575249]"}`}>
                Order Service is directly making synchronous queries to Pricing Service, bypassing the declared message queue.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className={`text-[10px] font-mono ${darkMode ? "text-[#857d72]" : "text-[#857d72]"}`}>
                  Discovered via runtime traces
                </span>
                <button
                  onClick={() => onNavigateSubView("investigate")}
                  className="text-xs font-bold text-[#b8860b] dark:text-[#dfba49] hover:underline inline-flex items-center gap-1"
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
          darkMode ? "bg-[#1c1a17]/90 border-[#2e2a24]" : "bg-[#fdfcf9] border-[#e5dec9]"
        }`}>
          <div className={`border-b pb-3 ${darkMode ? "border-[#2e2a24]" : "border-[#e5dec9]"}`}>
            <h3 className="text-sm font-bold">Workspace Perspectives</h3>
            <p className={`text-xs mt-0.5 ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
              Jump directly into any architecture intelligence view
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigateSubView("map")}
              className={`p-3.5 rounded-xl border text-left space-y-1.5 transition-all group ${
                darkMode
                  ? "border-[#2e2a24] bg-[#161513] hover:border-[#c59b27] hover:shadow-[0_0_20px_rgba(197,155,39,0.15)]"
                  : "border-[#e5dec9] bg-[#faf7f2] hover:border-[#c59b27] hover:shadow-[0_0_20px_rgba(197,155,39,0.15)]"
              }`}
            >
              <Boxes size={16} className="text-[#c59b27] group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold group-hover:text-[#c59b27] transition-colors">System Map</div>
              <p className={`text-[11px] ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
                Explore 3D space, components & connections
              </p>
            </button>

            <button
              onClick={() => onNavigateSubView("analyze")}
              className={`p-3.5 rounded-xl border text-left space-y-1.5 transition-all group ${
                darkMode
                  ? "border-[#2e2a24] bg-[#161513] hover:border-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                  : "border-[#e5dec9] bg-[#faf7f2] hover:border-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
              }`}
            >
              <Activity size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold group-hover:text-amber-500 transition-colors">Analyze</div>
              <p className={`text-[11px] ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
                Run simulations, queueing & SLOs
              </p>
            </button>

            <button
              onClick={() => onNavigateSubView("investigate")}
              className={`p-3.5 rounded-xl border text-left space-y-1.5 transition-all group ${
                darkMode
                  ? "border-[#2e2a24] bg-[#161513] hover:border-rose-500 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                  : "border-[#e5dec9] bg-[#faf7f2] hover:border-rose-500 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]"
              }`}
            >
              <ShieldAlert size={16} className="text-rose-500 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold group-hover:text-rose-500 transition-colors">Investigate</div>
              <p className={`text-[11px] ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
                Inspect runtime traces, drift & incidents
              </p>
            </button>

            <button
              onClick={() => onNavigateSubView("improve")}
              className={`p-3.5 rounded-xl border text-left space-y-1.5 transition-all group ${
                darkMode
                  ? "border-[#2e2a24] bg-[#161513] hover:border-emerald-600 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  : "border-[#e5dec9] bg-[#faf7f2] hover:border-emerald-600 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              }`}
            >
              <GitBranch size={16} className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Improve & Compare
              </div>
              <p className={`text-[11px] ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
                Model mutations, ADRs & release gates
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
