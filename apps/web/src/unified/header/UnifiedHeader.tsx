/**
 * DataNova Campaign 08 — Unified Top Navigation Header
 *
 * Exactly 3 primary destinations + Live Telemetry stream ticker + Global Orchestrator trigger.
 * Featuring the executive DataNova Atlas geometric spatial logo.
 */

import React, { useState } from "react";
import {
  Search, Sun, Moon,
  Home, Layers, ShieldCheck, ChevronDown, Bot, GraduationCap, FlaskConical, LayoutDashboard
} from "lucide-react";
import type { PrimaryDestination } from "../types";
import type { Project } from "../../atlas/state";
import { DataNovaLogo } from "../../components/DataNovaLogo";
import { useLiveTelemetry } from "../liveTelemetry";

interface UnifiedHeaderProps {
  currentDestination: PrimaryDestination;
  onNavigateDestination: (dest: PrimaryDestination) => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onOpenOrchestrator: (initialPrompt?: string) => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onOpenLegacyView?: (view: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  currentDestination,
  onNavigateDestination,
  projects,
  activeProjectId,
  onSelectProject,
  onOpenOrchestrator,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenLegacyView,
  darkMode,
  setDarkMode,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const telemetry = useLiveTelemetry();

  return (
    <header className={`sticky top-0 z-40 h-14 border-b px-4 lg:px-6 flex items-center justify-between transition-colors backdrop-blur-md ${
      darkMode
        ? "border-[#232326] bg-[#0c0c0e]/95 text-[#f4f4f5]"
        : "border-[#e8e6e1] bg-[#fbfaf8]/95 text-[#111113]"
    }`}>
      {/* Brand & Architecture Selector */}
      <div className="flex items-center gap-4">
        <DataNovaLogo
          onClick={() => onNavigateDestination("home")}
          darkMode={darkMode}
          size="md"
        />

        <div className={`h-5 w-px hidden sm:block ${darkMode ? "bg-[#27272a]" : "bg-[#dedbd5]"}`} />

        {/* Project Selector */}
        <div className="hidden sm:flex items-center gap-2">
          <label htmlFor="header-project-select" className="sr-only">Active Project</label>
          <select
            id="header-project-select"
            value={activeProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className={`text-xs font-semibold rounded-lg border px-2.5 py-1 focus:outline-none focus:border-amber-500 transition-colors max-w-44 truncate ${
              darkMode
                ? "border-[#27272a] bg-[#18181b] text-[#f4f4f5]"
                : "border-[#dedbd5] bg-[#ffffff] text-[#111113]"
            }`}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (v{p.version})
              </option>
            ))}
          </select>
        </div>

        {/* Live Telemetry Ticker */}
        <div className={`hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-mono ${
          darkMode ? "border-[#27272a] bg-[#141416]/90 text-[#a1a1aa]" : "border-[#e4e2dd] bg-[#f5f4f0]/90 text-[#63626b]"
        }`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className={`font-semibold ${darkMode ? "text-[#f4f4f5]" : "text-[#111113]"}`}>
            {telemetry.rps} req/s
          </span>
          <span className="opacity-40">&bull;</span>
          <span>p95 {telemetry.p95Latency}ms</span>
          <span className="opacity-40">&bull;</span>
          <span className="text-amber-500 font-bold">{telemetry.activeDriftCount} Drift</span>
        </div>
      </div>

      {/* Primary Navigation — Exactly 3 Destinations */}
      <nav aria-label="Primary Navigation" className={`flex items-center gap-1 p-1 rounded-xl border ${
        darkMode
          ? "bg-[#141416] border-[#27272a]"
          : "bg-[#f2f1ed] border-[#dedbd5]"
      }`}>
        <button
          onClick={() => onNavigateDestination("home")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentDestination === "home"
              ? darkMode
                ? "bg-[#27272a] text-[#f4f4f5] shadow-sm"
                : "bg-[#ffffff] text-[#111113] shadow-sm border border-[#e4e2dd]"
              : darkMode
                ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1c1c1f]"
                : "text-[#63626b] hover:text-[#111113] hover:bg-[#e8e6e1]"
          }`}
        >
          <Home size={14} />
          <span>Home</span>
        </button>

        <button
          onClick={() => onNavigateDestination("workspace")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentDestination === "workspace"
              ? darkMode
                ? "bg-[#27272a] text-[#f4f4f5] shadow-sm"
                : "bg-[#ffffff] text-[#111113] shadow-sm border border-[#e4e2dd]"
              : darkMode
                ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1c1c1f]"
                : "text-[#63626b] hover:text-[#111113] hover:bg-[#e8e6e1]"
          }`}
        >
          <Layers size={14} />
          <span>Workspace</span>
        </button>

        <button
          onClick={() => onNavigateDestination("evidence")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentDestination === "evidence"
              ? darkMode
                ? "bg-[#27272a] text-[#f4f4f5] shadow-sm"
                : "bg-[#ffffff] text-[#111113] shadow-sm border border-[#e4e2dd]"
              : darkMode
                ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1c1c1f]"
                : "text-[#63626b] hover:text-[#111113] hover:bg-[#e8e6e1]"
          }`}
        >
          <ShieldCheck size={14} />
          <span>Evidence & Review</span>
        </button>
      </nav>

      {/* Global Actions: Orchestrator + Search + Profile */}
      <div className="flex items-center gap-2.5">
        {/* Global Orchestrator Button */}
        <button
          onClick={() => onOpenOrchestrator()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm ${
            darkMode
              ? "bg-gradient-to-r from-amber-500/15 to-amber-500/25 hover:from-amber-500/25 hover:to-amber-500/35 border-amber-500/40 text-amber-400"
              : "bg-gradient-to-r from-amber-500/10 to-amber-500/15 hover:bg-amber-500/20 border-amber-500/30 text-amber-700"
          }`}
          title="Open DataNova Orchestrator (Ctrl+K)"
        >
          <Bot size={14} className="text-amber-500" />
          <span className="hidden md:inline">Ask Orchestrator</span>
          <kbd className={`hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded border ${
            darkMode
              ? "bg-[#232326] border-[#38383e] text-amber-400"
              : "bg-[#e8e6e1] border-[#dedbd5] text-amber-700"
          }`}>
            Ctrl+K
          </kbd>
        </button>

        {/* Global Search Shortcut */}
        <button
          onClick={onOpenCommandPalette}
          className={`p-2 rounded-lg border transition-colors ${
            darkMode
              ? "border-[#27272a] bg-[#18181b] hover:bg-[#232326] text-[#a1a1aa] hover:text-[#f4f4f5]"
              : "border-[#dedbd5] bg-[#ffffff] hover:bg-[#f5f4f0] text-[#63626b] hover:text-[#111113]"
          }`}
          title="Search actions and components"
        >
          <Search size={14} />
        </button>

        {/* Dark/Light mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-2 rounded-lg border transition-colors ${
            darkMode
              ? "border-[#27272a] bg-[#18181b] hover:bg-[#232326] text-[#a1a1aa] hover:text-[#f4f4f5]"
              : "border-[#dedbd5] bg-[#ffffff] hover:bg-[#f5f4f0] text-[#63626b] hover:text-[#111113]"
          }`}
          title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          {darkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
        </button>

        {/* User / Profile & Legacy Views Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              darkMode
                ? "border-[#27272a] bg-[#18181b] hover:bg-[#232326] text-[#f4f4f5]"
                : "border-[#dedbd5] bg-[#ffffff] hover:bg-[#f5f4f0] text-[#111113]"
            }`}
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
              LE
            </div>
            <ChevronDown size={12} className={darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"} />
          </button>

          {userMenuOpen && (
            <div className={`absolute right-0 mt-2 w-64 rounded-xl border p-2 shadow-2xl space-y-1 text-xs animate-fadeIn z-50 ${
              darkMode
                ? "border-[#27272a] bg-[#141416] text-[#f4f4f5]"
                : "border-[#dedbd5] bg-[#ffffff] text-[#111113]"
            }`}>
              <div className={`px-3 py-2 border-b ${darkMode ? "border-[#27272a]" : "border-[#dedbd5]"}`}>
                <div className="font-bold">Lead Engineer</div>
                <div className={`text-[11px] font-mono ${darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"}`}>
                  engineer@datanova.io
                </div>
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenSettings();
                }}
                className={`w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center justify-between ${
                  darkMode ? "text-[#f4f4f5] hover:bg-[#232326]" : "text-[#111113] hover:bg-[#f5f4f0]"
                }`}
              >
                <span>Project & System Settings</span>
              </button>

              <div className={`pt-1 border-t px-3 py-1 text-[10px] font-mono uppercase tracking-wider font-bold ${
                darkMode ? "border-[#27272a] text-[#71717a]" : "border-[#dedbd5] text-[#71717a]"
              }`}>
                Classic / Specialty Views
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("lab");
                }}
                className={`w-full px-3 py-1.5 rounded-lg text-left transition-colors flex items-center gap-2 text-[11px] ${
                  darkMode ? "text-[#a1a1aa] hover:text-amber-400 hover:bg-[#232326]" : "text-[#63626b] hover:text-amber-600 hover:bg-[#f5f4f0]"
                }`}
              >
                <FlaskConical size={12} />
                <span>Architecture Lab</span>
              </button>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("trail");
                }}
                className={`w-full px-3 py-1.5 rounded-lg text-left transition-colors flex items-center gap-2 text-[11px] ${
                  darkMode ? "text-[#a1a1aa] hover:text-amber-400 hover:bg-[#232326]" : "text-[#63626b] hover:text-amber-600 hover:bg-[#f5f4f0]"
                }`}
              >
                <GraduationCap size={12} />
                <span>Learning Trail</span>
              </button>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("mission");
                }}
                className={`w-full px-3 py-1.5 rounded-lg text-left transition-colors flex items-center gap-2 text-[11px] ${
                  darkMode ? "text-[#a1a1aa] hover:text-amber-400 hover:bg-[#232326]" : "text-[#63626b] hover:text-amber-600 hover:bg-[#f5f4f0]"
                }`}
              >
                <LayoutDashboard size={12} />
                <span>Mission Control</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
