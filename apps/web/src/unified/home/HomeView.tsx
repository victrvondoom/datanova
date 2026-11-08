/**
 * DataNova Campaign 08 — Destination 1: Home View
 *
 * Understand your software system. Improve it with confidence.
 * Starting point: Understand product, select project, see what needs attention, start a workflow.
 * Styled in luxury creamy white and creamy black aesthetic with cursive flourishes.
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
  darkMode?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  projects,
  activeProjectId,
  onSelectProject: _onSelectProject,
  onNavigateWorkspace,
  onNavigateEvidence,
  onOpenOrchestrator,
  onCreateNewProject,
  darkMode = false,
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
    <div className={`relative max-w-6xl mx-auto space-y-10 py-8 px-4 transition-colors ${
      darkMode ? "text-[#f5f2eb]" : "text-[#181716]"
    }`}>
      {/* Ambient Warm Champagne / Editorial Glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[720px] h-[340px] blur-[110px] rounded-full z-0 ${
          darkMode
            ? "bg-gradient-to-b from-[#c59b27]/15 via-[#a37d1d]/10 to-transparent"
            : "bg-gradient-to-b from-[#e5cf96]/35 via-[#f0e4c8]/25 to-transparent"
        }`}
      />

      {/* A. Welcome Area */}
      <div className="relative z-10 text-center space-y-4 max-w-3xl mx-auto">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold shadow-sm ${
          darkMode
            ? "bg-[#25221e] border-[#3d3830] text-[#dfba49]"
            : "bg-[#f4ede1] border-[#dfd4be] text-[#8f6d14]"
        }`}>
          <Sparkles size={13} className="text-[#c59b27] animate-pulse" />
          <span>Architecture <span className="font-cursive text-sm font-bold">Intelligence</span> Studio</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Understand your software system.
          <br />
          <span className="font-cursive text-5xl sm:text-6xl text-[#b8860b] dark:text-[#e0c080] font-normal tracking-wide drop-shadow-sm">
            Improve it with confidence.
          </span>
        </h1>

        <p className={`text-sm sm:text-base leading-relaxed max-w-2xl mx-auto ${
          darkMode ? "text-[#c2bcb2]" : "text-[#575249]"
        }`}>
          DataNova brings your architecture, system behavior, investigations, and supporting evidence together in one workspace. Describe what you want to understand or improve, and DataNova coordinates the right tools and specialist agents.
        </p>

        {/* Quick Start Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigateWorkspace("overview")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#181716] via-[#24221e] to-[#181716] hover:from-[#2e2a24] hover:to-[#3d372e] dark:from-[#f5f2eb] dark:via-[#fcfbf9] dark:to-[#eae2d3] dark:hover:from-[#fdfcf9] dark:hover:to-[#f0e9db] text-[#faf7f2] dark:text-[#181716] font-bold text-xs sm:text-sm transition-all shadow-lg shadow-black/15 flex items-center gap-2 active:scale-[0.98]"
          >
            <span>Start a workspace</span>
            <ArrowRight size={15} />
          </button>

          <button
            onClick={() => onNavigateWorkspace("map")}
            className={`px-6 py-3 rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-sm ${
              darkMode
                ? "border-[#2f2c26] bg-[#1e1c19] hover:bg-[#282521] text-[#f5f2eb]"
                : "border-[#dfd3bf] bg-[#fdfcf9] hover:bg-[#f7f2e7] text-[#181716]"
            }`}
          >
            <Boxes size={15} className="text-[#c59b27]" />
            <span>Explore an example</span>
          </button>
        </div>

        {/* Inline Orchestrator Prompt Box */}
        <form onSubmit={handlePromptSubmit} className="pt-4 max-w-2xl mx-auto">
          <div className={`relative flex items-center shadow-xl rounded-2xl border p-1.5 focus-within:ring-2 focus-within:ring-[#c59b27]/30 transition-all ${
            darkMode
              ? "border-[#38332a] bg-[#1c1a17]/95 focus-within:border-[#c59b27]"
              : "border-[#ded3bd] bg-[#fdfcf9]/95 focus-within:border-[#c59b27]"
          }`}>
            <div className="pl-3.5 pr-2 text-[#c59b27]">
              <Bot size={18} className="animate-pulse" />
            </div>
            <input
              type="text"
              value={homePrompt}
              onChange={(e) => setHomePrompt(e.target.value)}
              placeholder="What would you like to understand or improve today? Type any question or problem..."
              className={`w-full bg-transparent px-2 py-2.5 text-xs sm:text-sm placeholder-stone-400 focus:outline-none ${
                darkMode ? "text-[#f5f2eb]" : "text-[#181716]"
              }`}
            />
            <button
              type="submit"
              disabled={!homePrompt.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c59b27] to-[#a37d1d] hover:from-[#dfba49] hover:to-[#b8860b] disabled:opacity-40 text-[#181716] font-bold text-xs transition-all shrink-0 shadow-md shadow-[#c59b27]/25 active:scale-95"
            >
              Ask
            </button>
          </div>
        </form>

        {/* Suggested Quick Prompts */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px]">
          <span className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${
            darkMode ? "text-[#857d72]" : "text-[#857d72]"
          }`}>
            Suggested:
          </span>
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
              className={`px-3 py-1.5 rounded-lg border transition-all duration-150 flex items-center gap-1.5 shadow-sm active:scale-95 ${
                darkMode
                  ? "bg-[#1c1a17] border-[#2e2a24] hover:border-[#c59b27] text-[#c2bcb2] hover:text-[#f5f2eb]"
                  : "bg-[#fdfcf9] border-[#e2d8c4] hover:border-[#c59b27] text-[#575249] hover:text-[#181716]"
              }`}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* B. What can I do with DataNova? (4 Core Capabilities) */}
      <div className="space-y-4">
        <div className={`flex items-center justify-between border-b pb-2 ${
          darkMode ? "border-[#2e2a24]" : "border-[#e5dec9]"
        }`}>
          <div className="flex items-center gap-2">
            <h2 className={`text-xs font-bold font-mono tracking-wider uppercase ${
              darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
            }`}>
              What can I do with DataNova?
            </h2>
            <span className="font-cursive text-base text-[#b8860b] dark:text-[#dfba49]">(Core Capabilities)</span>
          </div>
          <span className={`text-xs ${darkMode ? "text-[#857d72]" : "text-[#857d72]"}`}>Integrated engineering studio</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Map my system */}
          <div
            onClick={() => onNavigateWorkspace("map")}
            className={`p-5 rounded-2xl border backdrop-blur-sm hover:border-[#c59b27] hover:shadow-[0_8px_30px_rgba(197,155,39,0.15)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm ${
              darkMode ? "bg-[#1c1a17]/90 border-[#2e2a24]" : "bg-[#fdfcf9] border-[#e5dec9]"
            }`}
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#c59b27]/15 border border-[#c59b27]/30 text-[#c59b27] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#c59b27]/25 transition-all">
                <Compass size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold transition-colors group-hover:text-[#c59b27]">
                  Map my system
                </h3>
                <div className="font-cursive text-sm text-[#a37d1d] dark:text-[#dfba49] mt-0.5">spatial connections & layers</div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
                See how the parts of my software connect in interactive 2D and 3D space with layered analytical views.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-[#b8860b] dark:text-[#dfba49] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Open System Map</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 2. Understand problems */}
          <div
            onClick={() => onNavigateWorkspace("investigate")}
            className={`p-5 rounded-2xl border backdrop-blur-sm hover:border-[#c59b27] hover:shadow-[0_8px_30px_rgba(197,155,39,0.15)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm ${
              darkMode ? "bg-[#1c1a17]/90 border-[#2e2a24]" : "bg-[#fdfcf9] border-[#e5dec9]"
            }`}
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500/25 transition-all">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold transition-colors group-hover:text-amber-500">
                  Understand problems
                </h3>
                <div className="font-cursive text-sm text-amber-600 dark:text-amber-400 mt-0.5">drift triage & runtime traces</div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
                Find undocumented dependencies, latency bottlenecks, runtime failures, and trust boundary risks.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Start Investigation</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 3. Test improvements */}
          <div
            onClick={() => onNavigateWorkspace("improve")}
            className={`p-5 rounded-2xl border backdrop-blur-sm hover:border-[#c59b27] hover:shadow-[0_8px_30px_rgba(197,155,39,0.15)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm ${
              darkMode ? "bg-[#1c1a17]/90 border-[#2e2a24]" : "bg-[#fdfcf9] border-[#e5dec9]"
            }`}
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-600/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600/25 transition-all">
                <GitBranch size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  Test improvements
                </h3>
                <div className="font-cursive text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">ADRs & counterfactual mutations</div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
                Explore architectural changes, test release readiness, and simulate alternative design outcomes.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Compare Alternatives</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 4. Review evidence */}
          <div
            onClick={() => onNavigateEvidence("findings")}
            className={`p-5 rounded-2xl border backdrop-blur-sm hover:border-[#c59b27] hover:shadow-[0_8px_30px_rgba(197,155,39,0.15)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm ${
              darkMode ? "bg-[#1c1a17]/90 border-[#2e2a24]" : "bg-[#fdfcf9] border-[#e5dec9]"
            }`}
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-600/30 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-600/25 transition-all">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold transition-colors group-hover:text-purple-600 dark:group-hover:text-purple-400">
                  Review evidence
                </h3>
                <div className="font-cursive text-xs text-purple-600 dark:text-purple-400 mt-0.5">cryptographic packages & proof</div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? "text-[#a69f93]" : "text-[#6e675f]"}`}>
                Understand why a conclusion was reached, inspect supporting telemetry, and share findings with peers.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Inspect Evidence</span>
              <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* C & D. Active Workspace & Recent Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Project Card */}
        <div className={`md:col-span-2 p-6 rounded-2xl border backdrop-blur-md space-y-4 shadow-xl ${
          darkMode ? "bg-[#1c1a17]/90 border-[#2e2a24]" : "bg-[#fdfcf9] border-[#e5dec9]"
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${
            darkMode ? "border-[#2e2a24]" : "border-[#e5dec9]"
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
              }`}>
                Active Architecture Project
              </span>
            </div>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold border ${
              darkMode ? "bg-[#25221e] border-[#38332a] text-[#dfba49]" : "bg-[#f4eee2] border-[#ded3be] text-[#8f6d14]"
            }`}>
              v{activeProject.version}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl font-bold">{activeProject.name}</h3>
              <span className="font-cursive text-base text-[#b8860b] dark:text-[#dfba49]">production reference</span>
            </div>
            <p className={`text-xs mt-1 leading-relaxed ${darkMode ? "text-[#c2bcb2]" : "text-[#575249]"}`}>
              {activeProject.description}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center py-2">
            <div className={`p-3.5 rounded-xl border ${
              darkMode ? "bg-[#161513] border-[#2e2a24]" : "bg-[#faf7f2] border-[#e5dec9]"
            }`}>
              <div className="text-lg font-bold font-mono text-rose-500">1</div>
              <div className={`text-[10px] uppercase font-mono font-bold mt-0.5 ${
                darkMode ? "text-[#857d72]" : "text-[#857d72]"
              }`}>
                Open Drift
              </div>
            </div>
            <div className={`p-3.5 rounded-xl border ${
              darkMode ? "bg-[#161513] border-[#2e2a24]" : "bg-[#faf7f2] border-[#e5dec9]"
            }`}>
              <div className="text-lg font-bold text-amber-500 font-mono">185 ms</div>
              <div className={`text-[10px] uppercase font-mono font-bold mt-0.5 ${
                darkMode ? "text-[#857d72]" : "text-[#857d72]"
              }`}>
                p95 Latency
              </div>
            </div>
            <div className={`p-3.5 rounded-xl border ${
              darkMode ? "bg-[#161513] border-[#2e2a24]" : "bg-[#faf7f2] border-[#e5dec9]"
            }`}>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">Ready</div>
              <div className={`text-[10px] uppercase font-mono font-bold mt-0.5 ${
                darkMode ? "text-[#857d72]" : "text-[#857d72]"
              }`}>
                Review State
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className={`text-[11px] font-mono flex items-center gap-1 ${
              darkMode ? "text-[#857d72]" : "text-[#857d72]"
            }`}>
              <Clock size={12} />
              <span>Updated {activeProject.updatedAt ? activeProject.updatedAt.slice(0, 10) : "today"}</span>
            </span>

            <button
              onClick={() => onNavigateWorkspace("overview")}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c59b27] to-[#a37d1d] hover:from-[#dfba49] hover:to-[#b8860b] text-[#181716] font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <span>Open in Workspace</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Continue Where I Left Off */}
        <div className={`p-6 rounded-2xl border backdrop-blur-md space-y-4 shadow-xl flex flex-col justify-between ${
          darkMode ? "bg-[#1c1a17]/90 border-[#2e2a24]" : "bg-[#fdfcf9] border-[#e5dec9]"
        }`}>
          <div>
            <h3 className={`text-xs font-mono font-bold uppercase tracking-wider border-b pb-3 ${
              darkMode ? "border-[#2e2a24] text-[#a69f93]" : "border-[#e5dec9] text-[#6e675f]"
            }`}>
              Continue where I left off
            </h3>

            <div className="space-y-2 mt-4">
              <button
                onClick={() => onNavigateWorkspace("investigate")}
                className={`w-full p-2.5 rounded-xl border text-left transition-all group ${
                  darkMode
                    ? "border-[#2e2a24] bg-[#161513] hover:border-[#c59b27]"
                    : "border-[#e5dec9] bg-[#faf7f2] hover:border-[#c59b27]"
                }`}
              >
                <div className="text-xs font-semibold group-hover:text-[#c59b27] transition-colors">
                  Investigate Pricing Service Drift
                </div>
                <div className="text-[10px] text-rose-500 font-mono mt-0.5">
                  &bull; Undocumented direct synchronous call
                </div>
              </button>

              <button
                onClick={() => onNavigateWorkspace("analyze")}
                className={`w-full p-2.5 rounded-xl border text-left transition-all group ${
                  darkMode
                    ? "border-[#2e2a24] bg-[#161513] hover:border-[#c59b27]"
                    : "border-[#e5dec9] bg-[#faf7f2] hover:border-[#c59b27]"
                }`}
              >
                <div className="text-xs font-semibold group-hover:text-[#c59b27] transition-colors">
                  Continue Capacity Simulation
                </div>
                <div className="text-[10px] text-amber-500 font-mono mt-0.5">
                  &bull; Checkout queueing at 1,500 RPS
                </div>
              </button>

              <button
                onClick={() => onNavigateEvidence("reviews")}
                className={`w-full p-2.5 rounded-xl border text-left transition-all group ${
                  darkMode
                    ? "border-[#2e2a24] bg-[#161513] hover:border-[#c59b27]"
                    : "border-[#e5dec9] bg-[#faf7f2] hover:border-[#c59b27]"
                }`}
              >
                <div className="text-xs font-semibold group-hover:text-[#c59b27] transition-colors">
                  Inspect Peer Architecture Review
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  &bull; 1 package ready for verification
                </div>
              </button>
            </div>
          </div>

          <div className={`pt-2 border-t ${darkMode ? "border-[#2e2a24]" : "border-[#e5dec9]"}`}>
            <button
              onClick={() => onCreateNewProject()}
              className={`w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                darkMode
                  ? "border-[#38332a] hover:border-[#c59b27] hover:text-[#dfba49] text-[#a69f93]"
                  : "border-[#ded3bd] hover:border-[#c59b27] hover:text-[#8f6d14] text-[#6e675f]"
              }`}
            >
              <Plus size={13} />
              <span>Create New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* E. Editorial Integrity Callout */}
      <div className={`p-6 rounded-2xl border text-center space-y-2 ${
        darkMode
          ? "bg-gradient-to-r from-[#1a1815] via-[#221f1a] to-[#1a1815] border-[#332f28]"
          : "bg-gradient-to-r from-[#f7f2e8] via-[#fdfcf9] to-[#f7f2e8] border-[#e2d8c4]"
      }`}>
        <div className="font-cursive text-2xl sm:text-3xl text-[#b8860b] dark:text-[#dfba49]">
          "Designed with clarity, verified with evidence."
        </div>
        <p className={`text-xs max-w-xl mx-auto leading-relaxed ${
          darkMode ? "text-[#a69f93]" : "text-[#6e675f]"
        }`}>
          Zero false certainty. Every finding originates from runtime distributed traces, formal architecture models, or cryptographic evidence envelopes.
        </p>
      </div>
    </div>
  );
};
