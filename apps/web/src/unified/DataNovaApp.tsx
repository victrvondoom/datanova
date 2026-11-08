/**
 * DataNova Campaign 08 — Central Unified Application Shell
 *
 * One Product · One Orchestrator · One Understandable Workflow
 * Coordinates Home, Workspace, and Evidence & Review destinations.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { PrimaryDestination, WorkspaceSubView, EvidenceSubView as EvidenceSubViewType } from "./types";
import { UnifiedHeader } from "./header/UnifiedHeader";
import { HomeView } from "./home/HomeView";
import { WorkspaceView } from "./workspace/WorkspaceView";
import { EvidenceView } from "./evidence/EvidenceView";
import { OrchestratorModal } from "./orchestrator/OrchestratorModal";
import { CommandPalette } from "../atlas/CommandPalette";
import { SettingsView } from "../atlas/views/Settings";

import {
  activeProject, archiveProject, createProject, duplicateProject, loadAtlasState,
  renameProject, saveAtlasState, saveModel, selectProject, type AtlasState,
} from "../atlas/state";
import { serializeModel, parseModel, type ArchitectureModel } from "../lab/model";
import { docflowModel } from "../lab/samples";
import type { ReviewRecord } from "../atlas/validation";
import type { AtlasSection } from "../atlas/router";
import { ADialog, AField, AInput, AButton, AAnnouncer } from "../atlas/ui";

const REVIEWS_KEY = "datanova-atlas-reviews-v1";
const loadReviews = (): Record<string, ReviewRecord[]> => {
  try { return JSON.parse(window.localStorage.getItem(REVIEWS_KEY) ?? "{}"); } catch { return {}; }
};
const saveReviews = (r: Record<string, ReviewRecord[]>): void => {
  window.localStorage.setItem(REVIEWS_KEY, JSON.stringify(r));
};

interface DataNovaAppProps {
  onOpenLegacyView?: (view: string) => void;
  darkMode?: boolean;
  setDarkMode?: (val: boolean) => void;
}

export const DataNovaApp: React.FC<DataNovaAppProps> = ({
  onOpenLegacyView,
  darkMode = true,
  setDarkMode = () => {},
}) => {
  const [state, setState] = useState<AtlasState>(() => loadAtlasState(window.localStorage));
  const [reviews, setReviews] = useState<Record<string, ReviewRecord[]>>(loadReviews);
  const [destination, setDestination] = useState<PrimaryDestination>(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#/workspace")) return "workspace";
    if (hash.startsWith("#/evidence")) return "evidence";
    return "home";
  });

  const [workspaceSubview, setWorkspaceSubview] = useState<WorkspaceSubView>(() => {
    const hash = window.location.hash;
    if (hash.includes("/map")) return "map";
    if (hash.includes("/analyze")) return "analyze";
    if (hash.includes("/investigate")) return "investigate";
    if (hash.includes("/improve")) return "improve";
    return "overview";
  });

  const [evidenceSubview, setEvidenceSubview] = useState<EvidenceSubViewType>(() => {
    const hash = window.location.hash;
    if (hash.includes("/sources")) return "sources";
    if (hash.includes("/records")) return "evidence";
    if (hash.includes("/reviews")) return "reviews";
    if (hash.includes("/exchange")) return "exchange";
    if (hash.includes("/quality")) return "quality";
    return "findings";
  });

  const [orchestratorOpen, setOrchestratorOpen] = useState(false);
  const [orchestratorPrompt, setOrchestratorPrompt] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [announce, setAnnounce] = useState("");

  useEffect(() => { saveAtlasState(window.localStorage, state); }, [state]);
  useEffect(() => { saveReviews(reviews); }, [reviews]);

  const project = activeProject(state);
  const model = useMemo<ArchitectureModel>(() => parseModel(project.modelJson), [project.modelJson]);

  const setModel = useCallback((m: ArchitectureModel): void => {
    const now = new Date().toISOString();
    setState((s) => saveModel(s, serializeModel(m), now));
    setAnnounce(`Architecture saved — version ${project.version + 1}.`);
  }, [project.version]);

  // Sync hash changes
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/workspace")) {
        setDestination("workspace");
        if (hash.includes("/map")) setWorkspaceSubview("map");
        else if (hash.includes("/analyze")) setWorkspaceSubview("analyze");
        else if (hash.includes("/investigate")) setWorkspaceSubview("investigate");
        else if (hash.includes("/improve")) setWorkspaceSubview("improve");
        else setWorkspaceSubview("overview");
      } else if (hash.startsWith("#/evidence")) {
        setDestination("evidence");
        if (hash.includes("/sources")) setEvidenceSubview("sources");
        else if (hash.includes("/records")) setEvidenceSubview("evidence");
        else if (hash.includes("/reviews")) setEvidenceSubview("reviews");
        else if (hash.includes("/exchange")) setEvidenceSubview("exchange");
        else if (hash.includes("/quality")) setEvidenceSubview("quality");
        else setEvidenceSubview("findings");
      } else if (hash.startsWith("#/home") || hash === "#/" || hash === "") {
        setDestination("home");
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOrchestratorOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigateDestination = (dest: PrimaryDestination) => {
    setDestination(dest);
    window.location.hash = `#/${dest}`;
  };

  const navigateWorkspaceSubview = (sub: string = "overview") => {
    setDestination("workspace");
    setWorkspaceSubview(sub as WorkspaceSubView);
    window.location.hash = `#/workspace/${sub}`;
  };

  const navigateEvidenceSubview = (sub: string = "findings") => {
    setDestination("evidence");
    setEvidenceSubview(sub as EvidenceSubViewType);
    window.location.hash = `#/evidence/${sub}`;
  };

  const handleOpenOrchestrator = (initialPrompt?: string) => {
    setOrchestratorPrompt(initialPrompt || "");
    setOrchestratorOpen(true);
  };

  const handleOrchestratorNavigate = (targetPath: string) => {
    if (targetPath.startsWith("workspace")) {
      const sub = targetPath.split("/")[1] || "overview";
      navigateWorkspaceSubview(sub);
    } else if (targetPath.startsWith("evidence")) {
      const sub = targetPath.split("/")[1] || "findings";
      navigateEvidenceSubview(sub);
    }
  };

  const createNewProjectNow = () => {
    if (!newName.trim()) return;
    setState((s) => createProject(s, newName.trim(), newDesc.trim(), docflowModel(), new Date().toISOString()));
    setNewProjectOpen(false);
    setNewName("");
    setNewDesc("");
    setAnnounce(`Created architecture "${newName.trim()}".`);
    navigateWorkspaceSubview("map");
  };

  const handleRecordReview = (record: ReviewRecord) => {
    setReviews((r) => ({ ...r, [project.id]: [...(r[project.id] ?? []), record] }));
  };

  const handleAtlasSectionNavigate = (sec: AtlasSection) => {
    if (sec === "studio") navigateWorkspaceSubview("map");
    else if (sec === "reality") navigateWorkspaceSubview("investigate");
    else if (sec === "experiments") navigateWorkspaceSubview("analyze");
    else if (sec === "validation") navigateEvidenceSubview("reviews");
    else if (sec === "exchange") navigateEvidenceSubview("exchange");
    else if (sec === "benchmarks") navigateEvidenceSubview("quality");
    else if (sec === "sources") navigateEvidenceSubview("sources");
    else if (sec === "decisions") navigateWorkspaceSubview("improve");
    else if (sec === "settings") setSettingsOpen(true);
    else navigateWorkspaceSubview("overview");
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden select-none transition-colors duration-300 ${
      darkMode
        ? "bg-[#141312] text-[#f5f2eb]"
        : "bg-[#faf7f2] text-[#181716]"
    }`}>
      <AAnnouncer message={announce} />
      {/* Universal Top Header */}
      <UnifiedHeader
        currentDestination={destination}
        onNavigateDestination={navigateDestination}
        projects={state.projects.filter((p) => !p.archived)}
        activeProjectId={state.activeProjectId}
        onSelectProject={(id) => setState((s) => selectProject(s, id))}
        onOpenOrchestrator={handleOpenOrchestrator}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenLegacyView={onOpenLegacyView}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Main Viewport Body */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {destination === "home" && (
          <div className="flex-1 overflow-y-auto">
            <HomeView
              projects={state.projects.filter((p) => !p.archived)}
              activeProjectId={state.activeProjectId}
              onSelectProject={(id) => setState((s) => selectProject(s, id))}
              onNavigateWorkspace={navigateWorkspaceSubview}
              onNavigateEvidence={navigateEvidenceSubview}
              onOpenOrchestrator={handleOpenOrchestrator}
              onCreateNewProject={() => setNewProjectOpen(true)}
              darkMode={darkMode}
            />
          </div>
        )}

        {destination === "workspace" && (
          <WorkspaceView
            subview={workspaceSubview}
            onChangeSubview={(sub) => {
              setWorkspaceSubview(sub);
              window.location.hash = `#/workspace/${sub}`;
            }}
            project={project}
            model={model}
            panels={state.panels}
            onPanels={(updater) => setState((s) => ({ ...s, panels: updater(s.panels) }))}
            onSaveModel={setModel}
            onUnsaved={() => setState((s) => ({ ...s, unsaved: { ...s.unsaved, [s.activeProjectId]: true } }))}
            onNavigateAtlas={handleAtlasSectionNavigate}
            onOpenOrchestrator={handleOpenOrchestrator}
            setAnnounce={setAnnounce}
            darkMode={darkMode}
          />
        )}

        {destination === "evidence" && (
          <EvidenceView
            subview={evidenceSubview}
            onChangeSubview={(sub) => {
              setEvidenceSubview(sub);
              window.location.hash = `#/evidence/${sub}`;
            }}
            project={project}
            model={model}
            reviews={reviews}
            onRecordReview={handleRecordReview}
            onNavigateAtlas={handleAtlasSectionNavigate}
            onAdoptModel={setModel}
            onNavigateWorkspace={navigateWorkspaceSubview}
            setAnnounce={setAnnounce}
            darkMode={darkMode}
          />
        )}
      </main>

      {/* Central Orchestrator Modal */}
      <OrchestratorModal
        isOpen={orchestratorOpen}
        onClose={() => setOrchestratorOpen(false)}
        model={model}
        projectName={project.name}
        projectVersion={project.version}
        initialPrompt={orchestratorPrompt}
        onNavigate={handleOrchestratorNavigate}
        darkMode={darkMode}
      />

      {/* Command Palette */}
      {paletteOpen && (
        <CommandPalette
          state={state}
          model={model}
          onClose={() => setPaletteOpen(false)}
          onNavigate={handleAtlasSectionNavigate}
          onRun={(cmd) => { setPaletteOpen(false); cmd(); }}
        />
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn ${
          darkMode ? "bg-[#141312]/80" : "bg-[#141312]/40"
        }`}>
          <div className={`w-full max-w-2xl max-h-[85vh] rounded-2xl border p-6 shadow-2xl overflow-y-auto space-y-4 ${
            darkMode ? "border-[#332f29] bg-[#1c1a17] text-[#f5f2eb]" : "border-[#e5dec9] bg-[#faf7f2] text-[#181716]"
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              darkMode ? "border-[#2e2a24]" : "border-[#e5dec9]"
            }`}>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Project & Workspace Settings</h3>
                <span className="text-[10px] font-mono tracking-wider uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">PREFERENCES</span>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className={`text-sm ${darkMode ? "text-[#a69f93] hover:text-[#f5f2eb]" : "text-[#6e675f] hover:text-[#181716]"}`}
              >
                &times;
              </button>
            </div>
            <SettingsView
              state={state}
              reviews={reviews}
              onRename={(id, name) => setState((s) => renameProject(s, id, name))}
              onArchive={(id) => setState((s) => archiveProject(s, id))}
              onDuplicate={(id) => setState((s) => duplicateProject(s, id, new Date().toISOString()))}
              onSelect={(id) => setState((s) => selectProject(s, id))}
              setAnnounce={setAnnounce}
            />
          </div>
        </div>
      )}

      {/* New Project Dialog */}
      {newProjectOpen && (
        <ADialog title="Create New System Architecture" onClose={() => setNewProjectOpen(false)}>
          <div className="space-y-4">
            <AField label="Project Name">
              <AInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Checkout & Payments System" />
            </AField>
            <AField label="Short Description">
              <AInput value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="e.g. Distributed payment processing with fraud controls" />
            </AField>
            <p className="text-xs text-slate-400 leading-relaxed">
              Creates a clean architecture workspace initialized with canonical components and connections ready for editing and simulation.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <AButton onClick={() => setNewProjectOpen(false)}>Cancel</AButton>
              <AButton variant="primary" disabled={!newName.trim()} onClick={createNewProjectNow}>
                Create Architecture
              </AButton>
            </div>
          </div>
        </ADialog>
      )}
    </div>
  );
};
