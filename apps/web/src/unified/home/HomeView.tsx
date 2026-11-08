/**
 * DataNova Campaign 08 — Destination 1: Home View
 *
 * Understand your software system. Improve it with confidence.
 * Starting point: Understand product, select project, see what needs attention, start a workflow.
 */

import React, { useState } from "react";
import {
  Boxes, Sparkles, ArrowRight, Compass, ShieldAlert,
  GitBranch, ShieldCheck, Plus, Bot, Clock
} from "lucide-react";
import type { Project } from "../../atlas/state";

interface HomeViewProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onNavigateWorkspace: (subview?: string) => void;
  onNavigateEvidence: (subview?: string) => void;
  onOpenOrchestrator: (initialPrompt?: string) => void;
  onCreateNewProject: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  projects,
  activeProjectId,
  onSelectProject: _onSelectProject,
  onNavigateWorkspace,
  onNavigateEvidence,
  onOpenOrchestrator,
  onCreateNewProject,
}) => {
  const [homePrompt, setHomePrompt] = useState("");

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (homePrompt.trim()) {
      onOpenOrchestrator(homePrompt.trim());
      setHomePrompt("");
    }
  };

  return (
    <div className="relative max-w-6xl mx-auto space-y-10 py-6 px-4">
      {/* Ambient Cybernetic Lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[700px] h-[320px] bg-gradient-to-b from-sky-500/12 via-indigo-500/8 to-transparent blur-[100px] rounded-full z-0"
      />

      {/* A. Welcome Area */}
      <div className="relative z-10 text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold shadow-sm">
          <Sparkles size={13} className="animate-pulse" />
          <span>Architecture Intelligence Studio</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          Understand your software system.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400">
            Improve it with confidence.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
          DataNova brings your architecture, system behavior, investigations, and supporting evidence together in one workspace. Describe what you want to understand or improve, and DataNova coordinates the right tools and specialist agents.
        </p>

        {/* Quick Start Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigateWorkspace("overview")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-sky-500/25 flex items-center gap-2 active:scale-[0.98]"
          >
            <span>Start a workspace</span>
            <ArrowRight size={15} />
          </button>

          <button
            onClick={() => onNavigateWorkspace("map")}
            className="px-6 py-3 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-600 text-slate-200 font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-sm"
          >
            <Boxes size={15} className="text-sky-400" />
            <span>Explore an example</span>
          </button>
        </div>

        {/* Inline Orchestrator Prompt Box */}
        <form onSubmit={handlePromptSubmit} className="pt-4 max-w-2xl mx-auto">
          <div className="relative flex items-center shadow-xl rounded-2xl border border-sky-500/40 bg-slate-900/95 p-1.5 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500/30 transition-all">
            <div className="pl-3.5 pr-2 text-sky-400">
              <Bot size={18} className="animate-pulse" />
            </div>
            <input
              type="text"
              value={homePrompt}
              onChange={(e) => setHomePrompt(e.target.value)}
              placeholder="What would you like to understand or improve today? Type any question or problem..."
              className="w-full bg-transparent px-2 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!homePrompt.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-all shrink-0 shadow-sm shadow-sky-500/20"
            >
              Ask
            </button>
          </div>
        </form>

        {/* Suggested Quick Prompts */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px]">
          <span className="text-slate-500 font-mono text-[10px] uppercase tracking-wider font-semibold">Suggested:</span>
          {[
            { label: "Investigate Pricing Service Drift", icon: "🔍" },
            { label: "Simulate 1,500 RPS Capacity Peak", icon: "⚡" },
            { label: "Check Trust Boundary Security", icon: "🔒" },
            { label: "Verify Evidence Package Integrity", icon: "📑" },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onOpenOrchestrator(chip.label)}
              className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800/90 hover:border-sky-500/50 text-slate-300 hover:text-white transition-all duration-150 flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* B. What can I do with DataNova? (4 Core Capabilities) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <h2 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-400">
            What can I do with DataNova?
          </h2>
          <span className="text-xs text-slate-500">Core engineering capabilities</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Map my system */}
          <div
            onClick={() => onNavigateWorkspace("map")}
            className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm hover:border-sky-500/70 hover:bg-slate-900/90 hover:shadow-[0_4px_30px_rgba(14,165,233,0.18)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm"
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-sky-500/20 transition-all">
                <Compass size={20} />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                Map my system
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                See how the parts of my software connect in interactive 2D and 3D space with layered analytical views.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-sky-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Open System Map</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 2. Understand problems */}
          <div
            onClick={() => onNavigateWorkspace("investigate")}
            className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm hover:border-amber-500/70 hover:bg-slate-900/90 hover:shadow-[0_4px_30px_rgba(245,158,11,0.18)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm"
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500/20 transition-all">
                <ShieldAlert size={20} />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                Understand problems
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Find undocumented dependencies, latency bottlenecks, runtime failures, and trust boundary risks.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Start Investigation</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 3. Test improvements */}
          <div
            onClick={() => onNavigateWorkspace("improve")}
            className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm hover:border-emerald-500/70 hover:bg-slate-900/90 hover:shadow-[0_4px_30px_rgba(16,185,129,0.18)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm"
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
                <GitBranch size={20} />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                Test improvements
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Explore architectural changes, test release readiness, and simulate alternative design outcomes.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Compare Alternatives</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 4. Review evidence */}
          <div
            onClick={() => onNavigateEvidence("findings")}
            className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm hover:border-purple-500/70 hover:bg-slate-900/90 hover:shadow-[0_4px_30px_rgba(168,85,247,0.18)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm"
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-500/20 transition-all">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                Review evidence
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Understand why a conclusion was reached, inspect supporting telemetry, and share findings with peers.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-purple-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Inspect Evidence</span>
              <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* C & D. Active Workspace & Recent Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Project Card */}
        <div className="md:col-span-2 p-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Active Architecture Project
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
              v{activeProject.version}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">{activeProject.name}</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{activeProject.description}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center py-2">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-lg font-bold text-white font-mono">1</div>
              <div className="text-[10px] text-slate-500 uppercase font-mono font-bold mt-0.5">Open Drift</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-lg font-bold text-amber-400 font-mono">185 ms</div>
              <div className="text-[10px] text-slate-500 uppercase font-mono font-bold mt-0.5">p95 Latency</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-lg font-bold text-emerald-400 font-mono">Ready</div>
              <div className="text-[10px] text-slate-500 uppercase font-mono font-bold mt-0.5">Review State</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
              <Clock size={12} />
              <span>Updated {activeProject.updatedAt ? activeProject.updatedAt.slice(0, 10) : "today"}</span>
            </span>

            <button
              onClick={() => onNavigateWorkspace("overview")}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>Open in Workspace</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Continue Where I Left Off */}
        <div className="p-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 pb-3">
              Continue where I left off
            </h3>

            <div className="space-y-2 mt-4">
              <button
                onClick={() => onNavigateWorkspace("investigate")}
                className="w-full p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950 text-left transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  Investigate Pricing Service Drift
                </div>
                <div className="text-[10px] text-rose-300 font-mono mt-0.5">
                  &bull; Undocumented direct synchronous call
                </div>
              </button>

              <button
                onClick={() => onNavigateWorkspace("analyze")}
                className="w-full p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950 text-left transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  Continue Capacity Simulation
                </div>
                <div className="text-[10px] text-amber-300 font-mono mt-0.5">
                  &bull; Checkout queueing at 1,500 RPS
                </div>
              </button>

              <button
                onClick={() => onNavigateEvidence("reviews")}
                className="w-full p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950 text-left transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  Inspect Peer Architecture Review
                </div>
                <div className="text-[10px] text-emerald-300 font-mono mt-0.5">
                  &bull; 1 package ready for verification
                </div>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => onCreateNewProject()}
              className="w-full py-2 rounded-xl border border-dashed border-slate-700 hover:border-sky-500 hover:text-sky-300 text-slate-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={13} />
              <span>Create New Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
