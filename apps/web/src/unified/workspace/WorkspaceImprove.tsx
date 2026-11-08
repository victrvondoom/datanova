/**
 * DataNova Campaign 08 — Workspace: 5.5 Improve & Compare View
 *
 * Unifies architecture alternatives, mutation workflows, counterfactual experiments,
 * Architecture Decision Records (ADRs), change impact, and release readiness gates.
 * Styled in luxury creamy white and creamy black aesthetic with cursive typography.
 */

import React, { useState } from "react";
import type { ArchitectureModel } from "../../lab/model";
import type { Project } from "../../atlas/state";
import { DecisionsView } from "../../atlas/views/Decisions";
import { ChangeReview } from "../../reality/ui/ChangeReview";

interface WorkspaceImproveProps {
  model: ArchitectureModel;
  project: Project;
  darkMode?: boolean;
}

export const WorkspaceImprove: React.FC<WorkspaceImproveProps> = ({
  model,
  project,
  darkMode = true,
}) => {
  const [activeTab, setActiveTab] = useState<"decisions" | "release">("decisions");

  return (
    <div className={`max-w-6xl mx-auto space-y-6 transition-colors ${
      darkMode ? "text-[#f5f2eb]" : "text-[#181716]"
    }`}>
      {/* Header and Sub-Tab Switcher */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border backdrop-blur-md shadow-lg ${
        darkMode ? "border-[#27272a] bg-[#121214]" : "border-[#e4e2dd] bg-[#ffffff]"
      }`}>
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight">Improve & Compare</h2>
            <span className="text-[10px] font-mono tracking-widest uppercase font-semibold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Evolution Studio
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Verified Engine
            </span>
          </div>
          <p className={`text-xs mt-1 leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
            Track Architecture Decision Records (ADRs), evaluate proposed changes, and review pre-deployment release gates.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
          darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#f4f4f5] border-[#e4e4e7]"
        }`}>
          <button
            onClick={() => setActiveTab("decisions")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "decisions"
                ? darkMode
                  ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                  : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                : darkMode
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <span>Decision Records (ADR)</span>
          </button>
          <button
            onClick={() => setActiveTab("release")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "release"
                ? darkMode
                  ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                  : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                : darkMode
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <span>Release Impact & Gate</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "decisions" && (
        <div className="space-y-6">
          <DecisionsView model={model} project={project} />
        </div>
      )}

      {activeTab === "release" && (
        <div className="space-y-6">
          <ChangeReview driftCount={1} />
        </div>
      )}
    </div>
  );
};
