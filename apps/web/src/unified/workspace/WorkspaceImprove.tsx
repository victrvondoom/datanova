/**
 * DataNova Campaign 08 — Workspace: 5.5 Improve & Compare View
 *
 * Unifies architecture alternatives, mutation workflows, counterfactual experiments,
 * Architecture Decision Records (ADRs), change impact, and release readiness gates.
 */

import React, { useState } from "react";
import type { ArchitectureModel } from "../../lab/model";
import type { Project } from "../../atlas/state";
import { DecisionsView } from "../../atlas/views/Decisions";
import { ChangeReview } from "../../reality/ui/ChangeReview";

interface WorkspaceImproveProps {
  model: ArchitectureModel;
  project: Project;
}

export const WorkspaceImprove: React.FC<WorkspaceImproveProps> = ({
  model,
  project,
}) => {
  const [activeTab, setActiveTab] = useState<"decisions" | "release">("decisions");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header and Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Improve & Compare</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              ARCHITECTURE EVOLUTION
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track Architecture Decision Records (ADRs), evaluate proposed changes, and review pre-deployment release gates.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
          <button
            onClick={() => setActiveTab("decisions")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "decisions"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>Decision Records (ADR)</span>
          </button>
          <button
            onClick={() => setActiveTab("release")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "release"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
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
