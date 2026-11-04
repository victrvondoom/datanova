/**
 * DataNova Campaign 08 — Workspace: 5.4 Investigate View
 *
 * Unifies runtime observations, distributed trace exploration, architecture drift,
 * unexpected dependencies, security findings, and incident investigation.
 */

import React from "react";
import { RealityEngineApp } from "../../reality/ui/RealityEngineApp";
import type { ArchitectureModel } from "../../lab/model";
import type { AtlasSection } from "../../atlas/router";

interface WorkspaceInvestigateProps {
  model: ArchitectureModel;
  onNavigateAtlas: (sec: AtlasSection) => void;
  onAdoptModel: (model: ArchitectureModel) => void;
}

export const WorkspaceInvestigate: React.FC<WorkspaceInvestigateProps> = ({
  model,
  onNavigateAtlas,
  onAdoptModel,
}) => {
  return (
    <div className="space-y-6">
      <RealityEngineApp
        model={model}
        onNavigateAtlas={onNavigateAtlas}
        onAdoptModel={onAdoptModel}
      />
    </div>
  );
};
