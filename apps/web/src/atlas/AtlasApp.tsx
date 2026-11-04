/**
 * Datanova Atlas — the product shell (Campaign 06, Tasks 04, 06).
 * Left navigation rail + workspace header + section routing. All state via
 * the Atlas workspace store (localStorage-backed, session-isolated).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Boxes, FlaskConical, ShieldCheck, Send, Gauge,
  BookOpen, GitBranch, Settings, Palette, Search, ChevronRight, Plus, Bot,
} from "lucide-react";
import {
  ATLAS_SECTIONS, SECTION_LABELS, useAtlasSection, type AtlasSection,
} from "./router";
import {
  AAnnouncer, ABadge, AButton, ADialog, AField, AInput,
} from "./ui";
import {
  activeProject, archiveProject, createProject, duplicateProject, loadAtlasState,
  renameProject, saveAtlasState, saveModel, selectProject, type AtlasState,
} from "./state";
import { serializeModel, parseModel, type ArchitectureModel } from "../lab/model";
import { docflowModel } from "../lab/samples";
import { evaluateValidation, DEFAULT_POLICY, VALIDATION_LABELS } from "./validation";
import type { ReviewRecord } from "./validation";
import { MissionView } from "./views/Mission";
import { StudioView } from "./Studio";
import { ExperimentsView } from "./views/Experiments";
import { ValidationRoomView } from "./views/ValidationRoom";
import { ExchangeView } from "./views/Exchange";
import { BenchmarksView } from "./views/Benchmarks";
import { SourcesView } from "./views/Sources";
import { DecisionsView } from "./views/Decisions";
import { SettingsView } from "./views/Settings";
import { DesignSystemView } from "./views/DesignSystem";
import { AgentStudioView } from "../agents/AgentStudio";
import { CommandPalette } from "./CommandPalette";

const SECTION_ICONS: Record<AtlasSection, React.ReactNode> = {
  mission: <LayoutDashboard size={16} aria-hidden />,
  studio: <Boxes size={16} aria-hidden />,
  experiments: <FlaskConical size={16} aria-hidden />,
  validation: <ShieldCheck size={16} aria-hidden />,
  exchange: <Send size={16} aria-hidden />,
  benchmarks: <Gauge size={16} aria-hidden />,
  sources: <BookOpen size={16} aria-hidden />,
  decisions: <GitBranch size={16} aria-hidden />,
  settings: <Settings size={16} aria-hidden />,
  system: <Palette size={16} aria-hidden />,
  agents: <Bot size={16} aria-hidden />,
};

/** Review records live with the Atlas workspace (per-browser, no fabrication). */
const REVIEWS_KEY = "datanova-atlas-reviews-v1";
const loadReviews = (): Record<string, ReviewRecord[]> => {
  try { return JSON.parse(window.localStorage.getItem(REVIEWS_KEY) ?? "{}"); } catch { return {}; }
};
const saveReviews = (r: Record<string, ReviewRecord[]>): void => {
  window.localStorage.setItem(REVIEWS_KEY, JSON.stringify(r));
};

/** Impure: wall-clock, but only used in event handlers and (memoized) policy evaluation — never during render of children. */
const nowIso = (): string => new Date().toISOString();

export const AtlasApp: React.FC = () => {
  const [state, setState] = useState<AtlasState>(() => loadAtlasState(window.localStorage));
  const [section, navigate] = useAtlasSection();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [announce, setAnnounce] = useState("");
  const [reviews, setReviews] = useState<Record<string, ReviewRecord[]>>(loadReviews);

  useEffect(() => { saveAtlasState(window.localStorage, state); }, [state]);
  useEffect(() => { saveReviews(reviews); }, [reviews]);

  const project = activeProject(state);
  const model = useMemo<ArchitectureModel>(() => parseModel(project.modelJson), [project.modelJson]);

  const validation = useMemo(
    () => evaluateValidation(reviews[project.id] ?? [], DEFAULT_POLICY, {
      reviewRequested: false, now: nowIso(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviews, project.id],
  );

  const setModel = useCallback((m: ArchitectureModel): void => {
    const now = new Date().toISOString();
    setState((s) => saveModel(s, serializeModel(m), now));
    setAnnounce(`Architecture saved — version ${project.version + 1}.`);
  }, [project.version]);

  // keyboard: Ctrl/Cmd+K opens the command palette anywhere in Atlas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const createNow = (): void => {
    if (!newName.trim()) return;
    setState((s) => createProject(s, newName.trim(), newDesc.trim(), docflowModel(), new Date().toISOString()));
    setNewOpen(false); setNewName(""); setNewDesc("");
    setAnnounce(`Created architecture "${newName.trim()}".`);
    navigate("studio");
  };

  const valBadge = validation.state === "independently-validated" ? "ok"
    : validation.state === "not-reviewed" ? "unknown"
    : validation.state === "findings-disputed" ? "warn"
    : "info";

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <AAnnouncer message={announce} />

      {/* ——— Global navigation rail (Task 04.1) ——— */}
      <nav aria-label="Atlas sections" className="w-52 shrink-0 border-r border-slate-800/80 bg-slate-900/70 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-800/80">
          <div className="text-sm font-black tracking-wide text-sky-300">DATANOVA ATLAS</div>
          <div className="text-[10px] text-slate-500">Spatial architecture intelligence</div>
        </div>
        <div className="px-2 py-2">
          <AButton variant="primary" className="w-full" onClick={() => setNewOpen(true)}>
            <span className="inline-flex items-center gap-1"><Plus size={12} aria-hidden /> New architecture</span>
          </AButton>
        </div>
        <ul className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5">
          {ATLAS_SECTIONS.map((s) => (
            <li key={s}>
              <button
                onClick={() => navigate(s)}
                aria-current={section === s ? "page" : undefined}
                className={`w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  section === s
                    ? "bg-sky-500/15 text-sky-200 border border-sky-500/40"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
                }`}>
                {SECTION_ICONS[s]}
                {SECTION_LABELS[s]}
              </button>
            </li>
          ))}
        </ul>
        <div className="px-3 py-2 border-t border-slate-800/80 text-[10px] text-slate-500">
          {state.projects.length} architecture(s) · all data local
        </div>
      </nav>

      {/* ——— Main column ——— */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace header (Task 04.2) */}
        <header aria-label="Workspace header" className="h-12 shrink-0 border-b border-slate-800/80 bg-slate-900/60 flex items-center gap-3 px-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-slate-400 min-w-0">
            <span className="font-semibold text-slate-200 truncate">{project.name}</span>
            <ChevronRight size={12} aria-hidden />
            <span className="truncate">{SECTION_LABELS[section]}</span>
          </nav>
          <label htmlFor="atlas-project" className="sr-only">Active architecture</label>
          <select id="atlas-project" value={state.activeProjectId}
            onChange={(e) => { setState((s) => selectProject(s, e.target.value)); setAnnounce(`Switched to "${state.projects.find((p) => p.id === e.target.value)?.name}".`); }}
            className="ml-auto rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs text-slate-100 max-w-48">
            {state.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="text-[10px] text-slate-500 whitespace-nowrap">v{project.version}</span>
          <span className={`text-[10px] font-semibold whitespace-nowrap ${state.unsaved[project.id] ? "text-amber-300" : "text-emerald-400"}`}>
            {state.unsaved[project.id] ? "● unsaved" : "✓ saved"}
          </span>
          <ABadge status={valBadge as never} label={VALIDATION_LABELS[validation.state]} title={validation.reasons.join("; ")} />
          <AButton aria-label="Search and run commands (Ctrl+K)" onClick={() => setPaletteOpen(true)}>
            <span className="inline-flex items-center gap-1"><Search size={12} aria-hidden /> Search <kbd className="text-[9px] border border-slate-600 rounded px-1">Ctrl K</kbd></span>
          </AButton>
        </header>

        {/* Section content */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {section === "mission" && <MissionView state={state} reviews={reviews} onNavigate={navigate} onOpenProject={(id) => { setState((s) => selectProject(s, id)); navigate("studio"); }} />}
          {section === "studio" && (
            <StudioView
              model={model}
              project={project}
              panels={state.panels}
              onPanels={(updater) => setState((s) => ({ ...s, panels: updater(s.panels) }))}
              onSave={setModel}
              onUnsaved={() => setState((s) => ({ ...s, unsaved: { ...s.unsaved, [s.activeProjectId]: true } }))}
              onNavigate={navigate}
            />
          )}
          {section === "experiments" && <ExperimentsView model={model} setAnnounce={setAnnounce} />}
          {section === "validation" && (
            <ValidationRoomView
              model={model} project={project} reviews={reviews[project.id] ?? []}
              onRecordReview={(record) => setReviews((r) => ({ ...r, [project.id]: [...(r[project.id] ?? []), record] }))}
              setAnnounce={setAnnounce}
            />
          )}
          {section === "exchange" && <ExchangeView model={model} onNavigate={navigate} onAdoptModel={setModel} />}
          {section === "benchmarks" && <BenchmarksView />}
          {section === "sources" && <SourcesView />}
          {section === "decisions" && <DecisionsView model={model} project={project} />}
          {section === "settings" && (
            <SettingsView state={state} reviews={reviews}
              onRename={(id, name) => setState((s) => renameProject(s, id, name))}
              onArchive={(id) => setState((s) => archiveProject(s, id))}
              onDuplicate={(id) => setState((s) => duplicateProject(s, id, new Date().toISOString()))}
              onSelect={(id) => setState((s) => selectProject(s, id))}
              setAnnounce={setAnnounce}
            />
          )}
          {section === "system" && <DesignSystemView />}
          {section === "agents" && <AgentStudioView />}
        </main>
      </div>

      {paletteOpen && (
        <CommandPalette
          state={state} model={model}
          onClose={() => setPaletteOpen(false)}
          onNavigate={navigate}
          onRun={(cmd) => { setPaletteOpen(false); cmd(); }}
        />
      )}

      {newOpen && (
        <ADialog title="New architecture" onClose={() => setNewOpen(false)}>
          <div className="space-y-3">
            <AField label="Name">
              <AInput value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Architecture name" />
            </AField>
            <AField label="Description">
              <AInput value={newDesc} onChange={(e) => setNewDesc(e.target.value)} aria-label="Architecture description" />
            </AField>
            <p className="text-[11px] text-slate-400">
              Creates a working copy of the DocFlow reference architecture — edit it freely in the Studio; the reference stays intact.
            </p>
            <div className="flex justify-end gap-2">
              <AButton onClick={() => setNewOpen(false)}>Cancel</AButton>
              <AButton variant="primary" disabled={!newName.trim()} onClick={createNow}>Create</AButton>
            </div>
          </div>
        </ADialog>
      )}
    </div>
  );
};
