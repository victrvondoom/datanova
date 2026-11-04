/**
 * DataNova Campaign 08 — Destination 2: Workspace View
 *
 * The central engineering environment unifying:
 * 1. Overview
 * 2. System Map (3D Studio & 8/10 layers)
 * 3. Analyze (Simulations, queues, SLOs)
 * 4. Investigate (Reality engine, traces, drift, incidents)
 * 5. Improve & Compare (Decisions, changes, release readiness)
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
}) => {
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-950">
      {/* Workspace Sub-Navigation Rail */}
      <div className="h-11 shrink-0 border-b border-slate-800/80 bg-slate-900/70 px-4 lg:px-6 flex items-center justify-between gap-4">
        <nav aria-label="Workspace Views" className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            onClick={() => onChangeSubview("overview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "overview"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <LayoutDashboard size={13} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => onChangeSubview("map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "map"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Boxes size={13} />
            <span>System Map</span>
          </button>

          <button
            onClick={() => onChangeSubview("analyze")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "analyze"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Activity size={13} />
            <span>Analyze</span>
          </button>

          <button
            onClick={() => onChangeSubview("investigate")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "investigate"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <ShieldAlert size={13} />
            <span>Investigate</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          </button>

          <button
            onClick={() => onChangeSubview("improve")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "improve"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <GitBranch size={13} />
            <span>Improve & Compare</span>
          </button>
        </nav>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>Target:</span>
          <span className="text-slate-300 font-bold">{project.name}</span>
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
          />
        )}
      </div>
    </div>
  );
};
