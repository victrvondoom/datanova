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
        darkMode ? "border-[#2e2a24] bg-[#1c1a17]/90" : "border-[#e5dec9] bg-[#fdfcf9]"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">Improve & Compare</h2>
            <span className="font-cursive text-xl text-[#b8860b] dark:text-[#dfba49]">
              Architecture Evolution
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              EVOLUTION ENGINE
            </span>
          </div>
          <p className={`text-xs mt-1 leading-relaxed ${darkMode ? "text-[#c2bcb2]" : "text-[#575249]"}`}>
            Track Architecture Decision Records (ADRs), evaluate proposed changes, and review pre-deployment release gates.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
          darkMode ? "bg-[#141312] border-[#2e2a24]" : "bg-[#f5efe4] border-[#ded4c0]"
        }`}>
          <button
            onClick={() => setActiveTab("decisions")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "decisions"
                ? "bg-gradient-to-r from-[#c59b27] to-[#a37d1d] text-[#181716] shadow-sm font-bold"
                : darkMode
                ? "text-[#a69f93] hover:text-[#f5f2eb]"
                : "text-[#6e675f] hover:text-[#181716]"
            }`}
          >
            <span>Decision Records (ADR)</span>
          </button>
          <button
            onClick={() => setActiveTab("release")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "release"
                ? "bg-gradient-to-r from-[#c59b27] to-[#a37d1d] text-[#181716] shadow-sm font-bold"
                : darkMode
                ? "text-[#a69f93] hover:text-[#f5f2eb]"
                : "text-[#6e675f] hover:text-[#181716]"
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
