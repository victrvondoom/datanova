/**
 * DataNova Campaign 08 — Workspace: 5.2 System Map View
 *
 * Unifies 3D spatial architecture studio, 2D map, component editor,
 * and 8 core + 10 operational map layers with plain-language labels.
 */

import React from "react";
import { StudioView } from "../../atlas/Studio";
import type { Project, PanelPrefs } from "../../atlas/state";
import type { ArchitectureModel } from "../../lab/model";
import type { AtlasSection } from "../../atlas/router";

interface WorkspaceSystemMapProps {
  project: Project;
  model: ArchitectureModel;
  panels: PanelPrefs;
  onPanels: (updater: (prev: PanelPrefs) => PanelPrefs) => void;
  onSave: (model: ArchitectureModel) => void;
  onUnsaved: () => void;
  onNavigateAtlas: (sec: AtlasSection) => void;
}

export const WorkspaceSystemMap: React.FC<WorkspaceSystemMapProps> = ({
  project,
  model,
  panels,
  onPanels,
  onSave,
  onUnsaved,
  onNavigateAtlas,
}) => {
  return (
    <div className="h-full w-full flex-1 flex flex-col min-h-0 overflow-hidden relative">
      <StudioView
        model={model}
        project={project}
        panels={panels}
        onPanels={onPanels}
        onSave={onSave}
        onUnsaved={onUnsaved}
        onNavigate={onNavigateAtlas}
      />
    </div>
  );
};
