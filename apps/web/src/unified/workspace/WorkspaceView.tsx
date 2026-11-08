/**
 * DataNova Campaign 08 — Destination 2: Workspace View
 *
 * The central engineering environment unifying:
 * 1. Overview
 * 2. System Map (3D Studio & 8/10 layers)
 * 3. Analyze (Simulations, queues, SLOs)
 * 4. Investigate (Reality engine, traces, drift, incidents)
 * 5. Improve & Compare (Decisions, changes, release readiness)
 *
 * Styled in creamy white & creamy black aesthetic.
 */

import React from "react";
import {
  Boxes, Activity, ShieldAlert, GitBranch, LayoutDashboard
} from "lucide-react";
import type { WorkspaceSubView } from "../types";
import type { Project, PanelPrefs } from "../../atlas/state";
import type { ArchitectureModel } from "../../lab/model";
import type { AtlasSection } from "../../atlas/router";

import { WorkspaceOverview } from "./WorkspaceOverview";
import { WorkspaceSystemMap } from "./WorkspaceSystemMap";
import { WorkspaceAnalyze } from "./WorkspaceAnalyze";
import { WorkspaceInvestigate } from "./WorkspaceInvestigate";
import { WorkspaceImprove } from "./WorkspaceImprove";

interface WorkspaceViewProps {
  subview: WorkspaceSubView;
  onChangeSubview: (sub: WorkspaceSubView) => void;
  project: Project;
  model: ArchitectureModel;
  panels: PanelPrefs;
  onPanels: (updater: (prev: PanelPrefs) => PanelPrefs) => void;
  onSaveModel: (model: ArchitectureModel) => void;
  onUnsaved: () => void;
  onNavigateAtlas: (sec: AtlasSection) => void;
  onOpenOrchestrator: (initialPrompt?: string) => void;
  setAnnounce?: (msg: string) => void;
  darkMode?: boolean;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  subview,
  onChangeSubview,
  project,
  model,
  panels,
  onPanels,
  onSaveModel,
  onUnsaved,
  onNavigateAtlas,
  onOpenOrchestrator,
  setAnnounce,
  darkMode = true,
}) => {
  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden transition-colors ${
      darkMode ? "bg-[#09090b] text-[#f4f4f5]" : "bg-[#fbfaf8] text-[#111113]"
    }`}>
      {/* Workspace Sub-Navigation Rail */}
      <div className={`h-11 shrink-0 border-b px-4 lg:px-6 flex items-center justify-between gap-4 transition-colors ${
        darkMode ? "border-[#232326] bg-[#0c0c0e]/95" : "border-[#e8e6e1] bg-[#f5f4f0]/95"
      }`}>
        <nav aria-label="Workspace Views" className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            onClick={() => onChangeSubview("overview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "overview"
                ? darkMode
                  ? "bg-[#27272a] text-[#f4f4f5] border border-[#3f3f46] shadow-sm font-bold"
                  : "bg-[#ffffff] text-[#111113] border border-[#dedbd5] shadow-sm font-bold"
                : darkMode
                  ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
                  : "text-[#63626b] hover:text-[#111113] hover:bg-[#e8e6e1]"
            }`}
          >
            <LayoutDashboard size={13} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => onChangeSubview("map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "map"
                ? darkMode
                  ? "bg-[#27272a] text-[#f4f4f5] border border-[#3f3f46] shadow-sm font-bold"
                  : "bg-[#ffffff] text-[#111113] border border-[#dedbd5] shadow-sm font-bold"
                : darkMode
                  ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
                  : "text-[#63626b] hover:text-[#111113] hover:bg-[#e8e6e1]"
            }`}
          >
            <Boxes size={13} />
            <span>System Map</span>
          </button>

          <button
            onClick={() => onChangeSubview("analyze")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "analyze"
                ? darkMode
                  ? "bg-[#27272a] text-[#f4f4f5] border border-[#3f3f46] shadow-sm font-bold"
                  : "bg-[#ffffff] text-[#111113] border border-[#dedbd5] shadow-sm font-bold"
                : darkMode
                  ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
                  : "text-[#63626b] hover:text-[#111113] hover:bg-[#e8e6e1]"
            }`}
          >
            <Activity size={13} />
            <span>Analyze</span>
          </button>

          <button
            onClick={() => onChangeSubview("investigate")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "investigate"
                ? darkMode
                  ? "bg-[#27272a] text-[#f4f4f5] border border-[#3f3f46] shadow-sm font-bold"
                  : "bg-[#ffffff] text-[#111113] border border-[#dedbd5] shadow-sm font-bold"
                : darkMode
                  ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
                  : "text-[#63626b] hover:text-[#111113] hover:bg-[#e8e6e1]"
            }`}
          >
            <ShieldAlert size={13} />
            <span>Investigate</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          </button>

          <button
            onClick={() => onChangeSubview("improve")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "improve"
                ? darkMode
                  ? "bg-[#27272a] text-[#f4f4f5] border border-[#3f3f46] shadow-sm font-bold"
                  : "bg-[#ffffff] text-[#111113] border border-[#dedbd5] shadow-sm font-bold"
                : darkMode
                  ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
                  : "text-[#63626b] hover:text-[#111113] hover:bg-[#e8e6e1]"
            }`}
          >
            <GitBranch size={13} />
            <span>Improve & Compare</span>
          </button>
        </nav>

        <div className={`hidden sm:flex items-center gap-2 text-xs font-mono ${
          darkMode ? "text-[#71717a]" : "text-[#71717a]"
        }`}>
          <span>Model:</span>
          <span className={`font-bold ${darkMode ? "text-[#f4f4f5]" : "text-[#111113]"}`}>{project.name}</span>
        </div>
      </div>

      {/* Main Viewport Content Area */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${subview === "map" ? "p-0 overflow-hidden flex flex-col" : "p-6 lg:p-8"}`}>
        {subview === "overview" && (
          <WorkspaceOverview
            project={project}
            model={model}
            onNavigateSubView={onChangeSubview}
            onOpenOrchestrator={onOpenOrchestrator}
            darkMode={darkMode}
          />
        )}

        {subview === "map" && (
          <WorkspaceSystemMap
            project={project}
            model={model}
            panels={panels}
            onPanels={onPanels}
            onSave={onSaveModel}
            onUnsaved={onUnsaved}
            onNavigateAtlas={onNavigateAtlas}
          />
        )}

        {subview === "analyze" && (
          <WorkspaceAnalyze
            model={model}
            setAnnounce={setAnnounce}
            darkMode={darkMode}
          />
        )}

        {subview === "investigate" && (
          <WorkspaceInvestigate
            model={model}
            onNavigateAtlas={onNavigateAtlas}
            onAdoptModel={onSaveModel}
          />
        )}

        {subview === "improve" && (
          <WorkspaceImprove
            model={model}
            project={project}
            darkMode={darkMode}
          />
        )}
      </div>
    </div>
  );
};
