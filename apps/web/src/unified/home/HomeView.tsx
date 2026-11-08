/**
 * DataNova Campaign 08 — Destination 1: Home View
 *
 * Real-Time Architecture Intelligence & Operational Command Hub
 * Features dynamic live telemetry, continuous throughput graphs,
 * active drift alerts, and immediate multi-agent orchestration.
 */

import React, { useState } from "react";
import {
  Boxes, Sparkles, ArrowRight, Compass, ShieldAlert,
  GitBranch, ShieldCheck, Plus, Bot, Clock, Activity
} from "lucide-react";
import type { Project } from "../../atlas/state";
import { useLiveTelemetry } from "../liveTelemetry";
import { InlineMath } from "../../components/MathView";

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
  onSelectProject,
  onNavigateWorkspace,
  onNavigateEvidence,
  onOpenOrchestrator,
  onCreateNewProject,
  darkMode = true,
}) => {
  const [homePrompt, setHomePrompt] = useState("");
  const telemetry = useLiveTelemetry();

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
      darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
    }`}>
      {/* Ambient Lighting Flare */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-[680px] h-[300px] blur-[120px] rounded-full z-0 ${
          darkMode
            ? "bg-gradient-to-b from-amber-500/10 via-amber-600/5 to-transparent"
            : "bg-gradient-to-b from-amber-200/40 via-amber-100/20 to-transparent"
        }`}
      />

      {/* A. Welcome Hero Area */}
      <div className="relative z-10 text-center space-y-4 max-w-3xl mx-auto">
        <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-sm ${
          darkMode
            ? "bg-[#18181b] border-[#27272a] text-amber-400"
            : "bg-[#f4f3ef] border-[#e4e2dd] text-amber-700"
        }`}>
          <Sparkles size={13} className="text-amber-500 animate-pulse" />
          <span className="font-mono text-[11px] tracking-wider uppercase font-bold">
            Real-Time Architecture Intelligence
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
          Understand your software system.
          <br />
          <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">
            Improve it with evidence.
          </span>
        </h1>

        <p className={`text-sm sm:text-base leading-relaxed max-w-2xl mx-auto ${
          darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
        }`}>
          DataNova brings your architecture, system behavior, investigations, and supporting evidence into one clear, connected experience.
        </p>

        {/* Quick Start Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigateWorkspace("overview")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#09090b] font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 active:scale-[0.98]"
          >
            <span>Start a workspace</span>
            <ArrowRight size={15} />
          </button>

          <button
            onClick={() => onNavigateWorkspace("map")}
            className={`px-6 py-3 rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-sm ${
              darkMode
                ? "border-[#27272a] bg-[#141416] hover:bg-[#1a1a1d] text-[#f4f4f5]"
                : "border-[#dedbd5] bg-[#ffffff] hover:bg-[#f5f4f0] text-[#111113]"
            }`}
          >
            <Boxes size={15} className="text-amber-500" />
            <span>Explore an example</span>
          </button>
        </div>

        {/* Dynamic Prompt Box */}
        <form onSubmit={handlePromptSubmit} className="pt-4 max-w-2xl mx-auto">
          <div className={`relative flex items-center shadow-2xl rounded-2xl border p-1.5 focus-within:ring-2 focus-within:ring-amber-500/30 transition-all ${
            darkMode
              ? "border-[#27272a] bg-[#121214]/95 focus-within:border-amber-500"
              : "border-[#dedbd5] bg-[#ffffff]/95 focus-within:border-amber-500"
          }`}>
            <div className="pl-3.5 pr-2 text-amber-500">
              <Bot size={18} className="animate-pulse" />
            </div>
            <input
              type="text"
              value={homePrompt}
              onChange={(e) => setHomePrompt(e.target.value)}
              placeholder="What would you like to understand or improve? Ask anything or describe a problem..."
              className={`w-full bg-transparent px-2 py-2.5 text-xs sm:text-sm placeholder-zinc-500 focus:outline-none ${
                darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
              }`}
            />
            <button
              type="submit"
              disabled={!homePrompt.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-[#09090b] font-extrabold text-xs transition-all shrink-0 shadow-md shadow-amber-500/20 active:scale-95"
            >
              Ask
            </button>
          </div>
        </form>

        {/* Suggested Quick Prompts */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px]">
          <span className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${
            darkMode ? "text-[#71717a]" : "text-[#71717a]"
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
                  ? "bg-[#18181b] border-[#27272a] hover:border-amber-500 text-[#a1a1aa] hover:text-[#f4f4f5]"
                  : "bg-[#ffffff] border-[#dedbd5] hover:border-amber-500 text-[#63626b] hover:text-[#111113]"
              }`}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Continuous Differential Stability Ticker */}
        <div className="flex items-center justify-center pt-2">
          <div
            onClick={() => onNavigateWorkspace("analyze")}
            className={`inline-flex items-center gap-3 px-4 py-1.5 rounded-full border text-xs font-mono cursor-pointer transition-all hover:border-amber-500/60 shadow-md ${
              darkMode
                ? "bg-[#141416]/90 border-[#27272a] text-[#a1a1aa]"
                : "bg-[#ffffff]/90 border-[#e4e2dd] text-[#52525b]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-zinc-300">Continuous Calculus Engine:</span>
            <InlineMath math={`\\frac{dQ}{dt} = \\lambda - \\mu(Q)`} darkMode={darkMode} />
            <span className="text-zinc-600">&bull;</span>
            <InlineMath math={`\\lambda_J = -0.412 < 0`} darkMode={darkMode} />
            <span className="text-zinc-600">&bull;</span>
            <span className="text-amber-500 font-bold flex items-center gap-1 hover:underline">
              <span>Inspect RK4 Solver</span>
              <ArrowRight size={11} />
            </span>
          </div>
        </div>
      </div>

      {/* B. 4 Core Capabilities */}
      <div className="space-y-4">
        <div className={`flex items-center justify-between border-b pb-2 ${
          darkMode ? "border-[#232326]" : "border-[#e8e6e1]"
        }`}>
          <div className="flex items-center gap-2">
            <h2 className={`text-xs font-bold font-mono tracking-wider uppercase ${
              darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
            }`}>
              Core Engineering Perspectives
            </h2>
          </div>
          <span className={`text-xs font-mono ${darkMode ? "text-[#71717a]" : "text-[#71717a]"}`}>
            Integrated Studio
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Map my system */}
          <div
            onClick={() => onNavigateWorkspace("map")}
            className={`p-5 rounded-2xl border backdrop-blur-sm hover:border-amber-500/60 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm ${
              darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
            }`}
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500/20 transition-all">
                <Compass size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold transition-colors group-hover:text-amber-500">
                  Map my system
                </h3>
                <div className="text-[11px] font-mono text-amber-500/80 mt-0.5">
                  3D Studio & 10 layers
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Explore spatial connections, component geometries, and traffic flow in interactive 3D WebGL and 2D map views.
              </p>
            </div>
            <div className="text-[11px] font-bold text-amber-500 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Open 3D Studio</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 2. Understand problems */}
          <div
            onClick={() => onNavigateWorkspace("investigate")}
            className={`p-5 rounded-2xl border backdrop-blur-sm hover:border-amber-500/60 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm ${
              darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
            }`}
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-rose-500/20 transition-all">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold transition-colors group-hover:text-rose-500">
                  Understand problems
                </h3>
                <div className="text-[11px] font-mono text-rose-500/80 mt-0.5">
                  runtime telemetry diff
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Detect undocumented dependencies, latency bottlenecks, trust boundary crossings, and runtime trace anomalies.
              </p>
            </div>
            <div className="text-[11px] font-bold text-rose-500 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Start Investigation</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 3. Test improvements */}
          <div
            onClick={() => onNavigateWorkspace("improve")}
            className={`p-5 rounded-2xl border backdrop-blur-sm hover:border-amber-500/60 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm ${
              darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
            }`}
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
                <GitBranch size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold transition-colors group-hover:text-emerald-500">
                  Test improvements
                </h3>
                <div className="text-[11px] font-mono text-emerald-500/80 mt-0.5">
                  counterfactual ADRs
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Evaluate architecture decision records, mutation impacts, and pre-deployment release readiness gates.
              </p>
            </div>
            <div className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Compare Changes</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* 4. Review evidence */}
          <div
            onClick={() => onNavigateEvidence("findings")}
            className={`p-5 rounded-2xl border backdrop-blur-sm hover:border-amber-500/60 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)] hover:-translate-y-1 cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-sm ${
              darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
            }`}
          >
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-500/20 transition-all">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold transition-colors group-hover:text-purple-400">
                  Review evidence
                </h3>
                <div className="text-[11px] font-mono text-purple-400/80 mt-0.5">
                  cryptographic envelopes
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Inspect verifiable findings, literature citations, SHA-256 attested review rooms, and exchange packages.
              </p>
            </div>
            <div className="text-[11px] font-bold text-purple-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>Inspect Evidence</span>
              <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* C & D. Live Active Project & Real-Time Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Project Card with Live Metrics */}
        <div className={`md:col-span-2 p-6 rounded-2xl border backdrop-blur-md space-y-4 shadow-xl ${
          darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${
            darkMode ? "border-[#27272a]" : "border-[#e8e6e1]"
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
                darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
              }`}>
                Active Architecture Model
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Switch active project"
                value={activeProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
                className={`text-[11px] font-mono font-semibold rounded-lg border px-2 py-0.5 focus:outline-none focus:border-amber-500 transition-colors ${
                  darkMode ? "bg-[#18181b] border-[#27272a] text-[#f4f4f5]" : "bg-[#f5f4f0] border-[#dedbd5] text-[#111113]"
                }`}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (v{p.version})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold tracking-tight">{activeProject.name}</h3>
            <p className={`text-xs mt-1 leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
              {activeProject.description || "Microservices checkout and fraud-prevention architecture model."}
            </p>
          </div>

          {/* Dynamic Live Telemetry Counters */}
          <div className="grid grid-cols-3 gap-3 text-center py-2">
            <div className={`p-3.5 rounded-xl border transition-all ${
              darkMode ? "bg-[#0c0c0e] border-[#27272a]" : "bg-[#fbfaf8] border-[#e8e6e1]"
            }`}>
              <div className="text-xl font-black font-mono text-rose-500">
                {telemetry.activeDriftCount}
              </div>
              <div className={`text-[10px] uppercase font-mono font-bold mt-0.5 ${
                darkMode ? "text-[#71717a]" : "text-[#71717a]"
              }`}>
                Open Drift
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border transition-all ${
              darkMode ? "bg-[#0c0c0e] border-[#27272a]" : "bg-[#fbfaf8] border-[#e8e6e1]"
            }`}>
              <div className="text-xl font-black font-mono text-amber-500">
                {telemetry.p95Latency} ms
              </div>
              <div className={`text-[10px] uppercase font-mono font-bold mt-0.5 ${
                darkMode ? "text-[#71717a]" : "text-[#71717a]"
              }`}>
                p95 Latency
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border transition-all ${
              darkMode ? "bg-[#0c0c0e] border-[#27272a]" : "bg-[#fbfaf8] border-[#e8e6e1]"
            }`}>
              <div className="text-xl font-black font-mono text-emerald-500">
                {telemetry.rps} req/s
              </div>
              <div className={`text-[10px] uppercase font-mono font-bold mt-0.5 ${
                darkMode ? "text-[#71717a]" : "text-[#71717a]"
              }`}>
                Throughput
              </div>
            </div>
          </div>

          {/* Live Ingestion Sparkline */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            darkMode ? "bg-[#0c0c0e] border-[#27272a]" : "bg-[#fbfaf8] border-[#e8e6e1]"
          }`}>
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-emerald-500 animate-pulse" />
              <span className={`text-[11px] font-mono ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Total Processed Spans:
              </span>
              <span className="font-mono font-bold text-xs">
                {telemetry.totalSpans.toLocaleString()}
              </span>
            </div>

            {/* Micro visual sparkline bars */}
            <div className="flex items-end gap-1 h-4">
              {telemetry.sparkline.slice(-10).map((val, idx) => (
                <div
                  key={idx}
                  style={{ height: `${Math.max(20, Math.min(100, ((val - 110) / 50) * 100))}%` }}
                  className="w-1.5 rounded-sm bg-amber-500/80 transition-all duration-300"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className={`text-[11px] font-mono flex items-center gap-1 ${
              darkMode ? "text-[#71717a]" : "text-[#71717a]"
            }`}>
              <Clock size={12} />
              <span>Live stream active &bull; updated continuous</span>
            </span>

            <button
              onClick={() => onNavigateWorkspace("overview")}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#09090b] font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <span>Explore Architecture</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Continue Where I Left Off */}
        <div className={`p-6 rounded-2xl border backdrop-blur-md space-y-4 shadow-xl flex flex-col justify-between ${
          darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
        }`}>
          <div>
            <h3 className={`text-xs font-mono font-bold uppercase tracking-wider border-b pb-3 ${
              darkMode ? "border-[#27272a] text-[#a1a1aa]" : "border-[#e8e6e1] text-[#63626b]"
            }`}>
              Immediate Attention Items
            </h3>

            <div className="space-y-2 mt-4">
              <button
                onClick={() => onNavigateWorkspace("investigate")}
                className={`w-full p-2.5 rounded-xl border text-left transition-all group ${
                  darkMode
                    ? "border-[#27272a] bg-[#0c0c0e] hover:border-amber-500"
                    : "border-[#e8e6e1] bg-[#fbfaf8] hover:border-amber-500"
                }`}
              >
                <div className="text-xs font-bold group-hover:text-amber-500 transition-colors">
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
                    ? "border-[#27272a] bg-[#0c0c0e] hover:border-amber-500"
                    : "border-[#e8e6e1] bg-[#fbfaf8] hover:border-amber-500"
                }`}
              >
                <div className="text-xs font-bold group-hover:text-amber-500 transition-colors">
                  Run Capacity Burst Simulation
                </div>
                <div className="text-[10px] text-amber-500 font-mono mt-0.5">
                  &bull; Checkout queueing at 1,500 RPS
                </div>
              </button>

              <button
                onClick={() => onNavigateEvidence("reviews")}
                className={`w-full p-2.5 rounded-xl border text-left transition-all group ${
                  darkMode
                    ? "border-[#27272a] bg-[#0c0c0e] hover:border-amber-500"
                    : "border-[#e8e6e1] bg-[#fbfaf8] hover:border-amber-500"
                }`}
              >
                <div className="text-xs font-bold group-hover:text-amber-500 transition-colors">
                  Verify Peer Architecture Review
                </div>
                <div className="text-[10px] text-emerald-500 font-mono mt-0.5">
                  &bull; 1 package ready for cryptographic verification
                </div>
              </button>
            </div>
          </div>

          <div className={`pt-2 border-t ${darkMode ? "border-[#27272a]" : "border-[#e8e6e1]"}`}>
            <button
              onClick={() => onCreateNewProject()}
              className={`w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                darkMode
                  ? "border-[#38383e] hover:border-amber-500 hover:text-amber-400 text-[#a1a1aa]"
                  : "border-[#dedbd5] hover:border-amber-500 hover:text-amber-700 text-[#63626b]"
              }`}
            >
              <Plus size={13} />
              <span>Create New Architecture</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
