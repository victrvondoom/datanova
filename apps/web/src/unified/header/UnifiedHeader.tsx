/**
 * DataNova Campaign 08 — Unified Top Navigation Header
 *
 * Exactly 3 primary destinations + Global Orchestrator trigger + User settings menu.
 */

import React, { useState } from "react";
import {
  Boxes, Search, Sun, Moon,
  Home, Layers, ShieldCheck, ChevronDown, Bot, GraduationCap, FlaskConical, LayoutDashboard
} from "lucide-react";
import type { PrimaryDestination } from "../types";
import type { Project } from "../../atlas/state";

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

  return (
    <header className={`sticky top-0 z-40 h-14 border-b px-4 lg:px-6 flex items-center justify-between transition-colors backdrop-blur-md ${
      darkMode
        ? "border-[#2a2723] bg-[#161513]/92 text-[#f5f2eb]"
        : "border-[#e5dec9] bg-[#faf7f2]/92 text-[#181716]"
    }`}>
      {/* Brand & Active Architecture Selector */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => onNavigateDestination("home")}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#c59b27] via-[#a37d1d] to-[#181716] flex items-center justify-center text-[#faf7f2] shadow-md shadow-[#c59b27]/25 ring-1 ring-[#c59b27]/40 group-hover:scale-105 transition-transform">
            <Boxes size={18} />
          </div>
          <div>
            <div className="text-sm font-black tracking-wide flex items-center gap-1.5 leading-none">
              <span className={darkMode ? "text-[#f5f2eb]" : "text-[#181716]"}>DATANOVA</span>
              <span className="font-cursive text-lg text-[#c59b27] dark:text-[#dfba49] font-bold">Atlas</span>
            </div>
            <div className={`text-[10px] font-medium mt-0.5 ${darkMode ? "text-[#a69f93]" : "text-[#78716c]"}`}>
              Architecture <span className="font-cursive text-xs font-semibold">Intelligence</span> Studio
            </div>
          </div>
        </div>

        <div className={`h-5 w-px hidden sm:block ${darkMode ? "bg-[#2e2a24]" : "bg-[#ded4c0]"}`} />

        {/* Project Selector with Live Telemetry indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" title="Telemetry Active" />
          <label htmlFor="header-project-select" className="sr-only">Active Project</label>
          <select
            id="header-project-select"
            value={activeProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className={`text-xs font-semibold rounded-lg border px-2.5 py-1 focus:outline-none focus:border-[#c59b27] transition-colors max-w-44 truncate ${
              darkMode
                ? "border-[#38342c] bg-[#1f1d19] text-[#f5f2eb]"
                : "border-[#e0d6c4] bg-[#fdfcf9] text-[#181716]"
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

      {/* Primary Navigation — ONLY 3 DESTINATIONS */}
      <nav aria-label="Primary Navigation" className={`flex items-center gap-1 p-1 rounded-xl border ${
        darkMode
          ? "bg-[#1c1a17] border-[#2e2a24]"
          : "bg-[#f2ece0] border-[#ded4c0]"
      }`}>
        <button
          onClick={() => onNavigateDestination("home")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentDestination === "home"
              ? darkMode
                ? "bg-[#f5f2eb] text-[#181716] shadow-sm font-bold"
                : "bg-[#181716] text-[#faf7f2] shadow-sm font-bold"
              : darkMode
                ? "text-[#a69f93] hover:text-[#f5f2eb] hover:bg-[#25221e]"
                : "text-[#6e675f] hover:text-[#181716] hover:bg-[#eae3d4]"
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
                ? "bg-[#f5f2eb] text-[#181716] shadow-sm font-bold"
                : "bg-[#181716] text-[#faf7f2] shadow-sm font-bold"
              : darkMode
                ? "text-[#a69f93] hover:text-[#f5f2eb] hover:bg-[#25221e]"
                : "text-[#6e675f] hover:text-[#181716] hover:bg-[#eae3d4]"
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
                ? "bg-[#f5f2eb] text-[#181716] shadow-sm font-bold"
                : "bg-[#181716] text-[#faf7f2] shadow-sm font-bold"
              : darkMode
                ? "text-[#a69f93] hover:text-[#f5f2eb] hover:bg-[#25221e]"
                : "text-[#6e675f] hover:text-[#181716] hover:bg-[#eae3d4]"
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
              ? "bg-gradient-to-r from-[#c59b27]/20 via-[#dfba49]/15 to-[#c59b27]/20 hover:from-[#c59b27]/30 hover:to-[#dfba49]/30 border-[#c59b27]/50 text-[#dfba49]"
              : "bg-gradient-to-r from-[#f5ede0] via-[#f7f0e4] to-[#f5ede0] hover:bg-[#ede3d0] border-[#c59b27]/40 text-[#856514]"
          }`}
          title="Open DataNova Orchestrator"
        >
          <Bot size={14} className="text-[#c59b27]" />
          <span className="hidden md:inline">Ask Orchestrator</span>
          <kbd className={`hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded border ${
            darkMode
              ? "bg-[#2a261f] border-[#3f382a] text-[#dfba49]"
              : "bg-[#eae1cf] border-[#d8cca8] text-[#856514]"
          }`}>
            Ctrl+K
          </kbd>
        </button>

        {/* Global Search Shortcut */}
        <button
          onClick={onOpenCommandPalette}
          className={`p-2 rounded-lg border transition-colors ${
            darkMode
              ? "border-[#2e2a24] bg-[#1f1d19] hover:bg-[#292520] text-[#a69f93] hover:text-[#f5f2eb]"
              : "border-[#ded4c0] bg-[#fdfcf9] hover:bg-[#f6f0e4] text-[#6e675f] hover:text-[#181716]"
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
              ? "border-[#2e2a24] bg-[#1f1d19] hover:bg-[#292520] text-[#a69f93] hover:text-[#f5f2eb]"
              : "border-[#ded4c0] bg-[#fdfcf9] hover:bg-[#f6f0e4] text-[#6e675f] hover:text-[#181716]"
          }`}
          title={darkMode ? "Switch to creamy white theme" : "Switch to creamy black theme"}
        >
          {darkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
        </button>

        {/* User / Profile & Legacy Views Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              darkMode
                ? "border-[#2e2a24] bg-[#1f1d19] hover:bg-[#292520] text-[#f5f2eb]"
                : "border-[#ded4c0] bg-[#fdfcf9] hover:bg-[#f6f0e4] text-[#181716]"
            }`}
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-[#c59b27] to-[#181716] flex items-center justify-center text-[11px] font-bold text-[#faf7f2]">
              LE
            </div>
            <ChevronDown size={12} className={darkMode ? "text-[#a69f93]" : "text-[#78716c]"} />
          </button>

          {userMenuOpen && (
            <div className={`absolute right-0 mt-2 w-64 rounded-xl border p-2 shadow-2xl space-y-1 text-xs animate-fadeIn z-50 ${
              darkMode
                ? "border-[#2e2a24] bg-[#181716] text-[#f5f2eb]"
                : "border-[#ded4c0] bg-[#faf7f2] text-[#181716]"
            }`}>
              <div className={`px-3 py-2 border-b ${darkMode ? "border-[#2e2a24]" : "border-[#ded4c0]"}`}>
                <div className="font-bold">Lead Engineer</div>
                <div className={`text-[11px] font-mono ${darkMode ? "text-[#a69f93]" : "text-[#78716c]"}`}>engineer@datanova.io</div>
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenSettings();
                }}
                className={`w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center justify-between ${
                  darkMode ? "text-[#f5f2eb] hover:bg-[#25221e]" : "text-[#181716] hover:bg-[#f0e9dc]"
                }`}
              >
                <span>Project & System Settings</span>
              </button>

              <div className={`pt-1 border-t px-3 py-1 text-[10px] font-mono uppercase tracking-wider font-bold ${
                darkMode ? "border-[#2e2a24] text-[#857d72]" : "border-[#ded4c0] text-[#857d72]"
              }`}>
                Classic / Legacy Views
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("lab");
                }}
                className={`w-full px-3 py-1.5 rounded-lg text-left transition-colors flex items-center gap-2 text-[11px] ${
                  darkMode ? "text-[#c2bcb2] hover:text-[#dfba49] hover:bg-[#25221e]" : "text-[#575249] hover:text-[#9a7516] hover:bg-[#f0e9dc]"
                }`}
              >
                <FlaskConical size={12} />
                <span>Architecture Lab (Legacy)</span>
              </button>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("trail");
                }}
                className={`w-full px-3 py-1.5 rounded-lg text-left transition-colors flex items-center gap-2 text-[11px] ${
                  darkMode ? "text-[#c2bcb2] hover:text-[#dfba49] hover:bg-[#25221e]" : "text-[#575249] hover:text-[#9a7516] hover:bg-[#f0e9dc]"
                }`}
              >
                <GraduationCap size={12} />
                <span>TRACEN Learning Trail</span>
              </button>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("mission");
                }}
                className={`w-full px-3 py-1.5 rounded-lg text-left transition-colors flex items-center gap-2 text-[11px] ${
                  darkMode ? "text-[#c2bcb2] hover:text-[#dfba49] hover:bg-[#25221e]" : "text-[#575249] hover:text-[#9a7516] hover:bg-[#f0e9dc]"
                }`}
              >
                <LayoutDashboard size={12} />
                <span>AEGIS Mission Control</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
