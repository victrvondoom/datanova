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
    <header className="sticky top-0 z-40 h-14 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between transition-colors">
      {/* Brand & Active Architecture Selector */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => onNavigateDestination("home")}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/30 ring-1 ring-sky-400/30 group-hover:scale-105 transition-transform">
            <Boxes size={18} />
          </div>
          <div>
            <div className="text-sm font-black tracking-wide text-white group-hover:text-sky-300 transition-colors">
              DATANOVA
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Architecture Intelligence</div>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 hidden sm:block" />

        {/* Project Selector with Live Telemetry indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" title="Telemetry Active" />
          <label htmlFor="header-project-select" className="sr-only">Active Project</label>
          <select
            id="header-project-select"
            value={activeProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors max-w-44 truncate"
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
      <nav aria-label="Primary Navigation" className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
        <button
          onClick={() => onNavigateDestination("home")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentDestination === "home"
              ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Home size={14} />
          <span>Home</span>
        </button>

        <button
          onClick={() => onNavigateDestination("workspace")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentDestination === "workspace"
              ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Layers size={14} />
          <span>Workspace</span>
        </button>

        <button
          onClick={() => onNavigateDestination("evidence")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentDestination === "evidence"
              ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 border border-sky-500/40 text-sky-200 text-xs font-bold transition-all shadow-sm"
          title="Open DataNova Orchestrator"
        >
          <Bot size={14} className="text-sky-400" />
          <span className="hidden md:inline">Ask Orchestrator</span>
          <kbd className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/20 border border-sky-500/30 text-sky-300">
            Ctrl+K
          </kbd>
        </button>

        {/* Global Search Shortcut */}
        <button
          onClick={onOpenCommandPalette}
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Search actions and components"
        >
          <Search size={14} />
        </button>

        {/* Dark/Light mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          {darkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
        </button>

        {/* User / Profile & Legacy Views Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-[11px] font-bold text-white">
              LE
            </div>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-2xl space-y-1 text-xs animate-fadeIn z-50">
              <div className="px-3 py-2 border-b border-slate-800/80">
                <div className="font-bold text-white">Lead Engineer</div>
                <div className="text-[11px] text-slate-400 font-mono">engineer@datanova.io</div>
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full px-3 py-2 rounded-lg text-left text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center justify-between"
              >
                <span>Project & System Settings</span>
              </button>

              <div className="pt-1 border-t border-slate-800/80 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                Classic / Legacy Views
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("lab");
                }}
                className="w-full px-3 py-1.5 rounded-lg text-left text-slate-400 hover:text-sky-300 hover:bg-slate-800/40 transition-colors flex items-center gap-2 text-[11px]"
              >
                <FlaskConical size={12} />
                <span>Architecture Lab (Legacy)</span>
              </button>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("trail");
                }}
                className="w-full px-3 py-1.5 rounded-lg text-left text-slate-400 hover:text-sky-300 hover:bg-slate-800/40 transition-colors flex items-center gap-2 text-[11px]"
              >
                <GraduationCap size={12} />
                <span>TRACEN Learning Trail</span>
              </button>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenLegacyView?.("mission");
                }}
                className="w-full px-3 py-1.5 rounded-lg text-left text-slate-400 hover:text-sky-300 hover:bg-slate-800/40 transition-colors flex items-center gap-2 text-[11px]"
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
